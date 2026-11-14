import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Los tres modos de la tienda (mismos que la web): Oscuro, Claro y Luz
/// nocturna (cálido, descansa la vista).
enum HefestoThemeMode {
  dark('Oscuro', 'Fondo negro', Icons.dark_mode_rounded),
  light('Claro', 'Fondo blanco', Icons.light_mode_rounded),
  warm('Luz nocturna', 'Cálido, descansa la vista', Icons.nightlight_round);

  const HefestoThemeMode(this.label, this.hint, this.icon);
  final String label;
  final String hint;
  final IconData icon;
}

/// Paleta de la marca (globals.css de la web).
class Brand {
  Brand._();
  static const gold = Color(0xFFC9A84C);
  static const goldBright = Color(0xFFD4AF37);
  static const goldDeep = Color(0xFFA8863A);
  static const goldFg = Color(0xFF1A1505);

  static const success = Color(0xFF4CB782);
  static const warning = Color(0xFFD9A441);
  static const danger = Color(0xFFD96A5A);
  static const info = Color(0xFF5A9CD9);

  static const whatsapp = Color(0xFF25D366);

  static const goldGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [goldBright, goldDeep],
  );
}

/// Tokens semánticos de superficie/texto según el modo. Se leen con
/// `context.hc` en cualquier widget.
@immutable
class HefestoColors extends ThemeExtension<HefestoColors> {
  const HefestoColors({
    required this.bg,
    required this.surface1,
    required this.surface2,
    required this.surface3,
    required this.text,
    required this.textDim,
    required this.textFaint,
    required this.border,
    required this.borderStrong,
  });

  final Color bg;
  final Color surface1;
  final Color surface2;
  final Color surface3;
  final Color text;
  final Color textDim;
  final Color textFaint;
  final Color border;

  /// Borde que tiene que notarse: contorno de diálogos, menús y avisos
  /// (`--border-strong` de la web).
  final Color borderStrong;

  static const dark = HefestoColors(
    bg: Color(0xFF0A0A0F),
    surface1: Color(0xFF111118),
    surface2: Color(0xFF16161F),
    surface3: Color(0xFF1D1D28),
    text: Color(0xFFE8E6E0),
    textDim: Color(0xFF9B9AA6),
    textFaint: Color(0xFF62616E),
    border: Color(0x14FFFFFF),
    borderStrong: Color(0x24FFFFFF),
  );

  static const light = HefestoColors(
    bg: Color(0xFFF8F9FC),
    surface1: Color(0xFFFFFFFF),
    surface2: Color(0xFFEDEEF2),
    surface3: Color(0xFFE3E5EC),
    text: Color(0xFF18181F),
    textDim: Color(0xFF5B5B68),
    textFaint: Color(0xFF9A9AA6),
    border: Color(0x1A18181F),
    borderStrong: Color(0x2E18181F),
  );

  // Luz nocturna: fondo crema/ámbar, sin azules (descansa la vista de noche).
  static const warm = HefestoColors(
    bg: Color(0xFF1C1710),
    surface1: Color(0xFF251F15),
    surface2: Color(0xFF2E271A),
    surface3: Color(0xFF382F20),
    text: Color(0xFFF1E6D2),
    textDim: Color(0xFFB9A98C),
    textFaint: Color(0xFF7F7259),
    border: Color(0x1FF1E6D2),
    borderStrong: Color(0x33F1E6D2),
  );

  @override
  HefestoColors copyWith() => this;

  @override
  HefestoColors lerp(ThemeExtension<HefestoColors>? other, double t) {
    if (other is! HefestoColors) return this;
    return HefestoColors(
      bg: Color.lerp(bg, other.bg, t)!,
      surface1: Color.lerp(surface1, other.surface1, t)!,
      surface2: Color.lerp(surface2, other.surface2, t)!,
      surface3: Color.lerp(surface3, other.surface3, t)!,
      text: Color.lerp(text, other.text, t)!,
      textDim: Color.lerp(textDim, other.textDim, t)!,
      textFaint: Color.lerp(textFaint, other.textFaint, t)!,
      border: Color.lerp(border, other.border, t)!,
      borderStrong: Color.lerp(borderStrong, other.borderStrong, t)!,
    );
  }
}

extension HefestoContext on BuildContext {
  HefestoColors get hc => Theme.of(this).extension<HefestoColors>()!;
}

