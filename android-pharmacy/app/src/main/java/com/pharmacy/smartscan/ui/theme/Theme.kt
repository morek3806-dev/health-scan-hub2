package com.pharmacy.smartscan.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Teal700 = Color(0xFF00796B)
private val Teal500 = Color(0xFF009688)
private val Teal200 = Color(0xFF80CBC4)
private val MintBg  = Color(0xFFF1FAF8)
private val Ink     = Color(0xFF0F2A2E)

private val LightHealth = lightColorScheme(
    primary = Teal700,
    onPrimary = Color.White,
    primaryContainer = Teal200,
    onPrimaryContainer = Ink,
    secondary = Teal500,
    background = MintBg,
    onBackground = Ink,
    surface = Color.White,
    onSurface = Ink,
)

private val DarkHealth = darkColorScheme(
    primary = Teal200,
    onPrimary = Ink,
    primaryContainer = Teal700,
    onPrimaryContainer = Color.White,
    background = Color(0xFF06181A),
    surface = Color(0xFF0B2326),
)

@Composable
fun PharmacyTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkHealth else LightHealth,
        content = content,
    )
}
