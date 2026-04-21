package com.pharmacy.smartscan.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import java.time.LocalDate

/**
 * A scanned (or manually entered) batch of a medicine.
 *
 * One physical pack on a pharmacy shelf == one row.
 * The same medicine can have many batches (different expiry / batch numbers).
 */
@Entity(
    tableName = "medicine_batch",
    indices = [
        Index(value = ["batchNumber", "medicineName"], unique = true),
        Index(value = ["expiryDate"]),
    ],
)
data class MedicineBatch(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "medicineName")
    val medicineName: String,

    @ColumnInfo(name = "genericName")
    val genericName: String? = null,

    @ColumnInfo(name = "batchNumber")
    val batchNumber: String,

    /** ISO yyyy-MM-dd (stored as text via TypeConverter). */
    @ColumnInfo(name = "expiryDate")
    val expiryDate: LocalDate,

    /** Price in minor units (paise / cents) to avoid float errors. */
    @ColumnInfo(name = "priceMinor")
    val priceMinor: Long,

    @ColumnInfo(name = "currency")
    val currency: String = "INR",

    /** Did the catalog (RxNorm / local) confirm this medicine name? */
    @ColumnInfo(name = "verified")
    val verified: Boolean = false,

    /** RxNorm RXCUI or local catalog id, when verified. */
    @ColumnInfo(name = "catalogId")
    val catalogId: String? = null,

    @ColumnInfo(name = "rawOcrText")
    val rawOcrText: String? = null,

    @ColumnInfo(name = "createdAt")
    val createdAt: Long = System.currentTimeMillis(),
)
