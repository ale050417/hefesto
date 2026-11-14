// Arnés "teléfono real" para los tests de pantallas (2026-11-14, pedido de Ale:
// que ninguna pantalla ni modal se vea roto en el celular).
//
// Los arneses anteriores dibujan cada pantalla en un lienzo alto, sin notch,
// sin barra de gestos y sin teclado, y sacan la captura ANTES de abrir el
// modal: así nunca se ve una hoja tapada por el teclado ni un botón metido
// debajo de la barra del sistema. Este arnés:
//
//   • dibuja en el tamaño exacto de un teléfono (ver [Phone]) con sus zonas
//     ocupadas: barra de estado / notch arriba y barra de gestos abajo;
//   • usa el MISMO marco que la app publicada (idioma castellano y tope de
//     letra, ver `core/app_frame.dart`);
//   • puede abrir el teclado como lo hace el sistema ([openKeyboard]);
//   • saca la captura con lo que esté abierto (diálogo, hoja, menú) y pinta
//     encima las zonas del sistema, para ver de un vistazo si algo queda
//     tapado ([shoot], solo con la variable SHOT_DIR).
//
// No es un test por sí mismo: lo importan los `*_test.dart`.

import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/models.dart';
import 'package:hefesto/core/app_frame.dart';
import 'package:hefesto/core/providers.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:intl/date_symbol_data_local.dart';

/// Con SHOT_DIR=carpeta se guarda una captura PNG en cada [shoot].
final String? shotDir = Platform.environment['SHOT_DIR'];

/// Un teléfono de prueba: tamaño en dp y zonas que ocupa el sistema.
class Phone {
  const Phone(
    this.name,
    this.width,
    this.height, {
    this.top = 0,
    this.bottom = 0,
    this.platform = TargetPlatform.android,
  });

  final String name;
  final double width;
  final double height;

  /// Alto de la barra de estado / notch (arriba) y de la barra de gestos o de
  /// botones (abajo). La app dibuja de borde a borde: ahí no puede quedar nada
  /// que se tenga que leer o tocar.
  final double top;
  final double bottom;
  final TargetPlatform platform;

  /// Android chico (5"), con los tres botones abajo: el caso más apretado.
  static const small = Phone('chico', 360, 640, top: 24, bottom: 48);

  /// iPhone SE (con botón físico): bajo y sin zona inferior.
  static const iphoneSe = Phone('iphone_se', 375, 667, top: 20, platform: TargetPlatform.iOS);

  /// iPhone actual (Dynamic Island + barrita de inicio).
  static const iphone = Phone('iphone', 393, 852, top: 59, bottom: 34, platform: TargetPlatform.iOS);

  /// Android actual con navegación por gestos.
  static const android = Phone('android', 412, 915, top: 36, bottom: 24);

  /// Los dos extremos que hay que mirar siempre: el más chico y el iPhone con
  /// notch (el de más zona ocupada).
  static const both = [small, iphone];
}

const double _dpr = 2.75;

Phone _phone = Phone.android;
double _keyboard = 0;
GlobalKey? _boundary;

/// Teléfono con el que se dibujó la última pantalla.
Phone get currentPhone => _phone;

/// Alto del teclado abierto (0 = cerrado).
double get keyboardHeight => _keyboard;

Future<void> _loadFont(String family, List<String> files) async {
  final present = files.where((f) => File(f).existsSync()).toList();
  if (present.isEmpty) return;
  final loader = FontLoader(family);
  for (final f in present) {
    loader.addFont(File(f).readAsBytes().then((b) => ByteData.sublistView(b)));
  }
  await loader.load();
}

/// Para el `setUpAll`: fechas en castellano y las tipografías REALES de la
/// marca (con la fuente de prueba de Flutter cada letra mide un cuadrado y
/// aparecen desbordes que en el teléfono no existen).
Future<void> setUpDeviceKit() async {
  await initializeDateFormatting('es_AR');
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
  if (shotDir != null) Directory(shotDir!).createSync(recursive: true);
}

/// Un usuario del panel con permiso total sobre [modules].
MeInfo staffWith(
  List<String> modules, {
  String role = 'admin',
  List<String> actions = const ['ver', 'crear', 'editar', 'eliminar'],
}) =>
    MeInfo.fromJson({
      'id': 'u1',
      'email': 'ale@hefesto.com',
      'fullName': 'Ale',
      'role': role,
      'isStaff': true,
      'permissions': {
        for (final m in modules)
          m: {for (final a in ['ver', 'crear', 'editar', 'eliminar']) a: actions.contains(a)},
      },
    });

