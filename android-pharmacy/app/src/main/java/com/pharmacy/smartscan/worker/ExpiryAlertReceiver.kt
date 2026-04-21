package com.pharmacy.smartscan.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat

class ExpiryAlertReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val batchId = intent.getLongExtra(EXTRA_BATCH_ID, -1L)
        ensureChannel(context)

        val openIntent = context.packageManager
            .getLaunchIntentForPackage(context.packageName)
            ?.apply { putExtra(EXTRA_BATCH_ID, batchId) }
        val contentPi = PendingIntent.getActivity(
            context, batchId.toInt(), openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Medicine expiring soon")
            .setContentText("A batch in your inventory expires in 30 days. Tap to review.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(contentPi)
            .build()

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(batchId.toInt(), notification)
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "Expiry alerts",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply { description = "Warns 30 days before a medicine batch expires." }
        )
    }

    companion object {
        const val EXTRA_BATCH_ID = "batch_id"
        private const val CHANNEL_ID = "expiry_alerts"
    }
}
