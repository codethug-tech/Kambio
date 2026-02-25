import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// ============================================================
// Kambio Design System — Stitch spec
// Font: Plus Jakarta Sans
// Primary: Prosperous Green
// Accent: Electric Blue
// Background: Dark Charcoal
// ============================================================

class KColors {
  // Brand
  static const green = Color(0xFF00E676); // Prosperous Green
  static const blue = Color(0xFF2979FF); // Electric Blue
  static const greenDark = Color(0xFF00B248);

  // Backgrounds
  static const bg = Color(0xFF0D0D0D); // Near-black
  static const surface = Color(0xFF1A1A1A); // Card / surface
  static const surface2 = Color(0xFF242424); // Input / chip
  static const divider = Color(0xFF2A2A2A);

  // Text
  static const textPrimary = Color(0xFFFFFFFF);
  static const textSecondary = Color(0xFF9E9E9E);
  static const textHint = Color(0xFF616161);

  // Semantic
  static const error = Color(0xFFFF5252);
  static const warning = Color(0xFFFFCA28);
  static const success = green;
}

class KTextStyles {
  static final h1 = GoogleFonts.plusJakartaSans(
    fontSize: 28,
    fontWeight: FontWeight.w800,
    color: KColors.textPrimary,
  );
  static final h2 = GoogleFonts.plusJakartaSans(
    fontSize: 22,
    fontWeight: FontWeight.w700,
    color: KColors.textPrimary,
  );
  static final h3 = GoogleFonts.plusJakartaSans(
    fontSize: 18,
    fontWeight: FontWeight.w600,
    color: KColors.textPrimary,
  );
  static final body = GoogleFonts.plusJakartaSans(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: KColors.textPrimary,
  );
  static final bodySmall = GoogleFonts.plusJakartaSans(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    color: KColors.textSecondary,
  );
  static final label = GoogleFonts.plusJakartaSans(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    color: KColors.textPrimary,
  );
  static final caption = GoogleFonts.plusJakartaSans(
    fontSize: 11,
    fontWeight: FontWeight.w500,
    color: KColors.textSecondary,
  );
}

ThemeData kambioTheme() {
  final base = ThemeData.dark();
  return base.copyWith(
    scaffoldBackgroundColor: KColors.bg,
    colorScheme: const ColorScheme.dark(
      primary: KColors.green,
      secondary: KColors.blue,
      surface: KColors.surface,
      error: KColors.error,
    ),
    textTheme: GoogleFonts.plusJakartaSansTextTheme(
      base.textTheme,
    ).apply(bodyColor: KColors.textPrimary, displayColor: KColors.textPrimary),
    appBarTheme: AppBarTheme(
      backgroundColor: KColors.bg,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: KTextStyles.h3,
      iconTheme: const IconThemeData(color: KColors.textPrimary),
    ),
    cardTheme: CardThemeData(
      color: KColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: KColors.surface2,
      hintStyle: KTextStyles.body.copyWith(color: KColors.textHint),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: KColors.green, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: KColors.green,
        foregroundColor: Colors.black,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: KTextStyles.label.copyWith(
          fontSize: 15,
          fontWeight: FontWeight.w700,
        ),
        elevation: 0,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: KColors.green),
    ),
    dividerColor: KColors.divider,
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: KColors.surface,
      selectedItemColor: KColors.green,
      unselectedItemColor: KColors.textSecondary,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),
    chipTheme: ChipThemeData(
      backgroundColor: KColors.surface2,
      selectedColor: KColors.green.withValues(alpha: 0.2),
      labelStyle: KTextStyles.bodySmall,
      side: BorderSide.none,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
  );
}
