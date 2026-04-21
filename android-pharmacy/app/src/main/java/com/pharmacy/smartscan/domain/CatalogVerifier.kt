package com.pharmacy.smartscan.domain

/**
 * Verifies a parsed medicine name against a catalog (RxNorm REST API or
 * an offline SQLite catalog bundled with the app). Returns a normalized
 * name and catalog id when found.
 */
interface CatalogVerifier {
    suspend fun verify(name: String): VerificationResult
}

data class VerificationResult(
    val verified: Boolean,
    val canonicalName: String? = null,
    val genericName: String? = null,
    val catalogId: String? = null,
    val alternatives: List<GenericAlternative> = emptyList(),
)

data class GenericAlternative(
    val name: String,
    val priceMinor: Long,
    val currency: String = "INR",
)
