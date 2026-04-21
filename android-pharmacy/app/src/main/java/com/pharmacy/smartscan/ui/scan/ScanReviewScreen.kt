package com.pharmacy.smartscan.ui.scan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.pharmacy.smartscan.domain.DrugInteraction
import com.pharmacy.smartscan.domain.GenericAlternative
import com.pharmacy.smartscan.domain.Severity
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScanReviewScreen(
    viewModel: ScanReviewViewModel,
    onSaved: (Long) -> Unit,
) {
    val state by viewModel.state.collectAsState()

    state.savedId?.let(onSaved)

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Review scanned medicine", fontWeight = FontWeight.SemiBold) })
        },
        bottomBar = {
            Button(
                onClick = viewModel::confirm,
                enabled = !state.isScanning,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
                    .height(52.dp),
            ) { Text("Confirm & save to inventory") }
        },
    ) { padding ->
        if (state.isScanning) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator()
                    Spacer(Modifier.height(12.dp))
                    Text("Reading the bill…", color = MaterialTheme.colorScheme.onBackground)
                }
            }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(padding)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            VerificationBanner(verified = state.verified, catalogId = state.catalogId)

            OutlinedTextField(
                value = state.medicineName,
                onValueChange = viewModel::onMedicineName,
                label = { Text("Medicine name") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            OutlinedTextField(
                value = state.genericName,
                onValueChange = viewModel::onGenericName,
                label = { Text("Generic name (optional)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            OutlinedTextField(
                value = state.batchNumber,
                onValueChange = viewModel::onBatchNumber,
                label = { Text("Batch number") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            OutlinedTextField(
                value = state.expiryDate?.format(DateTimeFormatter.ISO_DATE).orEmpty(),
                onValueChange = { runCatching { LocalDate.parse(it) }.getOrNull()?.let(viewModel::onExpiry) },
                label = { Text("Expiry date (yyyy-MM-dd)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            OutlinedTextField(
                value = state.priceText,
                onValueChange = viewModel::onPrice,
                label = { Text("Price") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )

            if (state.alternatives.isNotEmpty()) {
                AlternativesCard(state.alternatives)
            }
            if (state.interactions.isNotEmpty()) {
                InteractionsCard(state.interactions)
            }

            state.error?.let {
                Text(it, color = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@Composable
private fun VerificationBanner(verified: Boolean, catalogId: String?) {
    val container = if (verified) MaterialTheme.colorScheme.primaryContainer
    else MaterialTheme.colorScheme.surfaceVariant
    Card(colors = CardDefaults.cardColors(containerColor = container)) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Icon(
                imageVector = if (verified) Icons.Filled.CheckCircle else Icons.Filled.Warning,
                contentDescription = null,
                tint = if (verified) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.tertiary,
            )
            Column {
                Text(
                    if (verified) "Verified in catalog" else "Not yet verified",
                    fontWeight = FontWeight.SemiBold,
                )
                if (verified && catalogId != null) {
                    Text("RXCUI $catalogId", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun AlternativesCard(items: List<GenericAlternative>) {
    Card {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Generic alternatives", fontWeight = FontWeight.SemiBold)
            items.forEach { alt ->
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(alt.name)
                    Text("${alt.currency} %.2f".format(alt.priceMinor / 100.0))
                }
            }
        }
    }
}

@Composable
private fun InteractionsCard(items: List<DrugInteraction>) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Drug interactions", fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onErrorContainer)
            items.forEach { i ->
                Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    AssistChip(
                        onClick = {},
                        label = { Text(i.severity.name) },
                    )
                    Column {
                        Text("With ${i.withDrug}", fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.onErrorContainer)
                        Text(i.description, color = MaterialTheme.colorScheme.onErrorContainer)
                    }
                }
            }
        }
    }
}

private val Severity.color: Color
    @Composable get() = when (this) {
        Severity.MINOR -> MaterialTheme.colorScheme.tertiary
        Severity.MODERATE -> MaterialTheme.colorScheme.secondary
        Severity.MAJOR -> MaterialTheme.colorScheme.error
    }
