// Pruebas "teléfono real" del grupo TALLER del panel: cola de producción,
// impresiones fallidas, filamentos y la pestaña Stock (2026-11-14, pedido de
// Ale: "que las pantallas no estén rotas, que cuando tocás los botones se vean
// bien los modales").
//
// Cada pantalla y CADA modal (hoja, diálogo, menú) se dibuja en el teléfono más
// chico (360×640 con barra de 3 botones) y en un iPhone con notch, se abre por
// el camino real (tocando el botón de la pantalla), con teclado donde hay
// campos, con letra 1,3× y en los tres temas. Con SHOT_DIR=carpeta se guarda
// una captura de cada estado.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/providers.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:hefesto/core/widgets/common.dart';
import 'package:hefesto/features/admin/admin_models.dart';
import 'package:hefesto/features/admin/admin_providers.dart';
import 'package:hefesto/features/admin/admin_shell.dart';
import 'package:hefesto/features/admin/admin_widgets.dart';
import 'package:hefesto/features/admin/fallas/falla_form_screen.dart';
import 'package:hefesto/features/admin/fallas/fallas_api.dart';
import 'package:hefesto/features/admin/fallas/fallas_models.dart';
import 'package:hefesto/features/admin/fallas/fallas_screen.dart';
import 'package:hefesto/features/admin/filamentos/filamento_detail_screen.dart';
import 'package:hefesto/features/admin/filamentos/filamento_form_screen.dart';
import 'package:hefesto/features/admin/filamentos/filamentos_api.dart';
import 'package:hefesto/features/admin/filamentos/filamentos_models.dart';
import 'package:hefesto/features/admin/filamentos/movement_tile.dart';
import 'package:hefesto/features/admin/filamentos/movements_screen.dart';
import 'package:hefesto/features/admin/filamentos/stock_adjust_sheet.dart';
import 'package:hefesto/features/admin/produccion/produccion_api.dart';
import 'package:hefesto/features/admin/produccion/produccion_models.dart';
import 'package:hefesto/features/admin/produccion/produccion_screen.dart';
import 'package:hefesto/features/admin/sale_status.dart';
import 'package:hefesto/features/admin/stock_screen.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show Session, User;

import 'admin_fallas_screens_test.dart' show FakeFallasApi;
import 'admin_filamentos_screens_test.dart' show FakeFilamentosApi;
import 'admin_produccion_screens_test.dart' show FakeProduccionApi;
import 'support/device_kit.dart';

// ---------------------------------------------------------------------------
// Datos de ejemplo (formas reales de la API, con valores extremos)
// ---------------------------------------------------------------------------

const longLabel = 'Lámpara lunar personalizada con base de madera de algarrobo ×12 · '
    'Cartel luminoso con el nombre del local';
const longName = 'María de los Ángeles Fernández Gutiérrez de la Fuente';
const longNote = 'Se despegó de la cama a mitad de la impresión porque el adhesivo estaba vencido; '
    'hubo que frenar todo, limpiar el vidrio con alcohol isopropílico y volver a nivelar. '
    'Además el carrete venía con humedad y se escuchaban las burbujas en la boquilla. '
    'Queda pendiente secar el filamento seis horas a cincuenta grados antes de reintentar '
    'y revisar el ventilador de capa, que hacía un ruido raro desde la semana pasada.';
const longServerError = 'No se puede pasar de "ready" a "shipped": cargá el código de seguimiento antes de '
    'marcar el pedido como enviado, o elegí "Marcar entregado" si lo retiran en el taller.';

const _flow = ['pending_payment', 'confirmed', 'in_production', 'ready', 'shipped', 'delivered'];

Map<String, dynamic> cardJson(
  String id,
  String status, {
  String source = 'online',
  String label = 'Mate Mario ×2',
  String? customer = 'Juan Pérez',
  Object total = 57500,
  int age = 5,
  bool late = false,
}) =>
    {
      'id': id,
      'source': source,
      'label': label,
      'customerName': customer,
      'total': total,
      'status': status,
      'createdAt': '2026-11-10T10:00:00.000Z',
      'ageHours': age,
      'late': late,
    };

/// Tres tarjetas (una por tipo de hoja): textos larguísimos y monto de 9 cifras.
BoardData smallBoard() => BoardData.fromJson({
      'items': [
        cardJson('o1', 'in_production', label: longLabel, customer: longName, total: 987654321, age: 50, late: true),
        cardJson('m1', 'pending_payment', source: 'manual', label: '5 llaveros', customer: 'Feria', total: 10000, age: 2),
        cardJson('o2', 'ready', label: 'Figura', customer: null, total: '4500.00', age: 26),
      ],
      'counts': {'late': 1},
    });

/// Cola larga: 36 trabajos repartidos en todas las etapas.
BoardData bigBoard() => BoardData.fromJson({
      'items': [
        cardJson('x1', 'pending_payment', label: longLabel, customer: longName, total: 987654321, age: 1),
        cardJson('x2', 'confirmed', source: 'manual', label: longLabel, customer: longName, total: 999999999, age: 72, late: true),
        cardJson('x3', 'in_production', label: longLabel, customer: null, total: 123456789, age: 1200, late: true),
        for (var i = 0; i < 33; i++)
          cardJson(
            'n$i',
            _flow[i % 6],
            source: i.isEven ? 'online' : 'manual',
            label: 'Pedido $i · Figura articulada con base y nombre grabado',
            customer: i % 5 == 0 ? null : 'Cliente número $i',
            total: 1500 * (i + 1),
            age: i * 7,
          ),
      ],
      'counts': {'late': 2},
    });

Map<String, dynamic> fallaJson(
  String id, {
  String piece = 'Lámpara lunar',
  String material = 'PLA',
  String color = 'Rojo',
  Object grams = 150,
  String reason = 'Boquilla tapada',
  String? notes = 'Se tapó a la mitad',
  bool deducted = true,
  num cost = 3000,
  String? hex = '#CC2200',
  String? createdAt = '2026-11-10T10:00:00.000Z',
}) =>
    {
      'id': id,
      'createdAt': createdAt,
      'pieceName': piece,
      'material': material,
      'color': color,
      'gramsLost': grams,
      'reason': reason,
      'notes': notes,
      'deducted': deducted,
      'cost': cost,
      'hex': hex,
    };

const _reasons = [
  'Corte de luz',
  'Boquilla tapada',
  'Despegue de la cama',
  'Filamento enredado',
  'Error del modelo',
  'Calibración',
  'Otro',
];

List<Map<String, dynamic>> carretesJson(int n) => [
      for (var i = 0; i < n; i++)
        {
          'id': 'f$i',
          'material': i.isEven ? 'PLA' : 'PETG reforzado con fibra de carbono',
          'color': i == 0 ? 'Rojo' : 'Verde militar metalizado número $i',
          'brand': i == 0 ? 'Grilon3' : 'Marca Genérica Importada',
          'stockGrams': i == 0 ? 840 : 12345.6 + i,
          'hex': i.isEven ? '#4B5320' : null,
        },
    ];

/// Pocas fallas (una larguísima y una vieja con todo vacío) + carretes.
FallasData smallFallas({int carretes = 36}) => FallasData.fromJson({
      'items': [
        fallaJson(
          'a1',
          piece: longLabel,
          material: 'PETG reforzado con fibra de carbono',
          color: 'Verde militar metalizado',
          grams: 123456.78,
          reason: 'Despegue de la cama',
          notes: longNote,
          cost: 987654321,
          hex: '#4B5320',
        ),
        fallaJson(
          'a2',
          piece: '',
          material: '',
          color: '',
          grams: '25.50',
          reason: 'Corte de luz',
          notes: null,
          deducted: false,
          cost: 0,
          hex: null,
          createdAt: null,
        ),
        fallaJson('a3'),
      ],
      'summary': {
        'count': 3,
        'totalGrams': 123632.28,
        'totalCost': 987657321,
        'topReason': 'Despegue de la cama',
        'topReasonCount': 1,
      },
      'filaments': carretesJson(carretes),
      'materials': ['PLA', 'PLA mate', 'PLA translúcido', 'PETG', 'PETG reforzado', 'TPU', 'Resina 8K', 'ABS'],
      'reasons': _reasons,
    });

/// Listado largo: 34 fallas.
FallasData bigFallas() => FallasData.fromJson({
      'items': [
        fallaJson('a1', piece: longLabel, grams: 123456.78, reason: 'Despegue de la cama', notes: longNote, cost: 987654321),
        for (var i = 0; i < 33; i++)
          fallaJson(
            'n$i',
            piece: 'Pieza de prueba número $i con nombre largo',
            color: 'Color $i',
            grams: 10.5 * (i + 1),
            reason: _reasons[i % _reasons.length],
            cost: 250 * (i + 1),
            hex: i.isEven ? '#3A72C4' : null,
          ),
      ],
      'summary': {
        'count': 34,
        'totalGrams': 129347.3,
        'totalCost': 987794571,
        'topReason': 'Despegue de la cama',
        'topReasonCount': 5,
      },
      'filaments': carretesJson(4),
      'materials': ['PLA', 'PETG'],
      'reasons': _reasons,
    });

Map<String, dynamic> filamentJson(
  String id, {
  String material = 'PLA',
  String color = 'Rojo',
  String brand = 'Grilon3',
  String diameter = '1.75',
  Object stock = 120,
  num spool = 1000,
  num cost = 20000,
  num threshold = 200,
  String status = 'bajo',
  String? hex = '#CC2200',
}) =>
    {
      'id': id,
      'material': material,
      'color': color,
      'brand': brand,
      'diameter': diameter,
      'stockGrams': stock,
      'spoolGrams': spool,
      'costPerKg': cost,
      'alertThresholdGrams': threshold,
      'lowStock': status != 'ok',
      'status': status,
      'hex': hex,
    };

final rojo = Filamento.fromJson(filamentJson('2'));

/// Un carrete con todo largo y números enormes.
final extremo = Filamento.fromJson(filamentJson(
  '9',
  material: 'PETG reforzado con fibra de carbono',
  color: 'Verde militar metalizado con brillos',
  brand: 'Marca Genérica Importada de Alta Gama',
  stock: 98765.4,
  spool: 5000,
  cost: 987654321,
  threshold: 12500,
  status: 'ok',
  hex: '#4B5320',
));

final deuda = Filamento.fromJson(filamentJson('3', color: 'Negro', stock: -1530.5, status: 'agotado', hex: '#111111'));

/// Pestaña Stock con 36 carretes (los primeros, con textos y números extremos).
StockPage bigStock() => StockPage.fromJson({
      'counts': {'total': 36, 'low': 12, 'out': 12},
      'items': [
        filamentJson(
          's0',
          material: 'PETG reforzado con fibra de carbono',
          color: 'Verde militar metalizado con brillos',
          brand: 'Marca Genérica Importada de Alta Gama',
          stock: 123456789,
          spool: 5000,
          threshold: 12500,
          status: 'ok',
          hex: '#4B5320',
        ),
        filamentJson('s1', color: 'Negro', stock: -1530.5, status: 'agotado', hex: '#111111'),
        filamentJson('s2', color: 'Sin marca ni diámetro', brand: '', diameter: '', stock: 0, spool: 0, threshold: 0, status: 'agotado', hex: null),
        for (var i = 3; i < 36; i++)
          filamentJson(
            's$i',
            color: 'Color $i',
            stock: 40 * i,
            status: const ['ok', 'bajo', 'agotado'][i % 3],
            hex: i.isEven ? '#3A72C4' : '#F4F4F0',
          ),
      ],
    });

final smallStock = StockPage.fromJson({
  'counts': {'total': 3, 'low': 1, 'out': 1},
  'items': [
    filamentJson('1', color: 'Blanco', stock: 840, status: 'ok', hex: '#F2F2F2'),
    filamentJson('2'),
    filamentJson('3', color: 'Negro', stock: 0, status: 'agotado', hex: '#111111'),
  ],
});

