import 'package:flutter/material.dart';

/// Фирменная тёмная тема YaniVPN.
///
/// Палитра совпадает с веб-панелью (глубокий тёмно-синий + синий бренда),
/// плюс градиент «синий → циан» для акцентов: кнопки подключения, прогресса
/// квоты и логотипа.
const kBrandBlue = Color(0xFF3987E5);
const kBrandCyan = Color(0xFF35D6E8);
const kBg = Color(0xFF060B16); // фон ещё глубже, чем у панели
const kSurface = Color(0xFF0B1120);
const kSurfaceRaised = Color(0xFF111A2E);
const kBorder = Color(0xFF1E2A44);
const kTextDim = Color(0xFF8B98B4);
const kSuccess = Color(0xFF34D399);
const kDanger = Color(0xFFF87171);

/// Главный градиент бренда — им светятся кнопка подключения и логотип.
const kBrandGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [kBrandBlue, kBrandCyan],
);

ThemeData buildTheme() {
  final base = ThemeData.dark(useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: kBg,
    colorScheme: base.colorScheme.copyWith(
      primary: kBrandBlue,
      secondary: kBrandCyan,
      surface: kSurfaceRaised,
      error: kDanger,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      color: kSurfaceRaised.withValues(alpha: 0.72),
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: kBorder),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: kBrandBlue,
        foregroundColor: Colors.white,
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        padding: const EdgeInsets.symmetric(vertical: 16),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: kTextDim),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: kSurfaceRaised,
      contentTextStyle: const TextStyle(color: Colors.white),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: kBorder),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: kSurfaceRaised,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: kSurface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: kSurface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: kBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: kBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: kBrandBlue),
      ),
    ),
    dividerColor: kBorder,
  );
}

/// Фон экрана: мягкое свечение бренда сверху, как на лендингах.
/// Оборачивает контент любого экрана приложения.
class AppBackground extends StatelessWidget {
  const AppBackground({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: RadialGradient(
          center: Alignment(0, -0.9),
          radius: 1.3,
          colors: [Color(0xFF122448), kBg],
          stops: [0, 0.75],
        ),
      ),
      child: child,
    );
  }
}
