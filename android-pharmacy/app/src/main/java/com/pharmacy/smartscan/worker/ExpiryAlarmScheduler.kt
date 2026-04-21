package com.pharmacy.smartscan.worker

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.time.LocalDate
import java.time.ZoneId

/**
 * Schedules an exact AlarmManager wake-up that fires 30 days before a
 * medicine batch expires. The receiver builds a Material 3 notification.
 */
class ExpiryAlarmScheduler(private val context: Context) {

    fun scheduleExpiryAlert(batchId: Long, expiry: LocalDate, daysBefore: Int = 30) {
        val triggerDate = expiry.minusDays(daysBefore.toLong())
        val triggerAtMillis = triggerDate
            .atTime(9, 0)
            .atZone(ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli()
        if (triggerAtMillis <= System.currentTimeMillis()) return

        val intent = Intent(context, ExpiryAlertReceiver::class.java).apply {
            putExtra(ExpiryAlertReceiver.EXTRA_BATCH_ID, batchId)
        }
        val pi = PendingIntent.getBroadcast(
            context,
            batchId.toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi)
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi)
        }
    }
}