List<FilamentMovement> movements(int n) => [
      for (var i = 0; i < n; i++)
        FilamentMovement.fromJson({
          'id': 'm$i',
          'filamentId': '2',
          'material': i == 0 ? 'PETG reforzado con fibra de carbono' : 'PLA',
          'color': i == 0 ? 'Verde militar metalizado con brillos' : 'Rojo',
          'deltaGrams': i.isEven ? -(80.25 + i * 1000) : 1000 + i,
          'reason': const ['order', 'manual_sale', 'failure', 'adjust', 'restore'][i % 5],
          'reasonLabel': const [
            'Pedido online',
            'Venta manual',
            'Impresión fallida',
            'Ajuste de stock',
            'Stock repuesto (anulación)',
          ][i % 5],
          'ref': i == 0 ? longName : (i % 5 == 3 ? null : 'HF-00$i'),
          'createdAt': '2026-11-${(i % 28 + 1).toString().padLeft(2, '0')}T15:00:00.000Z',
        }),
    ];

/// Catálogo grande: 40 colores (nombres de hasta 40 letras, el tope del
/// servidor), 14 marcas y 11 materiales.
FilamentCatalog bigCatalog() => FilamentCatalog.fromJson({
      'colors': [
        {'name': 'Negro', 'hex': '#111111'},
        {'name': 'Rojo', 'hex': '#CC2200'},
        {'name': 'Verde militar metalizado con brillos oro', 'hex': '#4B5320'},
        for (var i = 0; i < 37; i++) {'name': 'Color de catálogo número $i', 'hex': i % 4 == 0 ? null : '#3A72C4'},
      ],
      'brands': [
        {'name': 'Grilon3'},
        {'name': 'Marca Genérica Importada de Alta Gama SA'},
        for (var i = 0; i < 12; i++) {'name': 'Marca $i'},
      ],
      'materials': [
        for (final m in ['PLA', 'PLA mate', 'PLA translúcido', 'PLA arcoíris', 'PETG', 'PETG reforzado', 'TPU', 'TPU + PLA', 'Resina', 'Resina 8K', 'ABS'])
          {'name': m},
      ],
      'diameters': ['1.75', '2.85', '—'],
    });

String longReport() => [
      'INFORME DE FILAMENTOS — HEFESTO 3D',
      'Fecha: 14/11/2026',
      '',
      'RESUMEN',
      '• Total en stock: 48.25 kg',
      r'• Valor estimado: $987.654.321',
      '• Colores: 40 (en stock 30, bajo 6, agotado 4)',
      '',
      'A REPONER',
      for (var i = 0; i < 10; i++) '• PLA Color $i · Grilon3: agotado',
      '',
      'POR MATERIAL',
      for (var i = 0; i < 40; i++) '• Color número $i con nombre largo · Marca Genérica Importada: 1.25 kg',
      'FIN DEL INFORME',
    ].join('\n');

/// API de filamentos de mentira con el informe configurable (largo, con error
/// o que tarda).
class TallerFilamentosApi extends FakeFilamentosApi {
  String reportText = 'INFORME DE FILAMENTOS\n• Total: 2 kg';
  Object? reportError;
  Completer<void>? reportGate;

  @override
  Future<String> report() async {
    if (reportGate != null) await reportGate!.future;
    if (reportError != null) throw reportError!;
    return reportText;
  }
}

// ---------------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------------

Finder get sheet => find.byType(BottomSheet);

/// La hoja abierta no se mete debajo de la barra de estado / notch.
void expectSheetBelowStatusBar(WidgetTester tester, [String when = '']) {
  expect(sheet, findsOneWidget, reason: 'tendría que haber una hoja abierta $when');
  final top = tester.getRect(sheet).top;
  expect(
    top >= currentPhone.top - 0.5,
    isTrue,
    reason: 'la hoja se mete debajo de la barra de estado $when en ${currentPhone.name} '
        '(empieza en ${top.toStringAsFixed(0)}, la barra mide ${currentPhone.top.toStringAsFixed(0)})',
  );
}

/// Cierra la hoja como lo haría el usuario: tocando afuera si queda lugar, o
/// arrastrándola desde la manija si ocupa toda la pantalla.
Future<void> closeSheet(WidgetTester tester) async {
  final top = tester.getRect(sheet).top;
  if (top > currentPhone.top + 20) {
    await tester.tapAt(Offset(currentPhone.width / 2, currentPhone.top + 8));
  } else {
    await tester.dragFrom(Offset(currentPhone.width / 2, top + 14), const Offset(0, 620));
  }
  await settle(tester, 8);
  expect(sheet, findsNothing, reason: 'la hoja tiene que poder cerrarse (tocar afuera / arrastrar la manija)');
}

/// Un rótulo que tiene que leerse entero en UNA línea (no partido en dos).
void expectOneLine(WidgetTester tester, String text, {required double fontSize, double scale = 1}) {
  final h = tester.getSize(find.text(text).first).height;
  expect(
    h < fontSize * scale * 1.9,
    isTrue,
    reason: '"$text" quedó partido en más de una línea (alto ${h.toStringAsFixed(1)})',
  );
}

/// Objetivo táctil de al menos 44 dp de lado.
void expectTapTarget(WidgetTester tester, Finder finder, {required String what}) {
  final s = tester.getSize(finder);
  expect(
    s.width >= 43.5 && s.height >= 43.5,
    isTrue,
    reason: '$what mide ${s.width.toStringAsFixed(0)}×${s.height.toStringAsFixed(0)}: '
        'menos de 44 dp no se puede tocar cómodo',
  );
}

/// Lo último de la lista quedó por arriba de la barra del sistema.
Future<void> expectListEndVisible(WidgetTester tester, Finder last, {required String what}) async {
  await scrollToEnd(tester);
  // Las listas largas estiman su alto: el primer salto puede pasarse de largo.
  // Se espera a que vuelva y se repite, así se mide con la lista ya quieta.
  await settle(tester, 12);
  await scrollToEnd(tester);
  await settle(tester, 6);
  expectReachable(tester, last, what: what);
}

/// Abre el teclado sobre el texto del informe. Ese campo crece con el texto
/// (puede ser más alto que la pantalla), así que se toca un punto VISIBLE del
/// texto para darle el foco y después se abre el teclado.
Future<void> openKeyboardOnReport(WidgetTester tester) async {
  final field = find.descendant(of: sheet, matching: find.byType(EditableText));
  final viewport = find.descendant(of: sheet, matching: find.byType(Scrollable)).first;
  final visible = tester.getRect(field).intersect(tester.getRect(viewport));
  await tester.tapAt(visible.center);
  await tester.pump();
  await openKeyboard(tester, find.text('Informe de filamentos'));
}

/// El cursor del campo con foco quedó a la vista (para campos de varias líneas
/// más altos que la pantalla, donde el campo entero no puede entrar).
void expectCaretVisible(WidgetTester tester) {
  final focused = find.byWidgetPredicate((w) => w is EditableText && w.focusNode.hasFocus);
  expect(focused, findsOneWidget, reason: 'tendría que haber un campo con el foco');
  final state = tester.state<EditableTextState>(focused);
  final render = state.renderEditable;
  final local = render.getLocalRectForCaret(state.textEditingValue.selection.extent);
  final caret = MatrixUtils.transformRect(render.getTransformTo(null), local);
  final visible = safeRect;
  expect(
    caret.top >= visible.top - 0.5 && caret.bottom <= visible.bottom + 0.5,
    isTrue,
    reason: 'el cursor (de ${caret.top.toStringAsFixed(0)} a ${caret.bottom.toStringAsFixed(0)}) quedó fuera de la zona '
        'visible (${visible.top.toStringAsFixed(0)} a ${visible.bottom.toStringAsFixed(0)}) de ${currentPhone.name}',
  );
}

/// [finder] se ve de verdad: no quedó tapado por una hoja, un diálogo o su
/// barrera (un aviso detrás de una hoja abierta existe pero nadie lo lee).
void expectOnTop(WidgetTester tester, Finder finder, {required String what}) {
  expect(finder, findsOneWidget, reason: 'no se encontró $what');
  final box = tester.renderObject<RenderBox>(finder);
  final center = box.localToGlobal(box.size.center(Offset.zero));
  final hit = tester.hitTestOnBinding(center).path.any((e) => e.target == box);
  expect(hit, isTrue, reason: '$what quedó tapado por otra cosa (¿un aviso detrás de la hoja?)');
}

/// Trae a la vista algo de la lista principal aunque todavía no esté dibujado
/// (las listas arman sus filas a medida que se desplazan).
Future<void> reveal(WidgetTester tester, Finder finder, {Finder? scrollable}) async {
  if (finder.evaluate().isEmpty) {
    final list = scrollable ?? find.byType(Scrollable).first;
    tester.state<ScrollableState>(list).position.jumpTo(0);
    await tester.pump();
    await tester.scrollUntilVisible(finder, 120, scrollable: list, maxScrolls: 300);
  }
  await tester.ensureVisible(finder);
  await settle(tester, 2);
}

Future<void> tapVisible(WidgetTester tester, Finder finder) async {
  await reveal(tester, finder);
  await tester.tap(finder);
  await settle(tester);
  expectNoLayoutErrors(tester);
}

/// Abre el teclado en un campo del formulario (lo trae a la vista primero).
Future<void> focusField(WidgetTester tester, Finder field) async {
  await reveal(tester, field);
  await openKeyboard(tester, field);
}

/// Escribe en un campo y espera a que termine de acomodarse (al escribir, el
/// campo se desplaza solo para mostrar el cursor; mientras tanto la lista no
/// recibe toques).
Future<void> type(WidgetTester tester, Finder field, String text) async {
  await reveal(tester, field);
  await tester.enterText(field, text);
  await settle(tester, 4);
  expectNoLayoutErrors(tester);
}

/// Captura lo que se copia al portapapeles (en los tests no hay plataforma).
List<String> mockClipboard(WidgetTester tester) {
  final copied = <String>[];
  tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
    if (call.method == 'Clipboard.setData') copied.add('${(call.arguments as Map)['text']}');
    return null;
  });
  addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));
  return copied;
}

final _session = Session(
  accessToken: 'token-de-prueba',
  tokenType: 'bearer',
  user: const User(
    id: 'u1',
    appMetadata: {},
    userMetadata: {},
    aud: 'authenticated',
    createdAt: '2026-01-01T00:00:00.000Z',
  ),
);

/// El panel REAL (`AdminShell`, con su barra inferior) parado en la pestaña
/// Stock: así se abren el menú y el informe en la app publicada.
GoRouter shellRouter() => GoRouter(
      initialLocation: '/admin/stock',
      routes: [
        StatefulShellRoute.indexedStack(
          builder: (context, state, shell) => AdminShell(shell: shell),
          branches: [
            StatefulShellBranch(routes: [
              GoRoute(path: '/admin', builder: (_, _) => const Scaffold(body: Center(child: Text('Inicio')))),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(path: '/admin/ventas', builder: (_, _) => const Scaffold(body: Center(child: Text('Ventas')))),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(path: '/admin/stock', builder: (_, _) => const AdminStockScreen()),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(path: '/admin/mas', builder: (_, _) => const Scaffold(body: Center(child: Text('Más')))),
            ]),
          ],
        ),
        GoRoute(path: '/cuenta', builder: (_, _) => const Scaffold(body: Center(child: Text('Cuenta')))),
      ],
    );

List<Override> shellOverrides() => [
      sessionProvider.overrideWith((ref) => Stream.value(_session)),
      adminDashboardProvider.overrideWith((ref) async => AdminDashboard.fromJson({})),
    ];

