# Smart Scan Pharmacy — Android (Kotlin + Jetpack Compose)

Drop these files into a standard Android Studio project (`app/src/main/java/com/pharmacy/smartscan/...`) and add the dependencies below.

## Architecture

```
Camera → ML Kit Text Recognition → OcrParser → ScanReviewViewModel
                                                   │
                                                   ├─► CatalogVerifier   (RxNorm / local SQLite)
                                                   ├─► InteractionChecker (AI / OpenFDA)
                                                   └─► Room (MedicineBatch) ─► AlarmManager (T-30d)
```

- **MedicineBatch** — Room `@Entity` with a `LocalDate` expiry stored via a `TypeConverter`.
- **OcrParser** — pure-Kotlin regex/heuristics that turn raw OCR lines into `ParsedScan`.
- **ScanReviewViewModel** — owns OCR, enrichment (catalog + interactions), validation and save.
- **ScanReviewScreen** — Material 3 form where the user confirms before saving.
- **ExpiryAlarmScheduler / ExpiryAlertReceiver** — schedules an exact alarm 30 days before expiry and posts a notification.
- **PharmacyTheme** — health-focused teal & white Material 3 color scheme.

## Required Gradle dependencies

```kotlin
// app/build.gradle.kts
dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")

    // Room
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // ML Kit on-device text recognition
    implementation("com.google.mlkit:text-recognition:16.0.1")

    // CameraX (capture)
    implementation("androidx.camera:camera-camera2:1.4.0")
    implementation("androidx.camera:camera-lifecycle:1.4.0")
    implementation("androidx.camera:camera-view:1.4.0")

    // Networking for catalog / interactions
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-kotlinx-serialization:2.11.0")
}
```

## AndroidManifest essentials

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

<application ...>
    <receiver
        android:name=".worker.ExpiryAlertReceiver"
        android:exported="false" />
</application>
```

## Wiring it up (Application class)

```kotlin
val db = Room.databaseBuilder(context, AppDatabase::class.java, "pharmacy.db").build()
val vm = ScanReviewViewModel(
    dao = db.medicineBatchDao(),
    catalog = RxNormCatalogVerifier(retrofit),       // your impl
    interactions = AiInteractionChecker(retrofit),   // your impl
    alarms = ExpiryAlarmScheduler(context),
)
```

## Catalog verification (RxNorm)

`CatalogVerifier` is an interface — implement it against either:
- The free **RxNorm REST API** (`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=...`), or
- A bundled SQLite snapshot of medicines for offline use.

Return `verified = true` plus the `RXCUI` so the UI badge lights up.

## Drug interactions

`InteractionChecker` is an interface. Production implementations call:
- RxNav `/interaction/list.json?rxcuis=...` for known pairs, **or**
- An LLM endpoint that summarises severity & advice given the new + existing drugs.

The `ScanReviewScreen` already renders the returned list with severity chips.

## Dynamic pricing & generic alternatives

`CatalogVerifier.verify()` returns a list of `GenericAlternative(name, priceMinor)`. Hook this up to your back-end pricing endpoint or a partner pharmacy API — the `AlternativesCard` in the Scan Review screen renders them automatically.
