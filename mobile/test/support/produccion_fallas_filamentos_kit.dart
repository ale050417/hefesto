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

/// Utilidades compartidas por los tests de pantallas de Producción, Fallas y
/// Filamentos (mismo enfoque que `admin_screens_test.dart`): dibuja una
/// pantalla con datos de ejemplo y, con la variable SHOT_DIR (una carpeta), guarda un PNG.
final shotDir = Platform.environment['SHOT_DIR'];

Future<void> _loadFont(String family, List<String> files) async {
  final loader = FontLoader(family);
  for (final f in files) {
    loader.addFont(File(f).readAsBytes().then((b) => ByteData.sublistView(b)));
  }
  await loader.load();
}

/// Para el `setUpAll` de cada test: fechas en es_AR y las tipografías REALES de
/// la marca. Sin ellas Flutter usa una fuente de prueba donde cada letra mide un
/// cuadrado entero (mucho más ancha que Sora): los tests de "sin overflow con
/// fuente grande" fallarían por la fuente y no por el diseño. Con SHOT_DIR
/// también se cargan los íconos para que la captura se vea como en el celu.
Future<void> setUpKit() async {
  await initializeDateFormatting('es_AR');
  await _loadFont('Orbitron', ['assets/fonts/Orbitron-Bold.ttf', 'assets/fonts/Orbitron-ExtraBold.ttf']);
  await _loadFont('Sora', [
    'assets/fonts/Sora-Regular.ttf',
    'assets/fonts/Sora-Medium.ttf',
    'assets/fonts/Sora-SemiBold.ttf',
    'assets/fonts/Sora-Bold.ttf',
  ]);
  if (shotDir != null) {
    Directory(shotDir!).createSync(recursive: true);
    final root = Platform.environment['FLUTTER_ROOT'];
    if (root != null) {
      await _loadFont('MaterialIcons', ['$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf']);
    }
  }
}

/// Un usuario del panel con los permisos dados (módulo → acciones).
MeInfo meWith(Map<String, List<String>> perms, {String role = 'admin'}) => MeInfo.fromJson({
      'id': 'u1',
      'email': 'ale@hefesto.com',
      'fullName': 'Ale',
      'role': role,
      'isStaff': true,
      'permissions': {
        for (final e in perms.entries)
          e.key: {for (final a in ['ver', 'crear', 'editar', 'eliminar']) a: e.value.contains(a)},
      },
    });

const allActions = ['ver', 'crear', 'editar', 'eliminar'];

/// Dibuja [screen] en un celular de 392 dp (por defecto) y verifica que no se
/// lanzó ninguna excepción (¿overflow?).
Future<void> showScreen(
  WidgetTester tester,
  String name,
  Widget screen, {
  double width = 392,
  double height = 880,
  double textScale = 1.0,
  HefestoThemeMode mode = HefestoThemeMode.dark,
  MeInfo? me,
  List<Override> overrides = const [],
  bool expectNoException = true,
}) async {
  tester.view.devicePixelRatio = 2.75;
  tester.view.physicalSize = Size(width * 2.75, height * 2.75);
  addTearDown(tester.view.reset);

  final key = GlobalKey();
  await tester.pumpWidget(
    ProviderScope(
      key: UniqueKey(), // cada llamada arma un contenedor nuevo (overrides distintos)
      overrides: [
        homeProvider.overrideWith((ref) async => HomeData.fromJson({})),
        meProvider.overrideWith((ref) async => me ?? meWith({'produccion': allActions})),
        ...overrides,
      ],
      child: RepaintBoundary(
        key: key,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.of(mode),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
            child: child!,
          ),
          home: screen,
        ),
      ),
    ),
  );
  // Sin pumpAndSettle: los esqueletos animan para siempre.
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
  if (expectNoException) {
    expect(tester.takeException(), isNull, reason: 'la pantalla $name lanzó una excepción (¿overflow?)');
  }

  if (shotDir != null) {
    await tester.runAsync(() async {
      final boundary = key.currentContext!.findRenderObject() as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 1.2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      await File('$shotDir/$name.png').writeAsBytes(bytes!.buffer.asUint8List());
    });
  }
}