void _applyInsets(WidgetTester tester) {
  final p = _phone;
  tester.view.devicePixelRatio = _dpr;
  tester.view.physicalSize = Size(p.width * _dpr, p.height * _dpr);
  // Igual que el sistema: con el teclado abierto la zona inferior "segura"
  // pasa a ser el teclado (padding.bottom = 0, viewInsets.bottom = teclado).
  tester.view.viewPadding = FakeViewPadding(top: p.top * _dpr, bottom: p.bottom * _dpr);
  tester.view.padding = FakeViewPadding(
    top: p.top * _dpr,
    bottom: _keyboard > 0 ? 0 : p.bottom * _dpr,
  );
  tester.view.viewInsets = FakeViewPadding(bottom: _keyboard * _dpr);
}

/// Dibuja [screen] en un [phone], con el marco real de la app. Falla si la
/// pantalla lanza (p. ej. un desborde). Sin `pumpAndSettle`: los esqueletos
/// animan para siempre.
///
/// [home] son los datos de la vidriera (marca, banners, productos) y [me] el
/// usuario que inició sesión; por defecto, vidriera vacía y visitante.
///
/// Para pantallas que navegan con go_router (`context.go/push`), pasar un
/// [router] propio (un `GoRouter` con las rutas que hagan falta): en ese caso
/// [screen] se ignora y se dibuja lo que resuelva el router.
Future<void> pumpPhone(
  WidgetTester tester,
  Widget screen, {
  Phone phone = Phone.android,
  HefestoThemeMode theme = HefestoThemeMode.dark,
  double textScale = 1,
  MeInfo? me,
  HomeData? home,
  List<Override> overrides = const [],
  RouterConfig<Object>? router,
  int frames = 6,
}) async {
  _phone = phone;
  _keyboard = 0;
  _applyInsets(tester);
  addTearDown(() {
    _keyboard = 0;
    tester.view.reset();
  });

  final key = GlobalKey();
  _boundary = key;
  final themeData = AppTheme.of(theme).copyWith(platform: phone.platform);
  // Primero la letra del "teléfono", después el tope de la app.
  Widget frame(BuildContext context, Widget? child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
        child: Builder(builder: (context) => appFrameBuilder(context, child)),
      );
  await tester.pumpWidget(
    ProviderScope(
      key: UniqueKey(), // cada llamada arma un contenedor nuevo
      overrides: [
        // `homeProvider` y `meProvider` ya van pisados acá (Riverpod no deja
        // pisar dos veces el mismo): para otros datos usar [home] y [me].
        homeProvider.overrideWith((ref) async => home ?? HomeData.fromJson({})),
        meProvider.overrideWith((ref) async => me),
        ...overrides,
      ],
      child: RepaintBoundary(
        key: key,
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (router != null)
                MaterialApp.router(
                  debugShowCheckedModeBanner: false,
                  theme: themeData,
                  locale: appLocale,
                  supportedLocales: appSupportedLocales,
                  localizationsDelegates: appLocalizationsDelegates,
                  builder: frame,
                  routerConfig: router,
                )
              else
                MaterialApp(
                  debugShowCheckedModeBanner: false,
                  theme: themeData,
                  locale: appLocale,
                  supportedLocales: appSupportedLocales,
                  localizationsDelegates: appLocalizationsDelegates,
                  builder: frame,
                  home: screen,
                ),
              const IgnorePointer(child: _SystemZones()),
            ],
          ),
        ),
      ),
    ),
  );
  await settle(tester, frames);
  expectNoLayoutErrors(tester, 'al dibujar en ${phone.name}');
}

/// Deja pasar unos cuadros (providers, animaciones de apertura).
Future<void> settle(WidgetTester tester, [int frames = 6]) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

/// Falla si se lanzó alguna excepción de dibujo (típico: "RenderFlex overflowed").
void expectNoLayoutErrors(WidgetTester tester, [String when = '']) {
  expect(tester.takeException(), isNull, reason: 'se lanzó una excepción $when (¿desborde?)');
}

/// Abre el teclado como en el teléfono: toca [field] (le da foco), ocupa
/// [height] dp abajo y deja que la pantalla se reacomode.
Future<void> openKeyboard(WidgetTester tester, Finder field, {double height = 300}) async {
  await tester.ensureVisible(field);
  await tester.pump();
  await tester.tap(field, warnIfMissed: false);
  await tester.pump();
  _keyboard = height;
  _applyInsets(tester);
  await settle(tester, 5);
  expectNoLayoutErrors(tester, 'con el teclado abierto en ${_phone.name}');
}

/// Cierra el teclado (saca el foco y devuelve el espacio).
Future<void> closeKeyboard(WidgetTester tester) async {
  FocusManager.instance.primaryFocus?.unfocus();
  _keyboard = 0;
  _applyInsets(tester);
  await settle(tester, 4);
  expectNoLayoutErrors(tester, 'al cerrar el teclado en ${_phone.name}');
}

/// Zona visible de la pantalla: entre la barra de estado y el teclado (o la
/// barra de gestos si el teclado está cerrado).
Rect get safeRect => Rect.fromLTRB(
      0,
      _phone.top,
      _phone.width,
      _phone.height - (_keyboard > 0 ? _keyboard : _phone.bottom),
    );

