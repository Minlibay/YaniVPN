import 'package:flutter/material.dart';

/// Тёмная тема в цветах панели YaniVPN.
const kBrandBlue = Color(0xFF3987E5);
const kSurface = Color(0xFF0B1120);
const kSurfaceRaised = Color(0xFF111A2E);
const kBorder = Color(0xFF1E2A44);

ThemeData buildTheme() {
  final base = ThemeData.dark(useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: kSurface,
    colorScheme: base.colorScheme.copyWith(
      primary: kBrandBlue,
      surface: kSurfaceRaised,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: kSurface,
      elevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      color: kSurfaceRaised,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: kBorder),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: kBrandBlue,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.symmetric(vertical: 16),
      ),
    ),
  );
}