class AppTheme {
  AppTheme._();

  static const _body = 'Sora';
  static const _display = 'Orbitron';

  static HefestoColors colorsOf(HefestoThemeMode mode) => switch (mode) {
        HefestoThemeMode.dark => HefestoColors.dark,
        HefestoThemeMode.light => HefestoColors.light,
        HefestoThemeMode.warm => HefestoColors.warm,
      };

  /// Íconos de la barra de estado y de navegación del sistema para cada modo
  /// (claros sobre fondo oscuro y al revés). La app dibuja de borde a borde:
  /// las barras del sistema son transparentes.
  static SystemUiOverlayStyle overlayOf(HefestoThemeMode mode) {
    final isLight = mode == HefestoThemeMode.light;
    final icons = isLight ? Brightness.dark : Brightness.light;
    return SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: icons,
      // iOS lo define al revés: es el brillo del FONDO de la barra.
      statusBarBrightness: isLight ? Brightness.light : Brightness.dark,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarDividerColor: Colors.transparent,
      systemNavigationBarIconBrightness: icons,
      systemNavigationBarContrastEnforced: false,
    );
  }

  static ThemeData of(HefestoThemeMode mode) {
    final c = colorsOf(mode);
    final isLight = mode == HefestoThemeMode.light;

    Color tint(Color color, double alpha, Color over) =>
        Color.alphaBlend(color.withValues(alpha: alpha), over);

    // Todos los roles de Material 3 definidos a mano. Si se dejan sin definir,
    // Flutter los completa con el color del TEXTO (bordes, divisores y
    // contornos blancos sobre el fondo negro) y los componentes estándar
    // —diálogos, menús, interruptores, calendario— quedan fuera de la marca.
    final scheme = ColorScheme(
      brightness: isLight ? Brightness.light : Brightness.dark,
      primary: Brand.gold,
      onPrimary: Brand.goldFg,
      primaryContainer: tint(Brand.gold, 0.18, c.surface1),
      onPrimaryContainer: c.text,
      secondary: Brand.goldBright,
      onSecondary: Brand.goldFg,
      secondaryContainer: tint(Brand.gold, 0.2, c.surface2),
      onSecondaryContainer: c.text,
      tertiary: Brand.info,
      onTertiary: Colors.white,
      tertiaryContainer: tint(Brand.info, 0.18, c.surface1),
      onTertiaryContainer: c.text,
      error: Brand.danger,
      onError: Colors.white,
      errorContainer: tint(Brand.danger, 0.16, c.surface1),
      onErrorContainer: Brand.danger,
      surface: c.surface1,
      onSurface: c.text,
      onSurfaceVariant: c.textDim,
      surfaceDim: c.bg,
      surfaceBright: c.surface3,
      surfaceContainerLowest: c.bg,
      surfaceContainerLow: c.surface1,
      surfaceContainer: c.surface2,
      surfaceContainerHigh: c.surface2,
      surfaceContainerHighest: c.surface3,
      outline: c.textFaint,
      outlineVariant: c.border,
      shadow: Colors.black,
      scrim: Colors.black,
      inverseSurface: c.text,
      onInverseSurface: c.bg,
      inversePrimary: Brand.goldDeep,
      // Sin teñido dorado en las superficies elevadas (diálogos, hojas, menús).
      surfaceTint: Colors.transparent,
    );

    TextStyle body(double size, FontWeight w, Color color, {double? height}) =>
        TextStyle(
          fontFamily: _body,
          fontSize: size,
          fontWeight: w,
          color: color,
          height: height,
        );

    final textTheme = TextTheme(
      displayLarge: TextStyle(
        fontFamily: _display,
        fontSize: 34,
        fontWeight: FontWeight.w800,
        color: c.text,
        height: 1.1,
      ),
      headlineMedium: TextStyle(
        fontFamily: _display,
        fontSize: 24,
        fontWeight: FontWeight.w800,
        color: c.text,
        height: 1.15,
      ),
      headlineSmall: TextStyle(
        fontFamily: _display,
        fontSize: 19,
        fontWeight: FontWeight.w700,
        color: c.text,
      ),
      titleLarge: body(18, FontWeight.w700, c.text),
      titleMedium: body(15, FontWeight.w600, c.text),
      titleSmall: body(13, FontWeight.w600, c.text),
      bodyLarge: body(15, FontWeight.w400, c.text, height: 1.5),
      bodyMedium: body(13.5, FontWeight.w400, c.textDim, height: 1.45),
      bodySmall: body(12, FontWeight.w400, c.textDim),
      labelLarge: body(14, FontWeight.w600, c.text),
      labelMedium: body(12, FontWeight.w500, c.textDim),
      labelSmall: body(10.5, FontWeight.w600, c.textFaint),
    );

    // --- Piezas que comparten varios componentes ---

    final barrier = Colors.black.withValues(alpha: isLight ? 0.45 : 0.62);

    /// Contorno de las superficies flotantes (diálogo, menú, calendario).
    ShapeBorder floating(double radius) => RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
          side: BorderSide(color: c.borderStrong),
        );

    final buttonShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(14));
    final buttonText = body(14, FontWeight.w700, c.text);

    /// Botones de texto de los diálogos y selectores ("Cancelar" / "Aceptar").
    final dialogAction = TextButton.styleFrom(
      foregroundColor: Brand.gold,
      textStyle: buttonText,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    );

    OutlineInputBorder inputBorder(Color color, [double width = 1]) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: color, width: width),
        );

    final inputTheme = InputDecorationTheme(
      filled: true,
      fillColor: c.surface2,
      hintStyle: body(14, FontWeight.w400, c.textFaint),
      // El rótulo de un campo vacío va apagado: brillante se confundía con un
      // valor ya cargado.
      labelStyle: TextStyle(color: c.textDim),
      floatingLabelStyle: WidgetStateTextStyle.resolveWith((states) {
        if (states.contains(WidgetState.error)) return const TextStyle(color: Brand.danger);
        if (states.contains(WidgetState.focused)) return const TextStyle(color: Brand.gold);
        return TextStyle(color: c.textDim);
      }),
      helperStyle: body(11.5, FontWeight.w400, c.textFaint),
      helperMaxLines: 3,
      errorStyle: body(11.5, FontWeight.w500, Brand.danger),
      // Un mensaje de validación largo baja de línea en vez de cortarse.
      errorMaxLines: 3,
      prefixIconColor: c.textDim,
      suffixIconColor: c.textDim,
      prefixStyle: body(14.5, FontWeight.w500, c.textDim),
      suffixStyle: body(14.5, FontWeight.w500, c.textDim),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: inputBorder(c.border),
      enabledBorder: inputBorder(c.border),
      disabledBorder: inputBorder(c.border),
      focusedBorder: inputBorder(Brand.gold, 1.4),
      errorBorder: inputBorder(Brand.danger.withValues(alpha: 0.7)),
      focusedErrorBorder: inputBorder(Brand.danger, 1.4),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: scheme.brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: c.bg,
      canvasColor: c.bg,
      fontFamily: _body,
      textTheme: textTheme,
      extensions: [c],
      dividerColor: c.border,
      splashFactory: InkSparkle.splashFactory,
      appBarTheme: AppBarTheme(
        backgroundColor: c.bg,
        foregroundColor: c.text,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge,
        systemOverlayStyle: overlayOf(mode),
      ),
      cardTheme: CardThemeData(
        color: c.surface1,
        elevation: 0,
        margin: EdgeInsets.zero,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(color: c.border),
        ),
      ),
      inputDecorationTheme: inputTheme,
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: Brand.gold,
        selectionColor: Brand.gold.withValues(alpha: 0.32),
        selectionHandleColor: Brand.gold,
      ),
      dividerTheme: DividerThemeData(color: c.border, thickness: 1),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(foregroundColor: c.text),
      ),
      listTileTheme: ListTileThemeData(iconColor: c.textDim, textColor: c.text),

      // --- Botones ---
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: Brand.gold,
          foregroundColor: Brand.goldFg,
          disabledBackgroundColor: c.surface3,
          disabledForegroundColor: c.textFaint,
          textStyle: buttonText,
          shape: buttonShape,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: Brand.gold,
          disabledForegroundColor: c.textFaint,
          textStyle: buttonText,
          shape: buttonShape,
        ).copyWith(
          side: WidgetStateProperty.resolveWith(
            (states) => BorderSide(
              color: states.contains(WidgetState.disabled)
                  ? c.border
                  : Brand.gold.withValues(alpha: 0.45),
            ),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: Brand.gold,
          disabledForegroundColor: c.textFaint,
          textStyle: buttonText,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: Brand.gold,
        foregroundColor: Brand.goldFg,
        elevation: 3,
        focusElevation: 3,
        hoverElevation: 3,
        highlightElevation: 4,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        extendedTextStyle: body(14.5, FontWeight.w700, Brand.goldFg),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.selected) ? Brand.gold : Colors.transparent,
          ),
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) return c.textFaint;
            return states.contains(WidgetState.selected) ? Brand.goldFg : c.text;
          }),
          iconColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) return c.textFaint;
            return states.contains(WidgetState.selected) ? Brand.goldFg : c.textDim;
          }),
          side: WidgetStatePropertyAll(BorderSide(color: c.borderStrong)),
          shape: WidgetStatePropertyAll(buttonShape),
          textStyle: WidgetStatePropertyAll(body(13.5, FontWeight.w700, c.text)),
        ),
      ),

      // --- Controles ---
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          final on = states.contains(WidgetState.selected);
          if (states.contains(WidgetState.disabled)) return on ? c.surface1 : c.textFaint;
          return on ? Brand.goldFg : c.textDim;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          final on = states.contains(WidgetState.selected);
          if (states.contains(WidgetState.disabled)) return on ? c.textFaint : c.surface2;
          return on ? Brand.gold : c.surface3;
        }),
        trackOutlineColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected) ? Colors.transparent : c.borderStrong,
        ),
        overlayColor: WidgetStatePropertyAll(Brand.gold.withValues(alpha: 0.1)),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected) ? Brand.gold : Colors.transparent,
        ),
        checkColor: const WidgetStatePropertyAll(Brand.goldFg),
        side: BorderSide(color: c.textFaint, width: 1.6),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5)),
      ),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected) ? Brand.gold : c.textFaint,
        ),
      ),
      sliderTheme: SliderThemeData(
        activeTrackColor: Brand.gold,
        inactiveTrackColor: c.surface3,
        thumbColor: Brand.gold,
        overlayColor: Brand.gold.withValues(alpha: 0.14),
        valueIndicatorColor: c.surface3,
        valueIndicatorTextStyle: body(12, FontWeight.w700, c.text),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: Brand.gold,
        linearTrackColor: c.surface3,
        circularTrackColor: Colors.transparent,
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: Brand.gold,
        unselectedLabelColor: c.textDim,
        indicatorColor: Brand.gold,
        dividerColor: c.border,
        labelStyle: body(13.5, FontWeight.w700, Brand.gold),
        unselectedLabelStyle: body(13.5, FontWeight.w600, c.textDim),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: c.surface1,
        surfaceTintColor: Colors.transparent,
        indicatorColor: Brand.gold.withValues(alpha: 0.18),
        height: 68,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (s) => body(
            11,
            s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
            s.contains(WidgetState.selected) ? Brand.gold : c.textDim,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (s) => IconThemeData(
            size: 24,
            color: s.contains(WidgetState.selected) ? Brand.gold : c.textDim,
          ),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: c.surface2,
        selectedColor: Brand.gold.withValues(alpha: 0.2),
        surfaceTintColor: Colors.transparent,
        checkmarkColor: Brand.gold,
        deleteIconColor: c.textDim,
        side: BorderSide(color: c.border),
        labelStyle: body(12.5, FontWeight.w600, c.text),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      ),
      badgeTheme: BadgeThemeData(
        backgroundColor: Brand.danger,
        textColor: Colors.white,
        textStyle: body(10.5, FontWeight.w700, Colors.white),
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: c.surface3,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: c.borderStrong),
        ),
        textStyle: body(12, FontWeight.w500, c.text),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      ),

      // --- Modales: diálogos, hojas, menús, avisos, calendario y reloj ---
      dialogTheme: DialogThemeData(
        backgroundColor: c.surface1,
        surfaceTintColor: Colors.transparent,
        elevation: 12,
        shadowColor: Colors.black,
        shape: floating(24),
        // Sora en vez de la tipografía de títulos (Orbitron): las preguntas
        // largas ("¿Eliminar el cupón…?") se leían mal y los signos salían raros.
        titleTextStyle: body(18, FontWeight.w700, c.text, height: 1.3),
        contentTextStyle: body(14, FontWeight.w400, c.textDim, height: 1.45),
        actionsPadding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
        // Más ancho útil en teléfonos chicos (el valor por defecto deja 280 dp
        // en una pantalla de 360).
        insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
        barrierColor: barrier,
        iconColor: Brand.gold,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: c.surface1,
        modalBackgroundColor: c.surface1,
        surfaceTintColor: Colors.transparent,
        modalBarrierColor: barrier,
        elevation: 0,
        modalElevation: 0,
        dragHandleColor: c.textFaint,
        dragHandleSize: const Size(40, 4),
        // Recorta el contenido a las esquinas redondeadas (sin esto, un fondo
        // propio dentro de la hoja las tapaba).
        clipBehavior: Clip.antiAlias,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
        ),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: c.surface2,
        surfaceTintColor: Colors.transparent,
        elevation: 10,
        shadowColor: Colors.black,
        shape: floating(16),
        textStyle: body(14, FontWeight.w500, c.text),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => body(
            14,
            FontWeight.w500,
            states.contains(WidgetState.disabled) ? c.textFaint : c.text,
          ),
        ),
        iconColor: c.textDim,
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: c.surface3,
        contentTextStyle: body(13.5, FontWeight.w500, c.text),
        // Sin esto la acción ("Deshacer") salía oscura sobre fondo oscuro.
        actionTextColor: Brand.gold,
        disabledActionTextColor: c.textFaint,
        closeIconColor: c.textDim,
        elevation: 6,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: c.borderStrong),
        ),
      ),
      datePickerTheme: DatePickerThemeData(
        backgroundColor: c.surface1,
        surfaceTintColor: Colors.transparent,
        elevation: 12,
        shadowColor: Colors.black,
        shape: floating(24),
        headerBackgroundColor: c.surface1,
        headerForegroundColor: c.text,
        headerHelpStyle: body(12.5, FontWeight.w600, c.textDim),
        headerHeadlineStyle: body(26, FontWeight.w700, c.text),
        weekdayStyle: body(12, FontWeight.w700, c.textFaint),
        dayStyle: body(13.5, FontWeight.w500, c.text),
        dayForegroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return Brand.goldFg;
          if (states.contains(WidgetState.disabled)) return c.textFaint;
          return c.text;
        }),
        dayBackgroundColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected) ? Brand.gold : Colors.transparent,
        ),
        todayForegroundColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected) ? Brand.goldFg : Brand.gold,
        ),
        todayBackgroundColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected) ? Brand.gold : Colors.transparent,
        ),
        todayBorder: const BorderSide(color: Brand.gold),
        yearStyle: body(14, FontWeight.w600, c.text),
        yearForegroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return Brand.goldFg;
          if (states.contains(WidgetState.disabled)) return c.textFaint;
          return c.text;
        }),
        yearBackgroundColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected) ? Brand.gold : Colors.transparent,
        ),
        dayOverlayColor: WidgetStatePropertyAll(Brand.gold.withValues(alpha: 0.12)),
        yearOverlayColor: WidgetStatePropertyAll(Brand.gold.withValues(alpha: 0.12)),
        dividerColor: c.border,
        subHeaderForegroundColor: c.textDim,
        cancelButtonStyle: dialogAction,
        confirmButtonStyle: dialogAction,
        inputDecorationTheme: inputTheme,
      ),
      timePickerTheme: TimePickerThemeData(
        backgroundColor: c.surface1,
        elevation: 12,
        shape: floating(24),
        hourMinuteShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        hourMinuteColor: WidgetStateColor.resolveWith(
          (states) => states.contains(WidgetState.selected) ? Brand.gold : c.surface2,
        ),
        hourMinuteTextColor: WidgetStateColor.resolveWith(
          (states) => states.contains(WidgetState.selected) ? Brand.goldFg : c.text,
        ),
        dialBackgroundColor: c.surface2,
        dialHandColor: Brand.gold,
        dialTextColor: WidgetStateColor.resolveWith(
          (states) => states.contains(WidgetState.selected) ? Brand.goldFg : c.text,
        ),
        dialTextStyle: body(14, FontWeight.w600, c.text),
        entryModeIconColor: c.textDim,
        helpTextStyle: body(12.5, FontWeight.w600, c.textDim),
        timeSelectorSeparatorColor: WidgetStatePropertyAll(c.textDim),
        cancelButtonStyle: dialogAction,
        confirmButtonStyle: dialogAction,
        inputDecorationTheme: inputTheme,
      ),
    );
  }
}
