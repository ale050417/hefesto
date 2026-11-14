import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

// Marco común de la app: idioma y tamaño de letra. Lo usan `main.dart` y los
// tests de pantallas, así lo que se prueba es exactamente lo que se publica
// (2026-11-14, pedido de Ale: que ninguna pantalla ni modal se vea roto).

/// Idioma de la app: castellano rioplatense, SIEMPRE (no depende del idioma
/// del teléfono). Con esto los componentes del sistema —calendario, reloj,
/// "Cancelar / Aceptar", el menú de copiar y pegar, el tooltip de "Atrás"—
/// salen en castellano igual que el resto de la app.
const appLocale = Locale('es', 'AR');

const appSupportedLocales = <Locale>[appLocale, Locale('es')];

const List<LocalizationsDelegate<Object?>> appLocalizationsDelegates =
    GlobalMaterialLocalizations.delegates;

/// Tope del tamaño de letra del sistema. Android deja agrandar hasta 2× y
/// iOS más todavía; con eso las tablas y los formularios del panel no entran
/// en ningún teléfono. Se respeta la preferencia hasta 1,3× (letra "grande"),
/// que es lo que las pantallas están probadas para soportar.
const double kMaxTextScale = 1.3;
const double kMinTextScale = 0.9;

/// `builder` del MaterialApp: aplica el tope de letra a toda la app
/// (pantallas, diálogos y hojas incluidos).
Widget appFrameBuilder(BuildContext context, Widget? child) =>
    MediaQuery.withClampedTextScaling(
      minScaleFactor: kMinTextScale,
      maxScaleFactor: kMaxTextScale,
      child: child ?? const SizedBox.shrink(),
    );
