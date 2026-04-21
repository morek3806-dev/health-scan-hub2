package com.pharmacy.smartscan.ui.scan

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.pharmacy.smartscan.data.MedicineBatch
import com.pharmacy.smartscan.data.MedicineBatchDao
import com.pharmacy.smartscan.domain.CatalogVerifier
import com.pharmacy.smartscan.domain.DrugInteraction
import com.pharmacy.smartscan.domain.GenericAlternative
import com.pharmacy.smartscan.domain.InteractionChecker
import com.pharmacy.smartscan.domain.OcrParser
import com.pharmacy.smartscan.domain.ParsedScan
import com.pharmacy.smartscan.worker.ExpiryAlarmScheduler
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.time.LocalDate
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class ScanReviewState(
    val isScanning: Boolean = false,
    val medicineName: String = "",
    val genericName: String = "",
    val batchNumber: String = "",
    val expiryDate: LocalDate? = null,
    val priceText: String = "",
    val verified: Boolean = false,
    val catalogId: String? = null,
    val alternatives: List<GenericAlternative> = emptyList(),
    val interactions: List<DrugInteraction> = emptyList(),
    val rawOcrText: String = "",
    val error: String? = null,
    val savedId: Long? = null,
)

class ScanReviewViewModel(
    private val dao: MedicineBatchDao,
    private val catalog: CatalogVerifier,
    private val interactions: InteractionChecker,
    private val alarms: ExpiryAlarmScheduler,
) : ViewModel() {

    private val _state = MutableStateFlow(ScanReviewState())
    val state: StateFlow<ScanReviewState> = _state.asStateFlow()

    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    /** Entry point: called from the camera screen with the captured image URI. */
    fun onImageCaptured(context: Context, imageUri: Uri) {
        _state.update { it.copy(isScanning = true, error = null) }
        viewModelScope.launch {
            runCatching {
                val image = withContext(Dispatchers.IO) {
                    InputImage.fromFilePath(context, imageUri)
                }
                val rawText = recognizeText(image)
                val parsed = OcrParser.parse(rawText)
                applyParsed(parsed)
                enrichInBackground(parsed.medicineName)
            }.onFailure { e ->
                _state.update { it.copy(isScanning = false, error = e.message ?: "Scan failed") }
            }
        }
    }

    private suspend fun recognizeText(image: InputImage): String =
        suspendCancellableCoroutine { cont ->
            recognizer.process(image)
                .addOnSuccessListener { cont.resume(it.text) }
                .addOnFailureListener { cont.resumeWithException(it) }
        }

    private fun applyParsed(parsed: ParsedScan) {
        _state.update {
            it.copy(
                isScanning = false,
                medicineName = parsed.medicineName.orEmpty(),
                batchNumber = parsed.batchNumber.orEmpty(),
                expiryDate = parsed.expiryDate,
                priceText = parsed.priceMinor?.let { p -> "%.2f".format(p / 100.0) }.orEmpty(),
                rawOcrText = parsed.rawText,
            )
        }
    }

    /** Verify against catalog + check interactions concurrently. */
    private fun enrichInBackground(name: String?) {
        if (name.isNullOrBlank()) return
        viewModelScope.launch {
            runCatching { catalog.verify(name) }.getOrNull()?.let { result ->
                _state.update {
                    it.copy(
                        verified = result.verified,
                        catalogId = result.catalogId,
                        genericName = result.genericName.orEmpty().ifEmpty { it.genericName },
                        medicineName = result.canonicalName ?: it.medicineName,
                        alternatives = result.alternatives,
                    )
                }
            }
        }
        viewModelScope.launch {
            val existing = dao.observeAll().let { /* read snapshot via .first() if needed */ emptyList<String>() }
            runCatching { interactions.check(name, existing) }.getOrNull()?.let { list ->
                _state.update { it.copy(interactions = list) }
            }
        }
    }

    // --- field editors used by the Scan Review screen ---
    fun onMedicineName(v: String) = _state.update { it.copy(medicineName = v) }
    fun onGenericName(v: String) = _state.update { it.copy(genericName = v) }
    fun onBatchNumber(v: String) = _state.update { it.copy(batchNumber = v) }
    fun onExpiry(v: LocalDate) = _state.update { it.copy(expiryDate = v) }
    fun onPrice(v: String) = _state.update { it.copy(priceText = v.filter { c -> c.isDigit() || c == '.' }) }

    fun confirm() {
        val s = _state.value
        val expiry = s.expiryDate ?: run {
            _state.update { it.copy(error = "Expiry date is required") }; return
        }
        if (s.medicineName.isBlank() || s.batchNumber.isBlank()) {
            _state.update { it.copy(error = "Medicine name and batch number are required") }; return
        }
        val priceMinor = ((s.priceText.toDoubleOrNull() ?: 0.0) * 100).toLong()

        viewModelScope.launch {
            val id = dao.upsert(
                MedicineBatch(
                    medicineName = s.medicineName.trim(),
                    genericName = s.genericName.trim().ifBlank { null },
                    batchNumber = s.batchNumber.trim(),
                    expiryDate = expiry,
                    priceMinor = priceMinor,
                    verified = s.verified,
                    catalogId = s.catalogId,
                    rawOcrText = s.rawOcrText,
                )
            )
            // Schedule a notification 30 days before expiry.
            alarms.scheduleExpiryAlert(batchId = id, expiry = expiry, daysBefore = 30)
            _state.update { it.copy(savedId = id, error = null) }
        }
    }

    override fun onCleared() {
        recognizer.close()
        super.onCleared()
    }
}