/// Falla si el campo que tiene el foco quedó tapado por el teclado (o fuera
/// de la pantalla): es el error clásico de las hojas y los diálogos.
void expectFocusedFieldVisible(WidgetTester tester) {
  final focused = find.byWidgetPredicate((w) => w is EditableText && w.focusNode.hasFocus);
  expect(focused, findsOneWidget, reason: 'tendría que haber un campo con el foco');
  final rect = tester.getRect(focused);
  final visible = safeRect;
  expect(
    rect.top >= visible.top - 0.5 && rect.bottom <= visible.bottom + 0.5,
    isTrue,
    reason: 'el campo con foco (${_fmt(rect)}) no entra en la zona visible (${_fmt(visible)}) '
        'de ${_phone.name}: lo tapa el teclado o la barra del sistema',
  );
}

/// Falla si [finder] (un botón, un título…) no está entero dentro de la zona
/// visible. Usarlo para lo que SIEMPRE tiene que poder tocarse: el botón de
/// guardar de una hoja, las acciones de un diálogo, la cruz de cerrar.
void expectReachable(WidgetTester tester, Finder finder, {String? what}) {
  expect(finder, findsOneWidget, reason: 'no se encontró ${what ?? 'el elemento'}');
  final rect = tester.getRect(finder);
  final visible = safeRect;
  expect(
    rect.top >= visible.top - 0.5 &&
        rect.bottom <= visible.bottom + 0.5 &&
        rect.left >= -0.5 &&
        rect.right <= visible.right + 0.5,
    isTrue,
    reason: '${what ?? 'el elemento'} (${_fmt(rect)}) queda fuera de la zona visible '
        '(${_fmt(visible)}) de ${_phone.name}',
  );
}

/// Desplaza la primera lista de la pantalla hasta el final (para revisar que
/// lo último —un botón, una fila— no quede debajo de la barra del sistema).
Future<void> scrollToEnd(WidgetTester tester, {Finder? scrollable}) async {
  final target = scrollable ?? find.byType(Scrollable).first;
  if (target.evaluate().isEmpty) return;
  final state = tester.state<ScrollableState>(target);
  for (var i = 0; i < 40; i++) {
    final pos = state.position;
    if (pos.pixels >= pos.maxScrollExtent - 0.5) break;
    pos.jumpTo(pos.maxScrollExtent);
    await tester.pump(const Duration(milliseconds: 50));
  }
  await settle(tester, 3);
  expectNoLayoutErrors(tester, 'al desplazar hasta el final en ${_phone.name}');
}

String _fmt(Rect r) =>
    '${r.left.toStringAsFixed(0)},${r.top.toStringAsFixed(0)} → ${r.right.toStringAsFixed(0)},${r.bottom.toStringAsFixed(0)}';

/// Guarda una captura del estado actual (con modales incluidos) si SHOT_DIR
/// está definido. El nombre lleva el teléfono: `nombre__chico.png`.
Future<void> shoot(WidgetTester tester, String name) async {
  final dir = shotDir;
  final key = _boundary;
  if (dir == null || key == null) return;
  await tester.runAsync(() async {
    final boundary = key.currentContext!.findRenderObject() as RenderRepaintBoundary;
    final image = await boundary.toImage(pixelRatio: 1.25);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    await File('$dir/${name}__${_phone.name}.png').writeAsBytes(bytes!.buffer.asUint8List());
  });
}

/// Pinta encima de la app lo que ocupa el sistema, para que en la captura se
/// vea qué queda tapado: barra de estado / notch y barra de gestos (franjas
/// translúcidas rojas: la app se sigue viendo debajo, como en el teléfono) y
/// el teclado (bloque opaco: lo de atrás no se ve).
class _SystemZones extends StatelessWidget {
  const _SystemZones();

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final top = mq.viewPadding.top;
    final bottom = mq.viewPadding.bottom;
    final keyboard = mq.viewInsets.bottom;
    const zone = Color(0x40FF2D6F);
    return Stack(
      children: [
        if (top > 0)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: top,
            child: ColoredBox(
              color: zone,
              child: Center(
                child: Container(
                  width: top > 40 ? 110 : 0,
                  height: top > 40 ? 30 : 0,
                  decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(20)),
                ),
              ),
            ),
          ),
        if (keyboard > 0)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: keyboard,
            child: Container(
              color: const Color(0xFF2B2B30),
              alignment: Alignment.center,
              child: const Text(
                'TECLADO',
                style: TextStyle(
                  color: Color(0xFF8E8E93),
                  fontSize: 15,
                  letterSpacing: 4,
                  fontWeight: FontWeight.w700,
                  decoration: TextDecoration.none,
                ),
              ),
            ),
          )
        else if (bottom > 0)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: bottom,
            child: ColoredBox(
              color: zone,
              child: Center(
                child: Container(
                  width: 130,
                  height: 5,
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(3)),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
