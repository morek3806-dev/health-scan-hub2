package com.pharmacy.smartscan.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate

@Dao
interface MedicineBatchDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(batch: MedicineBatch): Long

    @Update
    suspend fun update(batch: MedicineBatch)

    @Query("SELECT * FROM medicine_batch ORDER BY expiryDate ASC")
    fun observeAll(): Flow<List<MedicineBatch>>

    @Query("SELECT * FROM medicine_batch WHERE expiryDate <= :threshold")
    suspend fun expiringBefore(threshold: LocalDate): List<MedicineBatch>

    @Query("SELECT * FROM medicine_batch WHERE id = :id")
    suspend fun byId(id: Long): MedicineBatch?
}
