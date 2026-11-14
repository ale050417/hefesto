// Utilidades compartidas por los tests de pantallas de Reportes, Ganancias y
// Calculadora: dibuja una pantalla con datos de ejemplo (sin red ni Supabase),
// falla si algo se desborda y, con SHOT_DIR=ruta, guarda una captura PNG.

import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/models.dart';
import 'package:hefesto/core/providers.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:intl/date_symbol_data_local.dart';

final String? shotDir = Platform.environment['SHOT_DIR'];

Future<void> _loadFont(String family, List<String> files) async {
  final loader = FontLoader(family);
  for (final f in files) {
    loader.addFont(File(f).readAsBytes().then((b) => ByteData.sublistView(b)));
  }
  await loader.load();
}

/// Para `setUpAll` de cada archivo de tests.
Future<void> analisisSetUp() async {
  await initializeDateFormatting('es_AR');
  if (shotDir != null) {
    Directory(shotDir!).createSync(recursive: true);
    await _loadFont('Orbitron', ['assets/fonts/Orbitron-Bold.ttf', 'assets/fonts/Orbitron-ExtraBold.ttf']);
    await _loadFont('Sora', [
      'assets/fonts/Sora-Regular.ttf',
      'assets/fonts/Sora-Medium.ttf',
      'assets/fonts/Sora-SemiBold.ttf',
      'assets/fonts/Sora-Bold.ttf',
    ]);
    final root = Platform.environment['FLUTTER_ROOT'];
    if (root != null) {
      await _loadFont('MaterialIcons', ['$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf']);
    }
  }
}

/// Usuario de ejemplo con permisos sobre [modules] (todos por defecto).
MeInfo meWith(
  List<String> modules, {
  String role = 'admin',
  Set<String> actions = const {'ver', 'crear', 'editar', 'eliminar'},
}) =>
    MeInfo.fromJson({
      'id': 'u1',
      'email': 'ale@hefesto.com',
      'fullName': 'Ale',
      'role': role,
      'isStaff': true,
      'permissions': {
        for (final m in modules) m: {for (final a in ['ver', 'crear', 'editar', 'eliminar']) a: actions.contains(a)},
      },
    });

GlobalKey? _lastBoundary;

/// Guarda una captura PNG del estado actual (solo con SHOT_DIR).
Future<void> snap(WidgetTester tester, String name) async {
  final dir = shotDir;
  final key = _lastBoundary;
  if (dir == null || key == null) return;
  await tester.runAsync(() async {
    final boundary = key.currentContext!.findRenderObject() as RenderRepaintBoundary;
    final image = await boundary.toImage(pixelRatio: 1.2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    await File('$dir/$name.png').writeAsBytes(bytes!.buffer.asUint8List());
  });
}

/// Dibuja [screen] y deja pasar unos frames (sin pumpAndSettle: los esqueletos
/// animan para siempre). Falla si alguna excepción (¿overflow?) se lanzó.
Future<void> showScreen(
  WidgetTester tester,
  String name,
  Widget screen, {
  double width = 392,
  double height = 880,
  double textScale = 1,
  required MeInfo me,
  HefestoThemeMode theme = HefestoThemeMode.dark,
  List<Override> overrides = const [],
  int frames = 6,
}) async {
  tester.view.devicePixelRatio = 2.75;
  tester.view.physicalSize = Size(width * 2.75, height * 2.75);
  addTearDown(tester.view.reset);

  final key = GlobalKey();
  _lastBoundary = key;
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        homeProvider.overrideWith((ref) async => HomeData.fromJson({})),
        meProvider.overrideWith((ref) async => me),
        ...overrides,
      ],
      child: RepaintBoundary(
        key: key,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.of(theme),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
            child: child!,
          ),
          home: screen,
        ),
      ),
    ),
  );
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
  expect(tester.takeException(), isNull, reason: 'la pantalla $name lanzó una excepción (¿overflow?)');

  if (shotDir != null) {
    await tester.runAsync(() async {
      final boundary = key.currentContext!.findRenderObject() as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 1.2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      await File('$shotDir/$name.png').writeAsBytes(bytes!.buffer.asUint8List());
    });
  }
}

/// Avanza [ms] milisegundos en pasos cortos (timers de debounce + futuros).
Future<void> advance(WidgetTester tester, [int ms = 600]) async {
  for (var t = 0; t < ms; t += 100) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}
