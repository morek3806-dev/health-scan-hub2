package com.pharmacy.smartscan.domain

/**
 * Calls a remote AI service (e.g. an LLM-backed endpoint, OpenFDA, or a
 * custom interaction API) to flag harmful combinations between
 * the new medicine and what the user already has on hand.
 */
interface InteractionChecker {
    suspend fun check(newDrug: String, existing: List<String>): List<DrugInteraction>
}

enum class Severity { MINOR, MODERATE, MAJOR }

data class DrugInteraction(
    val withDrug: String,
    val severity: Severity,
    val description: String,
)
