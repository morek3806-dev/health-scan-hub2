package com.pharmacy.smartscan.data

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import java.time.LocalDate
import java.time.format.DateTimeFormatter

class Converters {
    @TypeConverter fun fromDate(value: LocalDate?): String? = value?.format(DateTimeFormatter.ISO_DATE)
    @TypeConverter fun toDate(value: String?): LocalDate? = value?.let(LocalDate::parse)
}

@Database(entities = [MedicineBatch::class], version = 1, exportSchema = true)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun medicineBatchDao(): MedicineBatchDao
}
