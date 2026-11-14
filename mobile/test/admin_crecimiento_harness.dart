// Herramientas compartidas por los tests de pantallas de Clientes, Descuentos y
// Recompensas (no es un test por sí mismo: lo importan los `*_screens_test`).

import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/api/models.dart';
import 'package:hefesto/core/providers.dart';
import 'package:hefesto/core/theme/app_theme.dart';

/// Con SHOT_DIR=carpeta se guarda una captura PNG de cada pantalla.
final shotDir = Platform.environment['SHOT_DIR'];

Future<void> _loadFont(String family, List<String> files) async {
  final loader = FontLoader(family);
  for (final f in files) {
    loader.addFont(File(f).readAsBytes().then((b) => ByteData.sublistView(b)));
  }
  await loader.load();
}

/// Carga las tipografías de la marca: sin ellas los tests dibujan con la fuente
/// de prueba (cada letra ocupa un cuadrado) y los anchos no son reales. Con
/// SHOT_DIR además se cargan los íconos de Material y se crea la carpeta.
Future<void> setUpFonts() async {
  final orbitron = ['assets/fonts/Orbitron-Bold.ttf', 'assets/fonts/Orbitron-ExtraBold.ttf'];
  final sora = [
    'assets/fonts/Sora-Regular.ttf',
    'assets/fonts/Sora-Medium.ttf',
    'assets/fonts/Sora-SemiBold.ttf',
    'assets/fonts/Sora-Bold.ttf',
  ];
  if ([...orbitron, ...sora].every((f) => File(f).existsSync())) {
    await _loadFont('Orbitron', orbitron);
    await _loadFont('Sora', sora);
  }
  if (shotDir == null) return;
  Directory(shotDir!).createSync(recursive: true);
  final root = Platform.environment['FLUTTER_ROOT'];
  if (root != null) {
    await _loadFont('MaterialIcons', ['$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf']);
  }
}

/// Un usuario del panel con los permisos pedidos (todos por defecto).
MeInfo staffMe(List<String> modules, {List<String> actions = const ['ver', 'crear', 'editar', 'eliminar']}) =>
    MeInfo.fromJson({
      'id': 'u1',
      'email': 'ale@hefesto.com',
      'fullName': 'Ale',
      'role': 'admin',
      'isStaff': true,
      'permissions': {
        for (final m in modules) m: {for (final a in actions) a: true},
      },
    });

/// ApiClient de mentira: anota las llamadas y responde con lo que se le pida.
class FakeApi extends ApiClient {
  FakeApi({this.onSend, this.onGet});

  /// (método, ruta, body) → respuesta; si lanza, simula un error del servidor.
  final Map<String, dynamic> Function(String method, String path, Object? body)? onSend;
  final Map<String, dynamic> Function(String path)? onGet;

  final List<({String method, String path, Object? body})> calls = [];

  @override
  Future<Map<String, dynamic>> sendJson(
    String method,
    String path, {
    Map<String, dynamic>? query,
    Object? body,
  }) async {
    calls.add((method: method, path: path, body: body));
    return onSend?.call(method, path, body) ?? {'ok': true};
  }

  @override
  Future<Map<String, dynamic>> getJson(String path, {Map<String, dynamic>? query}) async {
    calls.add((method: 'GET', path: path, body: null));
    return onGet?.call(path) ?? {};
  }
}

/// Dibuja una pantalla con providers pisados. Sin pumpAndSettle: los esqueletos
/// animan para siempre. Falla si la pantalla lanza (p. ej. por overflow).
/// Devuelve la clave del RepaintBoundary, para sacar más capturas con [shot].
Future<GlobalKey> showScreen(
  WidgetTester tester,
  String name,
  Widget screen, {
  double width = 392,
  double height = 880,
  double textScale = 1,
  HefestoThemeMode theme = HefestoThemeMode.dark,
  MeInfo? me,
  List<Override> overrides = const [],
}) async {
  tester.view.devicePixelRatio = 2.75;
  tester.view.physicalSize = Size(width * 2.75, height * 2.75);
  addTearDown(tester.view.reset);

  final key = GlobalKey();
  await tester.pumpWidget(
    ProviderScope(
      key: UniqueKey(),
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
  await settle(tester);
  expect(tester.takeException(), isNull, reason: 'la pantalla $name lanzó una excepción (¿overflow?)');
  await shot(tester, key, name);
  return key;
}

/// Deja pasar unos cuadros para que lleguen los providers.
Future<void> settle(WidgetTester tester, [int frames = 6]) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<void> shot(WidgetTester tester, GlobalKey key, String name) async {
  if (shotDir == null) return;
  await tester.runAsync(() async {
    final boundary = key.currentContext!.findRenderObject() as RenderRepaintBoundary;
    final image = await boundary.toImage(pixelRatio: 1.2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    await File('$shotDir/$name.png').writeAsBytes(bytes!.buffer.asUint8List());
  });
}
