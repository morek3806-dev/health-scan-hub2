package com.pharmacy.smartscan.domain

import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Best-effort parser that turns raw ML Kit Text Recognition output into
 * a structured [ParsedScan]. The user always reviews the result before save.
 */
data class ParsedScan(
    val medicineName: String? = null,
    val batchNumber: String? = null,
    val expiryDate: LocalDate? = null,
    val priceMinor: Long? = null,
    val rawText: String,
)

object OcrParser {

    private val batchRegex = Regex("""(?i)\b(?:batch|b\.?no\.?|lot)\s*[:#-]?\s*([A-Z0-9\-]{3,})""")
    private val priceRegex = Regex("""(?i)(?:mrp|price|₹|rs\.?|\$)\s*[:.]?\s*([0-9]+(?:\.[0-9]{1,2})?)""")
    // Matches "EXP 11/2027", "Exp: 11-27", "EXPIRY 2027-11", "EXP NOV 2027"
    private val expiryRegex = Regex(
        """(?i)(?:exp(?:iry)?|use\s*before|best\s*before)\s*[:.]?\s*([A-Za-z0-9 /\-]{4,12})"""
    )

    fun parse(rawText: String): ParsedScan {
        val lines = rawText.lines().map { it.trim() }.filter { it.isNotBlank() }

        val medicine = guessMedicineName(lines)
        val batch = batchRegex.find(rawText)?.groupValues?.getOrNull(1)?.trim()
        val expiry = expiryRegex.find(rawText)?.groupValues?.getOrNull(1)?.let(::parseExpiry)
        val priceMinor = priceRegex.find(rawText)
            ?.groupValues?.getOrNull(1)
            ?.toDoubleOrNull()
            ?.let { (it * 100).toLong() }

        return ParsedScan(
            medicineName = medicine,
            batchNumber = batch,
            expiryDate = expiry,
            priceMinor = priceMinor,
            rawText = rawText,
        )
    }

    /** Heuristic: medicine name is usually the longest fully-uppercase line near the top. */
    private fun guessMedicineName(lines: List<String>): String? =
        lines.take(8)
            .filter { it.length in 3..40 && it.any(Char::isLetter) }
            .maxByOrNull { line ->
                val upperRatio = line.count { it.isUpperCase() }.toDouble() /
                    line.count(Char::isLetter).coerceAtLeast(1)
                (upperRatio * 100).toInt() + line.length / 4
            }
            ?.replace(Regex("[^A-Za-z0-9 \\-]"), "")
            ?.trim()

    private fun parseExpiry(token: String): LocalDate? {
        val cleaned = token.trim().uppercase(Locale.ROOT).replace('.', '/').replace('-', '/')

        val patterns = listOf(
            "MM/yyyy", "MM/yy", "yyyy/MM", "MMM yyyy", "MMM yy", "dd/MM/yyyy"
        )
        for (p in patterns) {
            runCatching {
                val fmt = DateTimeFormatter.ofPattern(p, Locale.ENGLISH)
                return if (p.contains("dd")) {
                    LocalDate.parse(cleaned, fmt)
                } else {
                    YearMonth.parse(cleaned, fmt).atEndOfMonth()
                }
            }
        }
        return null
    }
}
