import 'package:flutter/material.dart';

class SchoolivaTheme {
  static ThemeData light() {
    final base = ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF1F5B4E),
        brightness: Brightness.light,
      ),
      useMaterial3: true,
      scaffoldBackgroundColor: const Color(0xFFF5F4EF),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFF1F5B4E),
        foregroundColor: Colors.white,
      ),
      cardTheme: CardThemeData(
        elevation: 2,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );

    return base.copyWith(
      textTheme: base.textTheme.apply(
        bodyColor: const Color(0xFF1D2D2B),
        displayColor: const Color(0xFF1D2D2B),
      ),
    );
  }
}