void main() {
  setUpAll(setUpDeviceKit);

  // =========================================================================
  // COLA DE PRODUCCIÓN
  // =========================================================================
  group('cola de producción', () {
    final me = staffWith(['produccion', 'pedidos']);
    List<Override> ov(BoardData d, [ProduccionApi? api]) => [
          produccionProvider.overrideWith((ref) async => d),
          if (api != null) produccionApiProvider.overrideWithValue(api),
        ];

    for (final phone in Phone.both) {
      testWidgets('cola larga con textos y montos extremos en ${phone.name}', (tester) async {
        await pumpPhone(tester, const AdminProduccionScreen(), phone: phone, me: me, overrides: ov(bigBoard()));
        expect(find.text('Cola de impresión'), findsOneWidget);
        expect(find.text('31 trabajos en curso'), findsOneWidget, reason: '36 menos los 5 entregados');
        expect(find.text('2 demorados'), findsOneWidget);
        // El monto de 9 cifras entra entero al lado del nombre larguísimo.
        expect(find.text(r'$987.654.321'), findsOneWidget);
        await shoot(tester, 'prod_cola');
        // Los botones de avance se pueden tocar cómodos.
        expectTapTarget(tester, find.widgetWithText(FilledButton, 'Confirmar pago').first, what: 'el botón "Confirmar pago"');
        await expectListEndVisible(tester, find.byType(AdminCard).last, what: 'la última tarjeta de la cola');
        await shoot(tester, 'prod_cola_final');
      });

      testWidgets('filtros de etapa y de tipo en ${phone.name}', (tester) async {
        await pumpPhone(tester, const AdminProduccionScreen(), phone: phone, me: me, overrides: ov(bigBoard()));
        // La fila de etapas se desplaza hasta el último chip.
        await tapVisible(tester, find.text('Entregado (5)'));
        expect(find.byType(AdminCard), findsWidgets);
        expect(find.text('Marcar listo'), findsNothing, reason: 'solo quedan los entregados');
        await shoot(tester, 'prod_filtro_entregado');
        await tapVisible(tester, find.widgetWithText(ChoiceChip, 'Mostrador'));
        await tapVisible(tester, find.text('Pago confirmado (7)'));
        expect(find.text(longLabel), findsOneWidget);
        await shoot(tester, 'prod_filtro_mostrador');
        // Una combinación sin resultados muestra el aviso (y entra en pantalla).
        await tapVisible(tester, find.widgetWithText(ChoiceChip, 'Online'));
        expect(find.text('Nada en esta vista'), findsOneWidget);
        await scrollToEnd(tester);
        await shoot(tester, 'prod_filtro_sin_resultados');
      });

      testWidgets('estados: vacía, error, sin acceso, solo lectura y fuente caída en ${phone.name}', (tester) async {
        await pumpPhone(tester, const AdminProduccionScreen(),
            phone: phone, me: me, overrides: ov(BoardData.fromJson({})));
        expect(find.text('No hay trabajos en la cola'), findsOneWidget);
        await scrollToEnd(tester);
        await shoot(tester, 'prod_vacia');

        await pumpPhone(tester, const AdminProduccionScreen(), phone: phone, me: me, overrides: [
          produccionProvider.overrideWith((ref) => throw ApiException('offline', 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.')),
        ]);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Reintentar'), what: 'el botón Reintentar');
        await shoot(tester, 'prod_error');

        await pumpPhone(tester, const AdminProduccionScreen(),
            phone: phone, me: staffWith(['produccion'], role: 'operator', actions: const []), overrides: ov(smallBoard()));
        expect(find.text('Sin acceso'), findsOneWidget);
        await shoot(tester, 'prod_sin_acceso');

        await pumpPhone(tester, const AdminProduccionScreen(),
            phone: phone, me: staffWith(['produccion'], role: 'operator', actions: const ['ver']), overrides: ov(smallBoard()));
        expect(find.text('Marcar listo'), findsNothing, reason: 'sin pedidos/editar no hay botones de avance');
        await expectListEndVisible(tester, find.textContaining('no avanzar los pedidos'), what: 'el aviso de solo lectura');
        await shoot(tester, 'prod_solo_lectura');

        await pumpPhone(tester, const AdminProduccionScreen(), phone: phone, me: me, overrides: [
          produccionProvider.overrideWith((ref) async => BoardData.fromJson({
                'items': [cardJson('o1', 'ready')],
                'degraded': ['pedidos online', 'ventas manuales'],
              })),
        ]);
        expect(find.textContaining('No pudimos cargar pedidos online y ventas manuales'), findsOneWidget);
        await shoot(tester, 'prod_degradada');
      });

      testWidgets('hoja "Confirmar pago" (venta de mostrador) en ${phone.name}', (tester) async {
        final api = FakeProduccionApi();
        await pumpPhone(tester, const AdminProduccionScreen(), phone: phone, me: me, overrides: ov(smallBoard(), api));
        await tapVisible(tester, find.text('Confirmar pago'));
        expect(find.byType(MoveSheet), findsOneWidget);
        expect(find.textContaining('se descuenta el filamento'), findsOneWidget);
        expectSheetBelowStatusBar(tester);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Confirmar'), what: 'el botón Confirmar de la hoja');
        await shoot(tester, 'prod_hoja_confirmar_pago');
        await closeSheet(tester);
        expect(api.moves, isEmpty, reason: 'cerrar la hoja no cambia nada');

        // Y confirmando: se cierra sola y avisa.
        await tapVisible(tester, find.text('Confirmar pago'));
        await tester.tap(find.widgetWithText(GoldButton, 'Confirmar'));
        await settle(tester, 8);
        expect(sheet, findsNothing);
        expect(api.moves, [('m1', SaleStatus.confirmed)]);
        expect(find.textContaining('5 llaveros: Pago confirmado'), findsOneWidget);
        await shoot(tester, 'prod_aviso_movido');
      });

      testWidgets('hoja "Marcar listo" con nombre y cliente larguísimos en ${phone.name}', (tester) async {
        await pumpPhone(tester, const AdminProduccionScreen(),
            phone: phone, me: me, overrides: ov(smallBoard(), FakeProduccionApi()));
        await tapVisible(tester, find.text('Marcar listo'));
        expect(find.byType(MoveSheet), findsOneWidget);
        expectSheetBelowStatusBar(tester);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Confirmar'), what: 'el botón Confirmar de la hoja');
        await shoot(tester, 'prod_hoja_listo_largo');
        await closeSheet(tester);
      });

      testWidgets('hoja "Marcar enviado": código de seguimiento con teclado en ${phone.name}', (tester) async {
        final api = FakeProduccionApi();
        await pumpPhone(tester, const AdminProduccionScreen(), phone: phone, me: me, overrides: ov(smallBoard(), api));
        await tapVisible(tester, find.text('Marcar enviado'));
        final field = find.widgetWithText(TextField, 'Código de seguimiento');
        final confirm = find.widgetWithText(GoldButton, 'Confirmar');
        expectSheetBelowStatusBar(tester);
        expectReachable(tester, confirm, what: 'el botón Confirmar de la hoja');
        await shoot(tester, 'prod_hoja_enviado');

        await focusField(tester, field);
        expectFocusedFieldVisible(tester);
        expectReachable(tester, confirm, what: 'el botón Confirmar con el teclado abierto');
        expectSheetBelowStatusBar(tester, 'con el teclado abierto');
        await shoot(tester, 'prod_hoja_enviado_teclado');

        // El servidor rechaza (mensaje largo): se ve en la hoja y el botón sigue a mano.
        api.failWith = ApiException('invalid', longServerError);
        await type(tester, field, 'ab123456789ar');
        await tester.tap(confirm);
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expectReachable(tester, find.text(longServerError), what: 'el rechazo del servidor en la hoja');
        expect(find.byType(MoveSheet), findsOneWidget, reason: 'con error la hoja no se cierra');
        expectReachable(tester, confirm, what: 'el botón Confirmar con el error y el teclado');
        expectSheetBelowStatusBar(tester, 'con el error del servidor');
        await shoot(tester, 'prod_hoja_enviado_error');

        // Reintento que sale bien: primero el código, después el estado.
        api.failWith = null;
        await tester.tap(confirm);
        await settle(tester, 8);
        expect(api.trackings.last, ('o2', 'ab123456789ar'));
        expect(api.moves, [('o2', SaleStatus.shipped)]);
        expect(sheet, findsNothing);
      });
    }

    testWidgets('letra grande (1,3×) en el teléfono chico: cola y hojas', (tester) async {
      await pumpPhone(tester, const AdminProduccionScreen(),
          phone: Phone.small, textScale: 1.3, me: me, overrides: ov(bigBoard(), FakeProduccionApi()));
      await shoot(tester, 'prod_cola_grande');
      // Los rótulos de los botones no se parten ni se cortan.
      expectOneLine(tester, 'Confirmar pago', fontSize: 13, scale: 1.3);
      await expectListEndVisible(tester, find.byType(AdminCard).last, what: 'la última tarjeta con letra grande');
      await shoot(tester, 'prod_cola_grande_final');

      await pumpPhone(tester, const AdminProduccionScreen(),
          phone: Phone.small, textScale: 1.3, me: me, overrides: ov(smallBoard(), FakeProduccionApi()));
      await tapVisible(tester, find.text('Marcar listo'));
      expectSheetBelowStatusBar(tester);
      expectReachable(tester, find.widgetWithText(GoldButton, 'Confirmar'), what: 'Confirmar con letra grande');
      await shoot(tester, 'prod_hoja_listo_grande');
      await closeSheet(tester);

      await tapVisible(tester, find.text('Marcar enviado'));
      await focusField(tester, find.widgetWithText(TextField, 'Código de seguimiento'));
      expectFocusedFieldVisible(tester);
      expectReachable(tester, find.widgetWithText(GoldButton, 'Confirmar'), what: 'Confirmar con letra grande y teclado');
      expectSheetBelowStatusBar(tester, 'con letra grande y teclado');
      await shoot(tester, 'prod_hoja_enviado_grande_teclado');
    });

    for (final mode in [HefestoThemeMode.light, HefestoThemeMode.warm]) {
      testWidgets('tema ${mode.name}: cola y hoja', (tester) async {
        await pumpPhone(tester, const AdminProduccionScreen(),
            phone: Phone.small, theme: mode, me: me, overrides: ov(smallBoard(), FakeProduccionApi()));
        await shoot(tester, 'prod_cola_${mode.name}');
        await tapVisible(tester, find.text('Marcar enviado'));
        expectReachable(tester, find.widgetWithText(GoldButton, 'Confirmar'), what: 'Confirmar');
        await shoot(tester, 'prod_hoja_${mode.name}');
      });
    }
  });

  // =========================================================================
  // IMPRESIONES FALLIDAS
  // =========================================================================
  group('impresiones fallidas', () {
    final me = staffWith(['fallas']);
    List<Override> ov(FallasData d, [FallasApi? api]) => [
          fallasProvider.overrideWith((ref) async => d),
          if (api != null) fallasApiProvider.overrideWithValue(api),
        ];
    final fab = find.widgetWithText(FloatingActionButton, 'Registrar');

    for (final phone in Phone.both) {
      testWidgets('listado largo con datos extremos en ${phone.name}', (tester) async {
        await pumpPhone(tester, const AdminFallasScreen(), phone: phone, me: me, overrides: ov(bigFallas()));
        expect(find.text('Impresiones fallidas'), findsOneWidget);
        expectReachable(tester, fab, what: 'el botón Registrar');
        await shoot(tester, 'fallas_lista');
        await expectListEndVisible(tester, find.byType(AdminCard).last, what: 'la última falla');
        // La última fila no queda tapada por el botón flotante.
        final last = tester.getRect(find.byType(AdminCard).last);
        expect(last.bottom <= tester.getRect(fab).top + 0.5, isTrue,
            reason: 'el botón Registrar tapa la última falla');
        await shoot(tester, 'fallas_lista_final');
      });

      testWidgets('buscador con teclado y filtro por causa en ${phone.name}', (tester) async {
        await pumpPhone(tester, const AdminFallasScreen(), phone: phone, me: me, overrides: ov(bigFallas()));
        await openKeyboard(tester, find.byType(TextField));
        expectFocusedFieldVisible(tester);
        await type(tester, find.byType(TextField), 'no existe');
        await settle(tester, 3);
        expectNoLayoutErrors(tester);
        expect(find.text('Ninguna falla coincide con la búsqueda.'), findsOneWidget);
        await shoot(tester, 'fallas_buscar_teclado');
        await closeKeyboard(tester);
        await type(tester, find.byType(TextField), '');
        await settle(tester, 3);
        // La fila de causas se desplaza hasta la última.
        await tapVisible(tester, find.text('Otro (4)'));
        expect(find.byType(AdminCard), findsWidgets);
        await shoot(tester, 'fallas_filtro_causa');
      });

      testWidgets('estados: vacío, error, sin acceso y solo lectura en ${phone.name}', (tester) async {
        await pumpPhone(tester, const AdminFallasScreen(),
            phone: phone, me: me, overrides: ov(FallasData.fromJson({'items': <dynamic>[]})));
        expect(find.text('Sin fallas registradas'), findsOneWidget);
        await scrollToEnd(tester);
        expectReachable(tester, fab, what: 'el botón Registrar con la lista vacía');
        await shoot(tester, 'fallas_vacio');

        await pumpPhone(tester, const AdminFallasScreen(), phone: phone, me: me, overrides: [
          fallasProvider.overrideWith((ref) => throw ApiException('unavailable', 'No pudimos completar la operación. Probá de nuevo en unos segundos.')),
        ]);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Reintentar'), what: 'el botón Reintentar');
        expect(fab, findsNothing, reason: 'sin datos no hay alta');
        await shoot(tester, 'fallas_error');

        await pumpPhone(tester, const AdminFallasScreen(),
            phone: phone, me: staffWith(['fallas'], role: 'operator', actions: const []), overrides: ov(smallFallas()));
        expect(find.text('Sin acceso'), findsOneWidget);
        expect(fab, findsNothing);
        await shoot(tester, 'fallas_sin_acceso');

        await pumpPhone(tester, const AdminFallasScreen(),
            phone: phone, me: staffWith(['fallas'], role: 'operator', actions: const ['ver']), overrides: ov(smallFallas()));
        expect(fab, findsNothing, reason: 'sin fallas/crear no hay botón Registrar');
        await tapVisible(tester, find.text('Sin nombre'));
        expect(find.text('Editar'), findsNothing);
        expect(find.text('Eliminar'), findsNothing);
        expectSheetBelowStatusBar(tester);
        await shoot(tester, 'fallas_detalle_solo_lectura');
        await closeSheet(tester);
      });

      testWidgets('detalle de una falla: notas larguísimas y acciones a la vista en ${phone.name}', (tester) async {
        final api = FakeFallasApi();
        await pumpPhone(tester, const AdminFallasScreen(), phone: phone, me: me, overrides: ov(smallFallas(), api));
        await tapVisible(tester, find.text(longLabel));
        expectSheetBelowStatusBar(tester);
        expectReachable(tester, find.widgetWithText(OutlinedButton, 'Editar'), what: 'el botón Editar de la hoja');
        expectReachable(tester, find.widgetWithText(TextButton, 'Eliminar'), what: 'el botón Eliminar de la hoja');
        await shoot(tester, 'fallas_detalle_largo');
        // Las notas largas se desplazan dentro de la hoja.
        await scrollToEnd(tester, scrollable: find.descendant(of: sheet, matching: find.byType(Scrollable)).first);
        expectReachable(tester, find.widgetWithText(OutlinedButton, 'Editar'), what: 'Editar al final de la hoja');
        await shoot(tester, 'fallas_detalle_largo_final');

        // Eliminar: el diálogo de confirmación con el nombre larguísimo.
        await tester.tap(find.widgetWithText(TextButton, 'Eliminar'));
        await settle(tester);
        expectNoLayoutErrors(tester);
        final dialog = find.byType(AlertDialog);
        expect(dialog, findsOneWidget);
        expectReachable(tester, find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Eliminar')),
            what: 'la acción Eliminar del diálogo');
        expectReachable(tester, find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Cancelar')),
            what: 'la acción Cancelar del diálogo');
        await shoot(tester, 'fallas_eliminar_dialogo');
        await tester.tap(find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Eliminar')));
        await settle(tester, 8);
        expect(api.deletedId, 'a1');
        expect(sheet, findsNothing, reason: 'al eliminar se cierra la hoja');
        expect(find.textContaining('150 g devueltos al stock'), findsOneWidget);
        await shoot(tester, 'fallas_eliminada_aviso');
      });

      testWidgets('detalle de una falla vieja (todo vacío) y cancelar el borrado en ${phone.name}', (tester) async {
        final api = FakeFallasApi();
        await pumpPhone(tester, const AdminFallasScreen(), phone: phone, me: me, overrides: ov(smallFallas(), api));
        await tapVisible(tester, find.text('Sin nombre'));
        expect(find.text('No se descontó'), findsOneWidget);
        expectReachable(tester, find.widgetWithText(OutlinedButton, 'Editar'), what: 'Editar');
        await shoot(tester, 'fallas_detalle_vacio');
        await tester.tap(find.widgetWithText(TextButton, 'Eliminar'));
        await settle(tester);
        expect(find.textContaining('no descontó stock'), findsOneWidget);
        await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Cancelar')));
        await settle(tester);
        expect(api.deletedId, isNull);
        expect(sheet, findsOneWidget, reason: 'cancelar vuelve a la hoja');
        await closeSheet(tester);
      });

      testWidgets('el rechazo del servidor al eliminar se avisa en ${phone.name}', (tester) async {
        final api = FakeFallasApi()..failWith = ApiException('not_found', 'No encontramos la falla.');
        await pumpPhone(tester, const AdminFallasScreen(), phone: phone, me: me, overrides: ov(smallFallas(), api));
        await tapVisible(tester, find.text('Lámpara lunar'));
        await tester.tap(find.widgetWithText(TextButton, 'Eliminar'));
        await settle(tester);
        await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.widgetWithText(TextButton, 'Eliminar')));
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(sheet, findsOneWidget, reason: 'con error la hoja sigue abierta');
        expectOnTop(tester, find.text('No encontramos la falla.'), what: 'el rechazo del servidor');
        expectReachable(tester, find.text('No encontramos la falla.'), what: 'el rechazo del servidor');
        expectReachable(tester, find.widgetWithText(TextButton, 'Eliminar'), what: 'Eliminar con el error a la vista');
        await shoot(tester, 'fallas_eliminar_error');
      });

      testWidgets('alta: teclado en el primer y el último campo, guardar a mano en ${phone.name}', (tester) async {
        final api = FakeFallasApi();
        await pumpPhone(tester, const AdminFallasScreen(), phone: phone, me: me, overrides: ov(smallFallas(), api));
        await tester.tap(fab);
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        final save = find.widgetWithText(GoldButton, 'Registrar falla');
        expectReachable(tester, save, what: 'el botón Registrar falla');
        await shoot(tester, 'falla_alta');

        await focusField(tester, find.widgetWithText(TextField, 'Pieza / producto'));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, save, what: 'Registrar falla con el teclado (primer campo)');
        await shoot(tester, 'falla_alta_teclado_primero');
        await type(tester, find.widgetWithText(TextField, 'Pieza / producto'), longLabel);

        await focusField(tester, find.widgetWithText(TextField, 'Gramos perdidos'));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, save, what: 'Registrar falla con el teclado (gramos)');

        await focusField(tester, find.widgetWithText(TextField, 'Notas (opcional)'));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, save, what: 'Registrar falla con el teclado (último campo)');
        await shoot(tester, 'falla_alta_teclado_ultimo');
        await closeKeyboard(tester);

        // Sin carrete: los errores se ven y no se manda nada.
        await tester.tap(save);
        await settle(tester);
        expectNoLayoutErrors(tester);
        expect(api.created, isNull);
        await tester.ensureVisible(find.text('Elegí al menos un carrete y los gramos perdidos.'));
        await settle(tester, 2);
        await shoot(tester, 'falla_alta_errores');
        await scrollToEnd(tester);
        expectReachable(tester, save, what: 'Registrar falla al final del formulario');
      });

      testWidgets('alta: elegir carrete (36, nombres largos), varias líneas y guardar en ${phone.name}', (tester) async {
        final api = FakeFallasApi()..result = const FallaResult(deducted: true, lowStock: true);
        await pumpPhone(tester, const AdminFallasScreen(), phone: phone, me: me, overrides: ov(smallFallas(), api));
        await tester.tap(fab);
        await settle(tester, 8);
        await type(tester, find.widgetWithText(TextField, 'Pieza / producto'), 'Cartel');

        await tapVisible(tester, find.text('Elegí un carrete'));
        expect(find.text('Elegí el carrete'), findsOneWidget);
        expectSheetBelowStatusBar(tester);
        expectReachable(tester, find.text('Elegí el carrete'), what: 'el título de la hoja de carretes');
        await shoot(tester, 'falla_carretes');
        // Hasta el último carrete: no queda debajo de la barra del sistema.
        final list = find.descendant(of: sheet, matching: find.byType(Scrollable)).first;
        await scrollToEnd(tester, scrollable: list);
        expectReachable(tester, find.descendant(of: sheet, matching: find.byType(ListTile)).last,
            what: 'el último carrete de la lista');
        await shoot(tester, 'falla_carretes_final');
        await closeSheet(tester);

        await tapVisible(tester, find.text('Elegí un carrete'));
        await tester.tap(find.text('PLA · Rojo · Grilon3'));
        await settle(tester, 8);
        expect(sheet, findsNothing);
        await type(tester, find.widgetWithText(TextField, 'Gramos perdidos'), '900');
        await settle(tester, 2);
        expect(find.textContaining('Solo hay 840 g'), findsOneWidget);

        // Segunda línea con un carrete de nombre larguísimo.
        await tapVisible(tester, find.text('Agregar color'));
        await tapVisible(tester, find.text('Elegí un carrete'));
        await tester.tap(find.descendant(of: sheet, matching: find.byType(ListTile)).at(1));
        await settle(tester, 8);
        await type(tester, find.widgetWithText(TextField, 'Gramos perdidos').last, '12,5');
        await settle(tester, 2);
        expectNoLayoutErrors(tester);
        expect(find.text('Total perdido: 912,5 g'), findsOneWidget);
        expectTapTarget(
          tester,
          find.ancestor(of: find.byTooltip('Quitar').first, matching: find.byType(IconButton)),
          what: 'la cruz de quitar una línea',
        );
        await tester.ensureVisible(find.text('Total perdido: 912,5 g'));
        await settle(tester, 2);
        await shoot(tester, 'falla_alta_dos_lineas');

        await tester.tap(find.widgetWithText(GoldButton, 'Registrar falla'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(api.created!.lines, hasLength(2));
        expect(api.created!.gramsLost, 912.5);
        expect(find.byType(FallaFormScreen), findsNothing, reason: 'al guardar vuelve al listado');
        expect(find.textContaining('quedó stock bajo'), findsOneWidget);
        await shoot(tester, 'falla_alta_guardada');
      });

      testWidgets('alta sin carretes cargados: la hoja lo explica en ${phone.name}', (tester) async {
        await pumpPhone(tester, FallaFormScreen(data: smallFallas(carretes: 0)), phone: phone, me: me);
        await tapVisible(tester, find.text('Elegí un carrete'));
        expect(find.text('No hay carretes cargados'), findsOneWidget);
        expectSheetBelowStatusBar(tester);
        await shoot(tester, 'falla_carretes_vacio');
        await closeSheet(tester);
      });

      testWidgets('corrección: teclado en el primer y el último campo en ${phone.name}', (tester) async {
        final api = FakeFallasApi();
        final data = smallFallas();
        await pumpPhone(tester, const AdminFallasScreen(), phone: phone, me: me, overrides: ov(data, api));
        await tapVisible(tester, find.text(longLabel));
        await tester.tap(find.widgetWithText(OutlinedButton, 'Editar'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(find.text('Editar falla'), findsOneWidget);
        expect(sheet, findsNothing, reason: 'la hoja se cierra al pasar a editar');
        final save = find.widgetWithText(GoldButton, 'Guardar cambios');
        expectReachable(tester, save, what: 'el botón Guardar cambios');
        await shoot(tester, 'falla_edicion');

        await focusField(tester, find.widgetWithText(TextField, 'Pieza / producto'));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, save, what: 'Guardar cambios con el teclado (primer campo)');
        for (final label in ['Material', 'Color', 'Gramos perdidos', 'Notas (opcional)']) {
          await focusField(tester, find.widgetWithText(TextField, label));
          expectFocusedFieldVisible(tester);
          expectReachable(tester, save, what: 'Guardar cambios con el teclado ($label)');
        }
        await shoot(tester, 'falla_edicion_teclado_ultimo');
        await closeKeyboard(tester);

        await scrollToEnd(tester);
        await shoot(tester, 'falla_edicion_final');
        await type(tester, find.widgetWithText(TextField, 'Gramos perdidos'), '175,5');
        await settle(tester, 2);
        await tester.tap(save);
        await settle(tester, 8);
        expect(api.updated!.gramsLost, 175.5);
        expect(find.text('Falla actualizada'), findsOneWidget);
      });

      testWidgets('un error del servidor al guardar queda a la vista en ${phone.name}', (tester) async {
        final api = FakeFallasApi()..failWith = ApiException('invalid', longServerError);
        final data = smallFallas();
        await pumpPhone(tester, FallaFormScreen(data: data, falla: data.items.last),
            phone: phone, me: me, overrides: [fallasApiProvider.overrideWithValue(api)]);
        await focusField(tester, find.widgetWithText(TextField, 'Gramos perdidos'));
        await type(tester, find.widgetWithText(TextField, 'Gramos perdidos'), '10');
        await settle(tester, 2);
        await tester.tap(find.widgetWithText(GoldButton, 'Guardar cambios'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expectReachable(tester, find.text(longServerError), what: 'el error del servidor (con el teclado abierto)');
        expectReachable(tester, find.widgetWithText(GoldButton, 'Guardar cambios'), what: 'Guardar con el error del servidor');
        await shoot(tester, 'falla_edicion_error');
        await closeKeyboard(tester);
      });
    }

    testWidgets('volver con una falla a medio cargar pregunta antes de descartar', (tester) async {
      await pumpPhone(tester, const AdminFallasScreen(),
          phone: Phone.small, me: me, overrides: ov(smallFallas(), FakeFallasApi()));
      await tester.tap(fab);
      await settle(tester, 8);
      // Sin tocar nada, "atrás" sale directo.
      await tester.tap(find.byType(BackButton));
      await settle(tester, 8);
      expect(find.byType(FallaFormScreen), findsNothing);

      await tester.tap(fab);
      await settle(tester, 8);
      await type(tester, find.widgetWithText(TextField, 'Pieza / producto'), 'Cartel');
      await tester.tap(find.byType(BackButton));
      await settle(tester);
      expectNoLayoutErrors(tester);
      final dialog = find.byType(AlertDialog);
      expect(find.text('¿Descartar los cambios?'), findsOneWidget);
      expectReachable(tester, find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Descartar')),
          what: 'Descartar');
      expectReachable(tester, find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Seguir editando')),
          what: 'Seguir editando');
      await shoot(tester, 'falla_descartar_dialogo');
      await tester.tap(find.descendant(of: dialog, matching: find.text('Seguir editando')));
      await settle(tester);
      expect(find.byType(FallaFormScreen), findsOneWidget, reason: 'sigue en el formulario con lo cargado');
      expect(find.text('Cartel'), findsOneWidget);

      await tester.tap(find.byType(BackButton));
      await settle(tester);
      await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Descartar')));
      await settle(tester, 8);
      expect(find.byType(FallaFormScreen), findsNothing);
    });

    testWidgets('letra grande (1,3×) en el teléfono chico: listado, hojas y formularios', (tester) async {
      final data = smallFallas();
      await pumpPhone(tester, const AdminFallasScreen(),
          phone: Phone.small, textScale: 1.3, me: me, overrides: ov(bigFallas(), FakeFallasApi()));
      await shoot(tester, 'fallas_lista_grande');
      await expectListEndVisible(tester, find.byType(AdminCard).last, what: 'la última falla con letra grande');

      await pumpPhone(tester, const AdminFallasScreen(),
          phone: Phone.small, textScale: 1.3, me: me, overrides: ov(data, FakeFallasApi()));
      await tapVisible(tester, find.text(longLabel));
      expectSheetBelowStatusBar(tester);
      expectReachable(tester, find.widgetWithText(OutlinedButton, 'Editar'), what: 'Editar con letra grande');
      expectReachable(tester, find.widgetWithText(TextButton, 'Eliminar'), what: 'Eliminar con letra grande');
      await shoot(tester, 'fallas_detalle_grande');
      await tester.tap(find.widgetWithText(TextButton, 'Eliminar'));
      await settle(tester);
      expectNoLayoutErrors(tester);
      final dialog = find.byType(AlertDialog);
      expectReachable(tester, find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Eliminar')),
          what: 'Eliminar del diálogo con letra grande');
      expectReachable(tester, find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Cancelar')),
          what: 'Cancelar del diálogo con letra grande');
      await shoot(tester, 'fallas_eliminar_dialogo_grande');

      await pumpPhone(tester, FallaFormScreen(data: data), phone: Phone.small, textScale: 1.3, me: me);
      await shoot(tester, 'falla_alta_grande');
      await tapVisible(tester, find.text('Elegí un carrete'));
      expectSheetBelowStatusBar(tester);
      await shoot(tester, 'falla_carretes_grande');
      await tester.tap(find.descendant(of: sheet, matching: find.byType(ListTile)).at(1));
      await settle(tester, 8);
      await focusField(tester, find.widgetWithText(TextField, 'Notas (opcional)'));
      expectFocusedFieldVisible(tester);
      expectReachable(tester, find.widgetWithText(GoldButton, 'Registrar falla'), what: 'Registrar con letra grande y teclado');
      await shoot(tester, 'falla_alta_grande_teclado');
      await closeKeyboard(tester);
      await scrollToEnd(tester);
      await shoot(tester, 'falla_alta_grande_final');

      await pumpPhone(tester, FallaFormScreen(data: data, falla: data.items.first),
          phone: Phone.small, textScale: 1.3, me: me);
      await shoot(tester, 'falla_edicion_grande');
      await scrollToEnd(tester);
      await shoot(tester, 'falla_edicion_grande_final');
    });

    for (final mode in [HefestoThemeMode.light, HefestoThemeMode.warm]) {
      testWidgets('tema ${mode.name}: listado, detalle, alta y carretes', (tester) async {
        final data = smallFallas();
        await pumpPhone(tester, const AdminFallasScreen(),
            phone: Phone.small, theme: mode, me: me, overrides: ov(data, FakeFallasApi()));
        await shoot(tester, 'fallas_lista_${mode.name}');
        await tapVisible(tester, find.text('Lámpara lunar'));
        await shoot(tester, 'fallas_detalle_${mode.name}');
        await pumpPhone(tester, FallaFormScreen(data: data), phone: Phone.small, theme: mode, me: me);
        await shoot(tester, 'falla_alta_${mode.name}');
        await tapVisible(tester, find.text('Elegí un carrete'));
        await shoot(tester, 'falla_carretes_${mode.name}');
      });
    }
  });

  // =========================================================================
  // PESTAÑA STOCK
  // =========================================================================
  group('pestaña Stock', () {
    final me = staffWith(['filamentos']);
    final fab = find.widgetWithText(FloatingActionButton, 'Agregar');
    List<Override> ov(StockPage page, [FilamentosApi? api]) => [
          adminStockProvider.overrideWith((ref) async => page),
          if (api != null) filamentosApiProvider.overrideWithValue(api),
        ];

    for (final phone in Phone.both) {
      testWidgets('36 carretes con textos y números extremos en ${phone.name}', (tester) async {
        await pumpPhone(tester, const AdminStockScreen(), phone: phone, me: me, overrides: ov(bigStock()));
        expectReachable(tester, fab, what: 'el botón Agregar');
        expectReachable(tester, find.byTooltip('Más opciones'), what: 'el menú de la barra');
        expectReachable(tester, find.byTooltip('Historial de movimientos'), what: 'el historial');
        await shoot(tester, 'stock_lista');
        await expectListEndVisible(tester, find.byType(FilamentTile).last, what: 'el último carrete');
        expect(tester.getRect(find.byType(FilamentTile).last).bottom <= tester.getRect(fab).top + 0.5, isTrue,
            reason: 'el botón Agregar tapa el último carrete');
        await shoot(tester, 'stock_lista_final');
      });

      testWidgets('buscador con teclado y filtro de alertas en ${phone.name}', (tester) async {
        await pumpPhone(tester, const AdminStockScreen(), phone: phone, me: me, overrides: ov(bigStock()));
        await openKeyboard(tester, find.byType(TextField));
        expectFocusedFieldVisible(tester);
        await type(tester, find.byType(TextField), 'no existe');
        await settle(tester, 3);
        expectNoLayoutErrors(tester);
        expect(find.text('Sin resultados'), findsOneWidget);
        await shoot(tester, 'stock_buscar_teclado');
        await closeKeyboard(tester);
        await type(tester, find.byType(TextField), '');
        await settle(tester, 3);
        await tapVisible(tester, find.text('Con alerta (24)'));
        expect(find.byType(FilamentTile), findsWidgets);
        await shoot(tester, 'stock_alertas');
      });

      testWidgets('estados: vacío, todo bien, error, sin acceso y solo lectura en ${phone.name}', (tester) async {
        await pumpPhone(tester, const AdminStockScreen(),
            phone: phone, me: me, overrides: ov(StockPage.fromJson({'items': <dynamic>[]})));
        expect(find.text('Todavía no cargaste filamentos'), findsOneWidget);
        await scrollToEnd(tester);
        await shoot(tester, 'stock_vacio');

        await pumpPhone(tester, const AdminStockScreen(), phone: phone, me: me, overrides: [
          adminStockProvider.overrideWith((ref) async => StockPage.fromJson({
                'counts': {'total': 1, 'low': 0, 'out': 0},
                'items': [filamentJson('1', stock: 840, status: 'ok')],
              })),
        ]);
        await tapVisible(tester, find.text('Con alerta (0)'));
        expect(find.text('¡Todo el stock está bien!'), findsOneWidget);
        await scrollToEnd(tester);
        await shoot(tester, 'stock_todo_bien');

        await pumpPhone(tester, const AdminStockScreen(), phone: phone, me: me, overrides: [
          adminStockProvider.overrideWith((ref) => throw ApiException('offline', 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.')),
        ]);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Reintentar'), what: 'el botón Reintentar');
        await shoot(tester, 'stock_error');

        await pumpPhone(tester, const AdminStockScreen(),
            phone: phone, me: staffWith(['filamentos'], role: 'operator', actions: const []), overrides: ov(smallStock));
        expect(find.text('Sin acceso'), findsOneWidget);
        expect(fab, findsNothing);
        await shoot(tester, 'stock_sin_acceso');

        await pumpPhone(tester, const AdminStockScreen(),
            phone: phone, me: staffWith(['filamentos'], role: 'operator', actions: const ['ver']), overrides: ov(smallStock));
        expect(fab, findsNothing, reason: 'sin filamentos/crear no hay botón Agregar');
        expect(find.byType(FilamentTile), findsNWidgets(3));
        await shoot(tester, 'stock_solo_lectura');
      });

      testWidgets('menú de la barra y "copiar colores" en ${phone.name}', (tester) async {
        final copied = mockClipboard(tester);
        await pumpPhone(tester, const AdminStockScreen(),
            phone: phone, me: me, overrides: ov(smallStock, TallerFilamentosApi()));
        await tester.tap(find.byTooltip('Más opciones'));
        await settle(tester);
        expectNoLayoutErrors(tester);
        expectReachable(tester, find.text('Informe de stock'), what: 'la opción Informe de stock');
        expectReachable(tester, find.text('Copiar colores en stock'), what: 'la opción Copiar colores');
        await shoot(tester, 'stock_menu');
        await tester.tap(find.text('Copiar colores en stock'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(copied.single, contains('• Blanco\n• Rojo'));
        expect(find.text('Plantilla de colores copiada'), findsOneWidget);
        await shoot(tester, 'stock_colores_copiados');
      });

      testWidgets('informe de stock: texto largo que se desplaza y botones siempre a la vista en ${phone.name}', (tester) async {
        final copied = mockClipboard(tester);
        final api = TallerFilamentosApi()..reportText = longReport();
        await pumpPhone(tester, const AdminStockScreen(), phone: phone, me: me, overrides: ov(smallStock, api));
        await tester.tap(find.byTooltip('Más opciones'));
        await settle(tester);
        await tester.tap(find.text('Informe de stock'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        final wa = find.widgetWithText(GoldButton, 'WhatsApp');
        final copy = find.widgetWithText(OutlinedButton, 'Copiar');
        expect(find.text('Informe de filamentos'), findsOneWidget);
        expectSheetBelowStatusBar(tester);
        expectReachable(tester, wa, what: 'el botón WhatsApp del informe');
        expectReachable(tester, copy, what: 'el botón Copiar del informe');
        await shoot(tester, 'informe');

        // El texto se desplaza hasta el final y los botones no se mueven.
        final scroll = find.descendant(of: sheet, matching: find.byType(Scrollable)).first;
        await scrollToEnd(tester, scrollable: scroll);
        expectReachable(tester, wa, what: 'WhatsApp con el informe desplazado');
        expectReachable(tester, copy, what: 'Copiar con el informe desplazado');
        await shoot(tester, 'informe_final');

        // Con el teclado (el texto se puede retocar): los botones siguen a la vista.
        await openKeyboardOnReport(tester);
        expectCaretVisible(tester);
        expectReachable(tester, wa, what: 'WhatsApp con el teclado abierto');
        expectReachable(tester, copy, what: 'Copiar con el teclado abierto');
        expectSheetBelowStatusBar(tester, 'con el teclado abierto');
        await shoot(tester, 'informe_teclado');
        await closeKeyboard(tester);

        await tester.tap(copy);
        await settle(tester, 4);
        expectNoLayoutErrors(tester);
        expect(copied.single, longReport());
        // La confirmación se ve EN el botón (un aviso quedaba detrás de la hoja).
        expectOnTop(tester, find.text('Copiado'), what: 'la confirmación de copiado');
        await shoot(tester, 'informe_copiado');
        await tester.pump(const Duration(seconds: 3));
        expect(find.text('Copiado'), findsNothing, reason: 'a los 2 segundos vuelve a decir Copiar');
        expect(find.widgetWithText(OutlinedButton, 'Copiar'), findsOneWidget);

        // (El botón WhatsApp no se toca: abre otra app y acá no hay plataforma.)
        await closeSheet(tester);
      });

      testWidgets('informe de stock: cargando y error con Reintentar en ${phone.name}', (tester) async {
        final gate = Completer<void>();
        final api = TallerFilamentosApi()
          ..reportGate = gate
          ..reportError = ApiException('offline', 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.');
        await pumpPhone(tester, const AdminStockScreen(), phone: phone, me: me, overrides: ov(smallStock, api));
        await tester.tap(find.byTooltip('Más opciones'));
        await settle(tester);
        await tester.tap(find.text('Informe de stock'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(find.byType(CircularProgressIndicator), findsOneWidget);
        expectSheetBelowStatusBar(tester, 'mientras carga');
        await shoot(tester, 'informe_cargando');

        gate.complete();
        await settle(tester, 6);
        expectNoLayoutErrors(tester);
        final retry = find.widgetWithText(GoldButton, 'Reintentar');
        expectReachable(tester, retry, what: 'Reintentar del informe');
        await shoot(tester, 'informe_error');

        api
          ..reportGate = null
          ..reportError = null;
        await tester.tap(retry);
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expectReachable(tester, find.widgetWithText(GoldButton, 'WhatsApp'), what: 'WhatsApp tras reintentar');
        await shoot(tester, 'informe_corto');
        await closeSheet(tester);
      });

      testWidgets('dentro del panel real (con barra inferior): lista, menú e informe en ${phone.name}', (tester) async {
        final api = TallerFilamentosApi()..reportText = longReport();
        await pumpPhone(tester, const SizedBox(),
            phone: phone, me: me, router: shellRouter(), overrides: [...shellOverrides(), ...ov(bigStock(), api)]);
        expect(find.byType(NavigationBar), findsOneWidget);
        expectReachable(tester, fab, what: 'el botón Agregar (con la barra del panel)');
        expect(tester.getRect(fab).bottom <= tester.getRect(find.byType(NavigationBar)).top + 0.5, isTrue,
            reason: 'el botón Agregar queda sobre la barra del panel');
        await shoot(tester, 'stock_panel');
        await scrollToEnd(tester, scrollable: find.descendant(of: find.byType(AdminStockScreen), matching: find.byType(Scrollable)).first);
        expect(tester.getRect(find.byType(FilamentTile).last).bottom <= tester.getRect(fab).top + 0.5, isTrue,
            reason: 'el botón Agregar tapa el último carrete');
        await shoot(tester, 'stock_panel_final');

        await tester.tap(find.byTooltip('Más opciones'));
        await settle(tester);
        await shoot(tester, 'stock_panel_menu');
        await tester.tap(find.text('Informe de stock'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        final wa = find.widgetWithText(GoldButton, 'WhatsApp');
        final copy = find.widgetWithText(OutlinedButton, 'Copiar');
        expectSheetBelowStatusBar(tester);
        expectReachable(tester, wa, what: 'WhatsApp (informe abierto desde el panel)');
        expectReachable(tester, copy, what: 'Copiar (informe abierto desde el panel)');
        await shoot(tester, 'stock_panel_informe');
        await openKeyboardOnReport(tester);
        expectCaretVisible(tester);
        expectReachable(tester, wa, what: 'WhatsApp con teclado (desde el panel)');
        expectReachable(tester, copy, what: 'Copiar con teclado (desde el panel)');
        expectSheetBelowStatusBar(tester, 'con teclado (desde el panel)');
        await shoot(tester, 'stock_panel_informe_teclado');
      });
    }

    testWidgets('letra grande (1,3×) en el teléfono chico: lista, menú e informe', (tester) async {
      final api = TallerFilamentosApi()..reportText = longReport();
      await pumpPhone(tester, const AdminStockScreen(),
          phone: Phone.small, textScale: 1.3, me: me, overrides: ov(bigStock(), api));
      await shoot(tester, 'stock_lista_grande');
      await expectListEndVisible(tester, find.byType(FilamentTile).last, what: 'el último carrete con letra grande');
      await tester.tap(find.byTooltip('Más opciones'));
      await settle(tester);
      expectNoLayoutErrors(tester);
      await shoot(tester, 'stock_menu_grande');
      await tester.tap(find.text('Informe de stock'));
      await settle(tester, 8);
      expectNoLayoutErrors(tester);
      expectSheetBelowStatusBar(tester);
      expectReachable(tester, find.widgetWithText(GoldButton, 'WhatsApp'), what: 'WhatsApp con letra grande');
      expectReachable(tester, find.widgetWithText(OutlinedButton, 'Copiar'), what: 'Copiar con letra grande');
      await shoot(tester, 'informe_grande');
      await openKeyboardOnReport(tester);
      expectCaretVisible(tester);
      expectReachable(tester, find.widgetWithText(GoldButton, 'WhatsApp'), what: 'WhatsApp con letra grande y teclado');
      expectReachable(tester, find.widgetWithText(OutlinedButton, 'Copiar'), what: 'Copiar con letra grande y teclado');
      expectSheetBelowStatusBar(tester, 'con letra grande y teclado');
      await shoot(tester, 'informe_grande_teclado');
    });

    for (final mode in [HefestoThemeMode.light, HefestoThemeMode.warm]) {
      testWidgets('tema ${mode.name}: lista, menú e informe', (tester) async {
        final api = TallerFilamentosApi()..reportText = longReport();
        await pumpPhone(tester, const AdminStockScreen(),
            phone: Phone.small, theme: mode, me: me, overrides: ov(smallStock, api));
        await shoot(tester, 'stock_lista_${mode.name}');
        await tester.tap(find.byTooltip('Más opciones'));
        await settle(tester);
        await shoot(tester, 'stock_menu_${mode.name}');
        await tester.tap(find.text('Informe de stock'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        await shoot(tester, 'informe_${mode.name}');
      });
    }
  });

  // =========================================================================
  // FILAMENTOS: detalle, ajuste de stock, formulario, catálogo e historial
  // =========================================================================
  group('filamentos', () {
    final me = staffWith(['filamentos']);
    List<Override> detailOv(Filamento f, {List<FilamentMovement>? movs, FilamentosApi? api}) => [
          filamentoProvider.overrideWith((ref, id) async => f),
          filamentMovementsProvider.overrideWith((ref, id) async => movs ?? movements(40)),
          if (api != null) filamentosApiProvider.overrideWithValue(api),
        ];
    List<Override> formOv([FilamentosApi? api]) => [
          filamentCatalogProvider.overrideWith((ref) async => bigCatalog()),
          if (api != null) filamentosApiProvider.overrideWithValue(api),
        ];

    for (final phone in Phone.both) {
      testWidgets('detalle con 40 movimientos y datos extremos en ${phone.name}', (tester) async {
        await pumpPhone(tester, const FilamentoDetailScreen(id: '9'), phone: phone, me: me, overrides: detailOv(extremo));
        expect(find.text('Ajustar stock'), findsOneWidget);
        expectReachable(tester, find.byTooltip('Editar'), what: 'Editar de la barra');
        expectReachable(tester, find.byTooltip('Eliminar'), what: 'Eliminar de la barra');
        await shoot(tester, 'fil_detalle');
        await reveal(tester, find.text('Alerta de stock bajo'));
        await shoot(tester, 'fil_detalle_costos');
        await expectListEndVisible(tester, find.byType(MovementTile).last, what: 'el último movimiento');
        await shoot(tester, 'fil_detalle_final');
      });

      testWidgets('detalle: deuda, sin movimientos, error del historial y solo lectura en ${phone.name}', (tester) async {
        await pumpPhone(tester, const FilamentoDetailScreen(id: '3'),
            phone: phone, me: me, overrides: detailOv(deuda, movs: const []));
        expect(find.textContaining('Debés 1,53 kg'), findsOneWidget);
        await shoot(tester, 'fil_detalle_deuda');
        await expectListEndVisible(tester, find.textContaining('Todavía no hay movimientos'), what: 'el aviso de sin movimientos');
        await shoot(tester, 'fil_detalle_sin_movs');

        await pumpPhone(tester, const FilamentoDetailScreen(id: '2'), phone: phone, me: me, overrides: [
          filamentoProvider.overrideWith((ref, id) async => rojo),
          filamentMovementsProvider.overrideWith((ref, id) => throw ApiException('unavailable', 'No pudimos completar la operación. Probá de nuevo en unos segundos.')),
        ]);
        await expectListEndVisible(tester, find.widgetWithText(TextButton, 'Reintentar'), what: 'Reintentar del historial');
        await shoot(tester, 'fil_detalle_error_movs');

        await pumpPhone(tester, const FilamentoDetailScreen(id: '2'), phone: phone, me: me, overrides: [
          filamentoProvider.overrideWith((ref, id) => throw ApiException('not_found', 'No encontramos el filamento.')),
          filamentMovementsProvider.overrideWith((ref, id) async => <FilamentMovement>[]),
        ]);
        expect(find.text('No encontramos el filamento.'), findsOneWidget);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Reintentar'), what: 'Reintentar del detalle');
        await shoot(tester, 'fil_detalle_error');

        await pumpPhone(tester, const FilamentoDetailScreen(id: '2'),
            phone: phone, me: staffWith(['filamentos'], role: 'operator', actions: const ['ver']), overrides: detailOv(rojo));
        expect(find.text('Ajustar stock'), findsNothing);
        expect(find.byTooltip('Editar'), findsNothing);
        expect(find.byTooltip('Eliminar'), findsNothing);
        await shoot(tester, 'fil_detalle_solo_lectura');
      });

      testWidgets('ajustar stock: hoja con teclado en cada campo en ${phone.name}', (tester) async {
        final api = TallerFilamentosApi();
        await pumpPhone(tester, const FilamentoDetailScreen(id: '9'),
            phone: phone, me: me, overrides: detailOv(extremo, api: api));
        await tapVisible(tester, find.widgetWithText(GoldButton, 'Ajustar stock'));
        final apply = find.widgetWithText(GoldButton, 'Aplicar ajuste');
        expectSheetBelowStatusBar(tester);
        expectReachable(tester, apply, what: 'el botón Aplicar ajuste');
        await shoot(tester, 'ajuste');

        // Primer campo (en el teléfono el teclado se abre solo: tiene autofoco).
        await focusField(tester, find.widgetWithText(TextField, 'Gramos'));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, apply, what: 'Aplicar ajuste con el teclado (gramos)');
        expectSheetBelowStatusBar(tester, 'con el teclado abierto');
        await shoot(tester, 'ajuste_teclado_gramos');
        await type(tester, find.widgetWithText(TextField, 'Gramos'), '1250,5');
        await settle(tester, 3);
        expectNoLayoutErrors(tester);
        expect(find.textContaining('Queda en 100,02 kg'), findsOneWidget);

        // Último campo.
        await focusField(tester, find.widgetWithText(TextField, 'Motivo (opcional)'));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, apply, what: 'Aplicar ajuste con el teclado (motivo)');
        expectSheetBelowStatusBar(tester, 'con el teclado abierto en el motivo');
        await shoot(tester, 'ajuste_teclado_motivo');

        // Restar más de lo que hay: el error se ve y no deja aplicar.
        await tapVisible(tester, find.text('Restar'));
        await type(tester, find.widgetWithText(TextField, 'Gramos'), '999999');
        await settle(tester, 3);
        expectNoLayoutErrors(tester);
        expect(find.textContaining('No podés restar más de lo que hay'), findsOneWidget);
        await tester.ensureVisible(find.textContaining('No podés restar más de lo que hay'));
        await settle(tester, 2);
        await shoot(tester, 'ajuste_restar_error');

        // Contado + rechazo largo del servidor.
        await tapVisible(tester, find.text('Contado'));
        await type(tester, find.widgetWithText(TextField, 'Stock contado'), '95,5');
        await settle(tester, 3);
        api.failWith = ApiException('invalid', longServerError);
        await tester.tap(apply);
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(api.adjusts, isEmpty);
        expectReachable(tester, find.text(longServerError), what: 'el rechazo del servidor en la hoja');
        expectReachable(tester, apply, what: 'Aplicar ajuste con el error del servidor');
        await shoot(tester, 'ajuste_contado_error');

        api.failWith = null;
        await tester.tap(apply);
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(api.adjusts.single.newStock, 95.5);
        expect(api.adjusts.single.delta, isNull);
        expect(sheet, findsNothing, reason: 'al aplicar se cierra la hoja');
        expect(find.textContaining('Stock: 840 g → 1,84 kg'), findsOneWidget);
        await shoot(tester, 'ajuste_aplicado_aviso');
      });

      testWidgets('ajustar stock: se cierra sin aplicar nada en ${phone.name}', (tester) async {
        final api = TallerFilamentosApi();
        await pumpPhone(tester, const FilamentoDetailScreen(id: '2'), phone: phone, me: me, overrides: detailOv(rojo, api: api));
        await tapVisible(tester, find.widgetWithText(GoldButton, 'Ajustar stock'));
        await tester.tap(find.text('250 g'));
        await settle(tester, 3);
        expect(find.text('Queda en 370 g (+250 g)'), findsOneWidget);
        await shoot(tester, 'ajuste_atajo');
        await closeSheet(tester);
        expect(api.adjusts, isEmpty);
      });

      testWidgets('diálogos del detalle: sumar un carrete y eliminar en ${phone.name}', (tester) async {
        final api = TallerFilamentosApi();
        await pumpPhone(tester, const FilamentoDetailScreen(id: '9'),
            phone: phone, me: me, overrides: detailOv(extremo, api: api));
        await tapVisible(tester, find.textContaining('Sumar 1 carrete'));
        var dialog = find.byType(AlertDialog);
        expectReachable(tester, find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Sumar')), what: 'Sumar del diálogo');
        expectReachable(tester, find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Cancelar')), what: 'Cancelar del diálogo');
        await shoot(tester, 'fil_sumar_carrete_dialogo');
        await tester.tap(find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Sumar')));
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(api.adjusts.single.delta, 5000);
        await shoot(tester, 'fil_sumar_carrete_aviso');

        await tester.tap(find.byTooltip('Eliminar'));
        await settle(tester);
        expectNoLayoutErrors(tester);
        dialog = find.byType(AlertDialog);
        expectReachable(tester, find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Eliminar')), what: 'Eliminar del diálogo');
        expectReachable(tester, find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Cancelar')), what: 'Cancelar del diálogo');
        await shoot(tester, 'fil_eliminar_dialogo');
        await tester.tap(find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Eliminar')));
        await settle(tester, 8);
        expect(api.deletedId, '9');
      });

      testWidgets('alta de filamento: teclado en el primer y el último campo en ${phone.name}', (tester) async {
        final api = TallerFilamentosApi();
        await pumpPhone(tester, const AdminStockScreen(), phone: phone, me: me, overrides: [
          adminStockProvider.overrideWith((ref) async => smallStock),
          ...formOv(api),
        ]);
        await tester.tap(find.widgetWithText(FloatingActionButton, 'Agregar'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(find.text('Nuevo filamento'), findsOneWidget);
        final save = find.widgetWithText(GoldButton, 'Agregar filamento');
        expectReachable(tester, save, what: 'el botón Agregar filamento');
        await shoot(tester, 'fil_alta');

        for (final label in ['Stock inicial', 'Carrete', 'Alerta', 'Costo por kg']) {
          await focusField(tester, find.widgetWithText(TextField, label));
          expectFocusedFieldVisible(tester);
          expectReachable(tester, save, what: 'Agregar filamento con el teclado ($label)');
          if (label == 'Stock inicial') await shoot(tester, 'fil_alta_teclado_primero');
        }
        await shoot(tester, 'fil_alta_teclado_ultimo');

        // Datos inválidos: los mensajes entran sin romper la fila de dos campos.
        await type(tester, find.widgetWithText(TextField, 'Carrete'), '0');
        await type(tester, find.widgetWithText(TextField, 'Costo por kg'), '987654321');
        await closeKeyboard(tester);
        await tester.tap(save);
        await settle(tester);
        expectNoLayoutErrors(tester);
        expect(api.created, isNull);
        expect(find.text('El tamaño del carrete tiene que ser mayor a 0.'), findsOneWidget);
        await scrollToEnd(tester);
        await shoot(tester, 'fil_alta_errores');

        await type(tester, find.widgetWithText(TextField, 'Carrete'), '1000');
        await type(tester, find.widgetWithText(TextField, 'Stock inicial'), '750,5');
        await settle(tester, 2);
        await tester.tap(save);
        await settle(tester, 8);
        expect(api.created!.stockGrams, 750.5);
        expect(api.created!.costPerKg, 987654321);
        expect(find.byType(FilamentoFormScreen), findsNothing);
        expect(find.text('Filamento agregado'), findsOneWidget);
      });

      testWidgets('selector de color: 40 colores, agregar uno nuevo con teclado en ${phone.name}', (tester) async {
        final api = TallerFilamentosApi();
        await pumpPhone(tester, const FilamentoFormScreen(), phone: phone, me: me, overrides: formOv(api));
        await tapVisible(tester, find.text('Negro'));
        expect(find.text('Color'), findsWidgets);
        expectSheetBelowStatusBar(tester);
        final add = find.descendant(of: sheet, matching: find.widgetWithText(TextButton, 'Agregar'));
        expectReachable(tester, add, what: 'el botón Agregar del selector');
        expectTapTarget(
          tester,
          find.ancestor(of: find.byTooltip('Quitar del catálogo').first, matching: find.byType(IconButton)),
          what: 'el tacho de quitar del catálogo',
        );
        await shoot(tester, 'fil_colores');
        final list = find.descendant(of: sheet, matching: find.byType(Scrollable)).first;
        await scrollToEnd(tester, scrollable: list);
        expectReachable(tester, find.descendant(of: sheet, matching: find.byType(ListTile)).last, what: 'el último color de la lista');
        await shoot(tester, 'fil_colores_final');

        // Agregar un color nuevo (diálogo con dos campos).
        await tester.tap(add);
        await settle(tester);
        expectNoLayoutErrors(tester);
        final dialog = find.byType(AlertDialog);
        final ok = find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Agregar'));
        final cancel = find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Cancelar'));
        expect(find.text('Nuevo color'), findsOneWidget);
        expectReachable(tester, ok, what: 'Agregar del diálogo');
        expectReachable(tester, cancel, what: 'Cancelar del diálogo');
        await shoot(tester, 'fil_color_nuevo');

        await focusField(tester, find.widgetWithText(TextField, 'Nombre del color'));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, ok, what: 'Agregar del diálogo con el teclado (nombre)');
        expectReachable(tester, cancel, what: 'Cancelar del diálogo con el teclado (nombre)');
        await shoot(tester, 'fil_color_nuevo_teclado_nombre');
        await type(tester, find.widgetWithText(TextField, 'Nombre del color'), 'Verde militar metalizado con brillos oro');

        await focusField(tester, find.widgetWithText(TextField, 'Código (#RRGGBB)'));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, ok, what: 'Agregar del diálogo con el teclado (código)');
        expectReachable(tester, cancel, what: 'Cancelar del diálogo con el teclado (código)');
        await shoot(tester, 'fil_color_nuevo_teclado_codigo');

        // Código inválido: el error se ve con el teclado abierto.
        await type(tester, find.widgetWithText(TextField, 'Código (#RRGGBB)'), '#ZZ');
        await tester.tap(ok);
        await settle(tester, 3);
        expectNoLayoutErrors(tester);
        expect(find.textContaining('Elegí un color válido'), findsOneWidget);
        expect(api.catalogAdds, isEmpty);
        await tester.ensureVisible(find.textContaining('Elegí un color válido'));
        await settle(tester, 2);
        expectReachable(tester, ok, what: 'Agregar del diálogo con el error');
        await shoot(tester, 'fil_color_nuevo_error');

        // Las muestras de color se pueden tocar cómodas.
        await closeKeyboard(tester);
        expectTapTarget(tester, find.byKey(const ValueKey('preset-#D14B3C')), what: 'una muestra de color');
        await tester.tap(find.byKey(const ValueKey('preset-#D14B3C')));
        await settle(tester, 2);
        await tester.tap(ok);
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(api.catalogAdds, [('color', 'Verde militar metalizado con brillos oro', '#D14B3C')]);
        expect(sheet, findsNothing, reason: 'al agregar queda elegido y se cierra el selector');
        expect(find.text('Verde militar metalizado con brillos oro'), findsOneWidget);
        await shoot(tester, 'fil_color_elegido');
      });

      testWidgets('selector de marca y de material: elegir, agregar y quitar en ${phone.name}', (tester) async {
        final api = TallerFilamentosApi();
        await pumpPhone(tester, const FilamentoFormScreen(), phone: phone, me: me, overrides: formOv(api));
        await tapVisible(tester, find.text('Grilon3'));
        expectSheetBelowStatusBar(tester);
        await shoot(tester, 'fil_marcas');

        // Quitar una marca: confirmación.
        await tester.tap(find.byTooltip('Quitar del catálogo').at(1));
        await settle(tester);
        expectNoLayoutErrors(tester);
        var dialog = find.byType(AlertDialog);
        expectReachable(tester, find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Quitar')), what: 'Quitar del diálogo');
        expectReachable(tester, find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Cancelar')), what: 'Cancelar del diálogo');
        await shoot(tester, 'fil_marca_quitar_dialogo');
        api.failWith = ApiException('offline', 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.');
        await tester.tap(find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Quitar')));
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(api.catalogRemoves, isEmpty);
        // El rechazo se ve DENTRO de la hoja (un aviso quedaba detrás de ella).
        expectOnTop(tester, find.textContaining('No pudimos conectarnos'), what: 'el error al quitar del catálogo');
        await shoot(tester, 'fil_marca_quitar_error');
        api.failWith = null;
        await tester.tap(find.byTooltip('Quitar del catálogo').at(1));
        await settle(tester);
        dialog = find.byType(AlertDialog);
        await tester.tap(find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Quitar')));
        await settle(tester, 8);
        expect(api.catalogRemoves, hasLength(1));
        expect(find.textContaining('No pudimos conectarnos'), findsNothing, reason: 'al reintentar se limpia el error');
        expect(sheet, findsOneWidget, reason: 'quitar del catálogo no cierra el selector');

        // Agregar una marca (diálogo de un campo) con teclado.
        await tester.tap(find.descendant(of: sheet, matching: find.widgetWithText(TextButton, 'Agregar')));
        await settle(tester);
        dialog = find.byType(AlertDialog);
        final ok = find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Agregar'));
        await focusField(tester, find.widgetWithText(TextField, 'Nombre'));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, ok, what: 'Agregar del diálogo de marca con el teclado');
        await shoot(tester, 'fil_marca_nueva_teclado');
        // Vacío: avisa y no cierra.
        await tester.tap(ok);
        await settle(tester, 3);
        expect(find.text('Ingresá el nombre.'), findsOneWidget);
        await type(tester, find.widgetWithText(TextField, 'Nombre'), 'Bambu Lab');
        await tester.tap(ok);
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(api.catalogAdds, [('brand', 'Bambu Lab', null)]);
        expect(find.text('Bambu Lab'), findsOneWidget);

        // Material: lista corta.
        await closeKeyboard(tester);
        await tapVisible(tester, find.text('PLA'));
        expectSheetBelowStatusBar(tester);
        await shoot(tester, 'fil_materiales');
        await tester.tap(find.descendant(of: sheet, matching: find.text('PETG reforzado')));
        await settle(tester, 8);
        expect(sheet, findsNothing);
        expect(find.text('PETG reforzado'), findsOneWidget);
      });

      testWidgets('selector: cargando, error del catálogo y sin permisos en ${phone.name}', (tester) async {
        final gate = Completer<FilamentCatalog>();
        await pumpPhone(tester, const FilamentoFormScreen(), phone: phone, me: me, overrides: [
          filamentCatalogProvider.overrideWith((ref) => gate.future),
        ]);
        await tapVisible(tester, find.text('Negro'));
        expect(find.byType(CircularProgressIndicator), findsOneWidget);
        expectSheetBelowStatusBar(tester, 'mientras carga el catálogo');
        await shoot(tester, 'fil_catalogo_cargando');
        gate.completeError(ApiException('offline', 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.'));
        await settle(tester, 6);
        expectNoLayoutErrors(tester);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Reintentar'), what: 'Reintentar del catálogo');
        await shoot(tester, 'fil_catalogo_error');
        await closeSheet(tester);

        // Solo lectura del catálogo: sin Agregar ni tachos.
        await pumpPhone(tester, const FilamentoFormScreen(),
            phone: phone, me: staffWith(['filamentos'], role: 'operator', actions: const ['ver', 'editar']), overrides: formOv());
        await tapVisible(tester, find.text('Grilon3'));
        expect(find.descendant(of: sheet, matching: find.text('Agregar')), findsNothing);
        expect(find.byTooltip('Quitar del catálogo'), findsNothing);
        await shoot(tester, 'fil_marcas_solo_lectura');
        await closeSheet(tester);
      });

      testWidgets('edición de un filamento con datos extremos en ${phone.name}', (tester) async {
        final api = TallerFilamentosApi();
        await pumpPhone(tester, const FilamentoDetailScreen(id: '9'), phone: phone, me: me, overrides: [
          ...detailOv(extremo, api: api),
          filamentCatalogProvider.overrideWith((ref) async => bigCatalog()),
        ]);
        await tester.tap(find.byTooltip('Editar'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(find.text('Editar filamento'), findsOneWidget);
        final save = find.widgetWithText(GoldButton, 'Guardar cambios');
        expectReachable(tester, save, what: 'el botón Guardar cambios');
        await shoot(tester, 'fil_edicion');
        for (final label in ['Carrete', 'Alerta', 'Costo por kg']) {
          await focusField(tester, find.widgetWithText(TextField, label));
          expectFocusedFieldVisible(tester);
          expectReachable(tester, save, what: 'Guardar cambios con el teclado ($label)');
        }
        await shoot(tester, 'fil_edicion_teclado_ultimo');
        api.failWith = ApiException('invalid', longServerError);
        await type(tester, find.widgetWithText(TextField, 'Alerta'), '300');
        await settle(tester, 2);
        await tester.tap(save);
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expectReachable(tester, find.text(longServerError), what: 'el error del servidor (con el teclado abierto)');
        expectReachable(tester, save, what: 'Guardar cambios con el error del servidor');
        await shoot(tester, 'fil_edicion_error');
        await closeKeyboard(tester);
        api.failWith = null;
        await tester.tap(save);
        await settle(tester, 8);
        expect(api.updated!.$2.alertThresholdGrams, 300);
        expect(find.text('Filamento actualizado'), findsOneWidget);
      });

      testWidgets('historial general: 40 movimientos, filtros y estados en ${phone.name}', (tester) async {
        await pumpPhone(tester, const FilamentMovementsScreen(), phone: phone, me: me, overrides: [
          filamentMovementsProvider.overrideWith((ref, id) async => movements(100)),
        ]);
        expect(find.text('Historial de stock'), findsOneWidget);
        await shoot(tester, 'historial');
        await expectListEndVisible(tester, find.text('Se muestran los últimos 100 movimientos.'), what: 'el aviso del final del historial');
        await shoot(tester, 'historial_final');
        // De vuelta arriba para los filtros.
        tester.state<ScrollableState>(find.byType(Scrollable).first).position.jumpTo(0);
        await settle(tester, 3);
        await tapVisible(tester, find.widgetWithText(ChoiceChip, 'Reposiciones'));
        expect(find.text('Stock repuesto (anulación)'), findsWidgets);
        await shoot(tester, 'historial_reposiciones');

        await pumpPhone(tester, const FilamentMovementsScreen(), phone: phone, me: me, overrides: [
          filamentMovementsProvider.overrideWith((ref, id) async => <FilamentMovement>[]),
        ]);
        expect(find.text('Sin movimientos'), findsOneWidget);
        await scrollToEnd(tester);
        await shoot(tester, 'historial_vacio');

        await pumpPhone(tester, const FilamentMovementsScreen(), phone: phone, me: me, overrides: [
          filamentMovementsProvider.overrideWith((ref, id) => throw ApiException('offline', 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.')),
        ]);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Reintentar'), what: 'Reintentar del historial');
        await shoot(tester, 'historial_error');

        await pumpPhone(tester, const FilamentMovementsScreen(),
            phone: phone, me: staffWith(['filamentos'], role: 'operator', actions: const []), overrides: [
          filamentMovementsProvider.overrideWith((ref, id) async => movements(3)),
        ]);
        expect(find.text('Sin acceso'), findsOneWidget);
        await shoot(tester, 'historial_sin_acceso');
      });
    }

    testWidgets('volver con un filamento a medio editar pregunta antes de descartar', (tester) async {
      await pumpPhone(tester, const AdminStockScreen(), phone: Phone.small, me: me, overrides: [
        adminStockProvider.overrideWith((ref) async => smallStock),
        ...formOv(TallerFilamentosApi()),
      ]);
      await tester.tap(find.widgetWithText(FloatingActionButton, 'Agregar'));
      await settle(tester, 8);
      // Sin tocar nada, "atrás" sale directo.
      await tester.tap(find.byType(BackButton));
      await settle(tester, 8);
      expect(find.byType(FilamentoFormScreen), findsNothing);

      await tester.tap(find.widgetWithText(FloatingActionButton, 'Agregar'));
      await settle(tester, 8);
      await type(tester, find.widgetWithText(TextField, 'Stock inicial'), '750');
      await tester.tap(find.byType(BackButton));
      await settle(tester);
      expectNoLayoutErrors(tester);
      expect(find.text('¿Descartar los cambios?'), findsOneWidget);
      await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Seguir editando')));
      await settle(tester);
      expect(find.byType(FilamentoFormScreen), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await settle(tester);
      await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Descartar')));
      await settle(tester, 8);
      expect(find.byType(FilamentoFormScreen), findsNothing);
    });

    testWidgets('el selector Sumar / Restar / Contado entra en 360 dp con letra 1,3× sin partir palabras', (tester) async {
      await pumpPhone(tester, const FilamentoDetailScreen(id: '2'),
          phone: Phone.small, textScale: 1.3, me: me, overrides: detailOv(rojo, api: TallerFilamentosApi()));
      await tapVisible(tester, find.widgetWithText(GoldButton, 'Ajustar stock'));
      for (final label in ['Sumar', 'Restar', 'Contado']) {
        expectOneLine(tester, label, fontSize: 13.5, scale: 1.3);
        final seg = tester.getRect(find.text(label));
        expect(seg.left >= 20 && seg.right <= 340, isTrue, reason: '"$label" se sale del selector');
      }
      // Los tres segmentos se reparten el ancho de la hoja.
      final box = tester.getRect(find.byType(SegmentedButton<AdjustMode>));
      expect(box.width, closeTo(320, 1));
      expectSheetBelowStatusBar(tester);
      expectReachable(tester, find.widgetWithText(GoldButton, 'Aplicar ajuste'), what: 'Aplicar ajuste con letra grande');
      await shoot(tester, 'ajuste_grande');
      for (final label in ['Gramos', 'Motivo (opcional)']) {
        await focusField(tester, find.widgetWithText(TextField, label));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, find.widgetWithText(GoldButton, 'Aplicar ajuste'), what: 'Aplicar ajuste con letra grande y teclado ($label)');
        expectSheetBelowStatusBar(tester, 'con letra grande y teclado ($label)');
      }
      await shoot(tester, 'ajuste_grande_teclado');
      await tapVisible(tester, find.text('Contado'));
      await shoot(tester, 'ajuste_grande_contado');
    });

    testWidgets('letra grande (1,3×) en el teléfono chico: detalle, formulario, selector, diálogo e historial', (tester) async {
      final api = TallerFilamentosApi();
      await pumpPhone(tester, const FilamentoDetailScreen(id: '9'),
          phone: Phone.small, textScale: 1.3, me: me, overrides: detailOv(extremo, api: api));
      await shoot(tester, 'fil_detalle_grande');
      await reveal(tester, find.text('Alerta de stock bajo'));
      await shoot(tester, 'fil_detalle_grande_costos');
      await tapVisible(tester, find.textContaining('Sumar 1 carrete'));
      await shoot(tester, 'fil_sumar_carrete_dialogo_grande');
      await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Cancelar')));
      await settle(tester);
      await scrollToEnd(tester);
      await shoot(tester, 'fil_detalle_grande_final');

      await pumpPhone(tester, const FilamentoFormScreen(), phone: Phone.small, textScale: 1.3, me: me, overrides: formOv(api));
      await shoot(tester, 'fil_alta_grande');
      await focusField(tester, find.widgetWithText(TextField, 'Costo por kg'));
      expectFocusedFieldVisible(tester);
      expectReachable(tester, find.widgetWithText(GoldButton, 'Agregar filamento'), what: 'Agregar filamento con letra grande y teclado');
      await shoot(tester, 'fil_alta_grande_teclado');
      await closeKeyboard(tester);
      await tapVisible(tester, find.text('Negro'));
      expectSheetBelowStatusBar(tester);
      await shoot(tester, 'fil_colores_grande');
      await tester.tap(find.descendant(of: sheet, matching: find.widgetWithText(TextButton, 'Agregar')));
      await settle(tester);
      expectNoLayoutErrors(tester);
      final dialog = find.byType(AlertDialog);
      final ok = find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Agregar'));
      await shoot(tester, 'fil_color_nuevo_grande');
      for (final label in ['Nombre del color', 'Código (#RRGGBB)']) {
        await focusField(tester, find.widgetWithText(TextField, label));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, ok, what: 'Agregar del diálogo con letra grande y teclado ($label)');
      }
      await shoot(tester, 'fil_color_nuevo_grande_teclado');

      await pumpPhone(tester, const FilamentMovementsScreen(), phone: Phone.small, textScale: 1.3, me: me, overrides: [
        filamentMovementsProvider.overrideWith((ref, id) async => movements(40)),
      ]);
      await shoot(tester, 'historial_grande');
      await scrollToEnd(tester);
      await shoot(tester, 'historial_grande_final');
    });

    for (final mode in [HefestoThemeMode.light, HefestoThemeMode.warm]) {
      testWidgets('tema ${mode.name}: detalle, ajuste, formulario, selector y diálogo', (tester) async {
        final api = TallerFilamentosApi();
        await pumpPhone(tester, const FilamentoDetailScreen(id: '2'),
            phone: Phone.small, theme: mode, me: me, overrides: detailOv(rojo, api: api));
        await shoot(tester, 'fil_detalle_${mode.name}');
        await tapVisible(tester, find.widgetWithText(GoldButton, 'Ajustar stock'));
        await tester.tap(find.text('250 g'));
        await settle(tester, 3);
        await shoot(tester, 'ajuste_${mode.name}');
        await closeSheet(tester);
        await tester.tap(find.byTooltip('Eliminar'));
        await settle(tester);
        await shoot(tester, 'fil_eliminar_dialogo_${mode.name}');

        await pumpPhone(tester, const FilamentoFormScreen(), phone: Phone.small, theme: mode, me: me, overrides: formOv(api));
        await shoot(tester, 'fil_alta_${mode.name}');
        await tapVisible(tester, find.text('Negro'));
        await shoot(tester, 'fil_colores_${mode.name}');
        await tester.tap(find.descendant(of: sheet, matching: find.widgetWithText(TextButton, 'Agregar')));
        await settle(tester);
        await shoot(tester, 'fil_color_nuevo_${mode.name}');

        await pumpPhone(tester, const FilamentMovementsScreen(), phone: Phone.small, theme: mode, me: me, overrides: [
          filamentMovementsProvider.overrideWith((ref, id) async => movements(8)),
        ]);
        await shoot(tester, 'historial_${mode.name}');
      });
    }
  });
}
