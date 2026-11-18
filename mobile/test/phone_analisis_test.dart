// Pruebas "teléfono real" de los módulos de análisis del panel: Reportes,
// Ganancias y socios y Calculadora 3D (2026-11-14, pedido de Ale: "que las
// pantallas no estén rotas, que cuando tocás los botones se vean bien los
// modales"). Cada pantalla, formulario y modal se dibuja en el teléfono más
// chico (360×640 con los tres botones abajo) y en un iPhone con notch, con el
// teclado abierto, con letra grande (1,3×), en los tres temas y con datos
// extremos. Con SHOT_DIR=carpeta guarda una captura de cada paso.

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/api/models.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:hefesto/features/admin/admin_widgets.dart';
import 'package:hefesto/core/widgets/common.dart';
import 'package:hefesto/features/admin/analisis/analysis_widgets.dart';
import 'package:hefesto/features/admin/analisis/charts.dart';
import 'package:hefesto/features/admin/analisis/number_field.dart';
import 'package:hefesto/features/admin/calculadora/calculadora_api.dart';
import 'package:hefesto/features/admin/calculadora/calculadora_models.dart';
import 'package:hefesto/features/admin/calculadora/calculadora_screen.dart';
import 'package:hefesto/features/admin/ganancias/ganancias_api.dart';
import 'package:hefesto/features/admin/ganancias/ganancias_models.dart';
import 'package:hefesto/features/admin/ganancias/ganancias_screen.dart';
import 'package:hefesto/features/admin/reportes/reportes_api.dart';
import 'package:hefesto/features/admin/reportes/reportes_models.dart';
import 'package:hefesto/features/admin/reportes/reportes_screen.dart';

import 'support/device_kit.dart';

// ---------------------------------------------------------------------------
// Datos de ejemplo (misma forma que devuelve el servidor)
// ---------------------------------------------------------------------------

const _largo = 'Organizador de escritorio modular con cajones, soporte de auriculares y base giratoria edición aniversario';

ReportsOverview _reportes({bool empty = false, bool extreme = false, bool sinAnterior = false, int year = 2026}) {
  final m = extreme ? 7000 : 1;
  return ReportsOverview.fromJson({
    'year': year,
    'prevYear': year - 1,
    'years': [2026, 2025, 2024],
    'kpis': empty
        ? {}
        : {
            'revenue': extreme ? 987654321 : 1250000,
            'salesCount': extreme ? 12345 : 48,
            'unitsSold': extreme ? 987654 : 130,
            'newCustomers': extreme ? 43210 : 12,
            'avgTicket': extreme ? 80004 : 26042,
          },
    'monthsCurrent': empty
        ? []
        : [for (final v in [100000, 120000, 90000, 150000, 110000, 130000, 140000, 125000, 135000, 150000, 141093, 0]) v * m],
    'monthsPrev': empty || sinAnterior
        ? []
        : [for (final v in [80000, 90000, 85000, 100000, 95000, 105000, 110000, 100000, 120000, 130000, 140000, 160000]) v * m],
    'yoy': empty
        ? {}
        : {
            'asOfMonth': 11,
            'current': 1391093 * m,
            'prevSamePeriod': sinAnterior ? 0 : 1155000 * m,
            'deltaPct': sinAnterior ? null : 20.4,
          },
    'categoryBreakdown': empty
        ? []
        : [
            {'name': extreme ? 'Mates, bombillas y accesorios de regalo empresarial' : 'Mates', 'revenue': 600000 * m},
            {'name': 'Carteles', 'revenue': 330000 * m},
            {'name': 'Llaveros', 'revenue': 120000 * m},
            {'name': 'Figuras', 'revenue': 80000 * m},
            {'name': 'Macetas', 'revenue': 40000 * m},
            {'name': 'Sin categoria', 'revenue': 20000 * m},
            {'name': 'Otros', 'revenue': 10000 * m},
          ],
    'topProducts': empty
        ? []
        : [
            {'name': 'Mate Mario', 'qty': 40 * m, 'revenue': 500000 * m},
            {'name': 'Cartel personalizado: $_largo', 'qty': 22 * m, 'revenue': 330000 * m},
            {'name': 'Llavero Hefesto', 'qty': 15, 'revenue': 45000},
            if (extreme) ...[
              for (var i = 0; i < 3; i++) {'name': '$_largo $i', 'qty': 1, 'revenue': 1000},
            ],
          ],
    'bySource': {
      'storefront': {'revenue': empty ? 0 : 900000 * m, 'count': empty ? 0 : 30 * m, 'pct': empty ? 0 : 72},
      'manual': {'revenue': empty ? 0 : 350000 * m, 'count': empty ? 0 : 18 * m, 'pct': empty ? 0 : 28},
    },
    'consumption': empty
        ? []
        : [
            for (var i = 0; i < (extreme ? 14 : 8); i++)
              {
                'material': extreme && i.isEven ? 'PETG reforzado con fibra de carbono' : 'PLA',
                'color': extreme && i.isEven ? 'Verde militar mate satinado $i' : 'Color $i',
                'grams': (3200 - i * 200) * (extreme ? 400 : 1),
                'cost': (64000 - i * 4000) * m,
                'source': i == 3 ? 'fallas' : 'ventas',
              },
          ],
    'consumptionTotals': empty ? {} : {'grams': 17600 * (extreme ? 400 : 1), 'cost': 352000 * m},
  });
}

/// Serie diaria como la arma el servidor: SIEMPRE `days` puntos (rellena con 0).
DailySeries _diario(int days, {bool extreme = false, bool sinVentas = false}) {
  final m = extreme ? 9000 : 1;
  double total(int i) => sinVentas ? 0 : ((i * 7919) % 5 == 0 ? 0 : (8000 + ((i * 7919) % 40) * 1500) * m).toDouble();
  final sum = [for (var i = 0; i < days; i++) total(i)].fold(0.0, (a, b) => a + b);
  return DailySeries.fromJson({
    'days': days,
    'points': [
      for (var i = days - 1; i >= 0; i--)
        {
          'date': DateTime(2026, 11, 14).subtract(Duration(days: i)).toIso8601String().substring(0, 10),
          'total': total(i),
        },
    ],
    'total': sum,
    'average': sum / days,
    'best': sinVentas ? null : {'date': '2026-11-03', 'total': 66500 * m},
  });
}

class _FakeReportesApi implements ReportesApi {
  _FakeReportesApi({this.rows = 3, this.fail});
  final int rows;
  final String? fail;
  int csvCalls = 0;

  @override
  Future<ReportsOverview> overview({int? year}) async => _reportes(year: year ?? 2026);

  @override
  Future<DailySeries> daily(int days) async => _diario(days);

  @override
  Future<CsvExport> salesCsv({int days = 365}) async {
    csvCalls++;
    if (fail != null) throw ApiException('unavailable', fail!);
    final lines = [
      'Pedido,Estado,Total,Fecha',
      for (var i = 0; i < rows; i++) '"HF-00$i","confirmed","${1000 * (i + 1)}.00","2026-11-0${i + 1}T12:00:00.000Z"',
    ];
    return CsvExport(csv: lines.join('\n'), rows: rows, days: days);
  }
}

List<Override> _reportesOverrides({
  ReportsOverview Function(int? year)? overview,
  DailySeries Function(int days)? daily,
  ReportesApi? api,
}) =>
    [
      reportesOverviewProvider.overrideWith((ref, year) async => (overview ?? (y) => _reportes(year: y ?? 2026))(year)),
      reportesDailyProvider.overrideWith((ref, days) async => (daily ?? _diario)(days)),
      reportesApiProvider.overrideWithValue(api ?? _FakeReportesApi()),
    ];

// --- Ganancias ---

const _socioLargo = 'María de los Ángeles Fernández Etcheverry de la Fuente (h)';

EarningsOverview _ganancias({
  bool balanced = true,
  String month = '2026-11',
  int rows = 3,
  bool extreme = false,
  int? partners,
}) {
  final m = extreme ? 2500 : 1;
  final n = partners ?? (extreme ? 20 : 2);
  final names = [
    for (var i = 0; i < n; i++)
      extreme ? (i.isEven ? '$_socioLargo $i' : 'Socio $i') : (i == 0 ? 'Ale Gómez' : (i == 1 ? 'Beto' : 'Socio $i')),
  ];
  final pcts = [
    for (var i = 0; i < n; i++)
      n == 2 ? (i == 0 ? 60.0 : (balanced ? 40.0 : 30.0)) : (i == n - 1 ? 100 - (100 ~/ n) * (n - 1) : 100 ~/ n).toDouble(),
  ];
  const profit = 350000.0;
  return EarningsOverview.fromJson({
    'settings': {'kwhPrice': 95.5, 'machineWatts': 220, 'machineLifeHours': 8000, 'maintenanceCost': 320000},
    'shares': [
      for (var i = 0; i < n; i++)
        {'id': 's$i', 'name': names[i], 'role': i == 0 ? 'Dueño' : (extreme && i == 2 ? 'Diseño, modelado 3D y atención de redes sociales' : null), 'pct': pcts[i]},
    ],
    'sharesTotal': pcts.fold(0.0, (a, b) => a + b),
    'totals': {
      'ingreso': 500000 * m,
      'amort': 150000 * m,
      'profit': profit * m,
      'grams': extreme ? 987654.3 : 4200,
      'orders': rows,
      'profitPct': 70,
    },
    // El servidor arma el rótulo con `toLocaleDateString('es-AR')`: "Octubre de 2026".
    'months': [
      {'value': '2026-11', 'label': 'Noviembre de 2026'},
      {'value': '2026-10', 'label': 'Octubre de 2026'},
      {'value': '2026-09', 'label': 'Septiembre de 2026'},
      if (extreme)
        for (var i = 0; i < 33; i++)
          {
            'value': '${2026 - (i + 4) ~/ 12}-${(12 - (i + 4) % 12).toString().padLeft(2, '0')}',
            'label': '${kMonthLong[11 - (i + 4) % 12]} de ${2026 - (i + 4) ~/ 12}',
          },
    ],
    'selectedMonth': month,
    'payouts': [
      for (var i = 0; i < n; i++) {'name': names[i], 'amount': profit * m * pcts[i] / 100},
    ],
    'rows': [
      for (var i = 0; i < rows; i++)
        {
          'id': 'r$i',
          'orderNumber': i == 1 ? 'Manual · 5 llaveros personalizados con nombre y $_largo' : 'HF-00${40 + i}',
          'customerName': i == 1 ? null : (extreme ? _socioLargo : 'Juan Pérez'),
          'createdAt': '2026-11-${(1 + i % 13).toString().padLeft(2, '0')}T15:00:00.000Z',
          'ingreso': 57500 * m,
          'amort': 12000.5 * m,
          'gananciaPura': 45499.5 * m,
          'grams': i == 1 ? 0 : 320,
          'manual': i == 1,
          'split': [
            for (var k = 0; k < n; k++) {'name': names[k], 'amount': 45499.5 * m * pcts[k] / 100},
          ],
        },
    ],
    'rowsTotal': extreme ? 512 : rows,
    'truncated': extreme,
  });
}

class _FakeGananciasApi implements GananciasApi {
  _FakeGananciasApi({this.fail});
  final String? fail;
  List<ShareDraft>? sharesSaved;
  List<String>? removedSent;
  CostSettings? costsSaved;

  @override
  Future<EarningsOverview> overview({String? month}) async => _ganancias();

  @override
  Future<List<ProfitShare>> saveShares(List<ShareDraft> shares, {List<String> removedIds = const []}) async {
    if (fail != null) throw ApiException('invalid', fail!);
    sharesSaved = shares;
    removedSent = removedIds;
    return const [];
  }

  @override
  Future<CostSettings> saveCosts(CostSettings settings) async {
    if (fail != null) throw ApiException('invalid', fail!);
    costsSaved = settings;
    return settings;
  }
}

// --- Calculadora ---

Map<String, dynamic> _filamento(int i, {bool extreme = false}) => {
      'id': 'f$i',
      'material': extreme && i.isOdd ? 'PETG reforzado con fibra de carbono' : 'PLA',
      'color': const ['Rojo', 'Dorado', 'Negro mate', 'Blanco nieve', 'Azul Francia'][i % 5] + (i >= 5 ? ' ${i ~/ 5}' : ''),
      'brand': extreme && i.isOdd ? 'Printalot Premium Industrial Series' : 'Grilon3',
      'costPerKg': i == 2 ? 0 : (extreme ? 123456789 : 25000 + i * 1000),
      'hex': const ['#CC2200', '#C9A84C', '#111111', '#F4F4F4', '#1F4FD8'][i % 5],
    };

Map<String, dynamic> _calculo(int i, {bool admin = true, bool extreme = false}) => {
      'id': 'h$i',
      'name': i == 1 || extreme ? 'Maceta grande: $_largo $i' : 'Soporte auriculares $i',
      'customer': i.isEven ? (extreme ? _socioLargo : 'Juan') : null,
      'material': extreme ? 'PETG reforzado con fibra de carbono' : 'PLA',
      'color': extreme ? 'Verde militar mate satinado' : 'Rojo',
      'grams': extreme ? 98765.4 : 120,
      'hours': extreme ? 999.5 : 3.5,
      'precioFinal': extreme ? 987654321.5 : 3086.25 + i * 1000,
      'notes': i == 0
          ? (extreme
              ? List.filled(12, 'Pidió el rojo más oscuro y que lo entreguemos en caja de regalo.').join(' ')
              : 'Pidió el rojo más oscuro')
          : null,
      'createdAt': '2026-11-${(1 + i % 13).toString().padLeft(2, '0')}T10:00:00.000Z',
      if (admin) ...{
        'costPerKg': extreme ? 123456789 : 25000,
        'marginPct': 150,
        'costoTotal': extreme ? 395061728.6 : 1234.5,
        'ganancia': extreme ? 592592592.9 : 1851.75,
      },
    };

CalcOverview _calc({
  bool admin = true,
  bool extreme = false,
  int filaments = 2,
  int? presets,
  int history = 2,
}) {
  final nPresets = presets ?? (extreme ? 30 : 3);
  return CalcOverview.fromJson({
    'isAdmin': admin,
    'config': {'kwhPrice': 95, 'machineWatts': 220, 'machineLifeHours': 8000, 'maintenanceCost': 320000, 'marginErrorPct': 8},
    'filaments': [for (var i = 0; i < filaments; i++) _filamento(i, extreme: extreme)],
    'presetOptions': [
      for (var i = 0; i < nPresets; i++)
        if (i != 2) {'id': 'p$i', 'name': extreme && i == 1 ? 'Figuras articuladas de colección pintadas a mano $_largo' : _tipo(i)},
    ],
    'presets': admin
        ? [
            for (var i = 0; i < nPresets; i++)
              {
                'id': 'p$i',
                'name': extreme && i == 1 ? 'Figuras articuladas de colección pintadas a mano $_largo' : _tipo(i),
                'marginPct': i == 1 ? 80.5 : 150 + i,
                'active': i != 2,
                'sortOrder': i,
              },
          ]
        : [],
    'history': [for (var i = 0; i < history; i++) _calculo(i, admin: admin, extreme: extreme)],
    'stats': {
      'count': history,
      'grams': extreme ? 9876543.2 : 240,
      'hours': extreme ? 123456.5 : 7,
      if (admin) ...{'ganancia': extreme ? 987654321 : 3703.5, 'precioFinal': extreme ? 987654321 : 15586.25},
    },
  });
}

String _tipo(int i) => i < 3 ? const ['Llaveros', 'Macetas', 'Viejo'][i] : 'Tipo $i';

class _FakeCalcApi implements CalculadoraApi {
  _FakeCalcApi({this.admin = true, this.extreme = false, this.fail});
  final bool admin;
  final bool extreme;
  final String? fail;

  final List<QuoteRequest> quotes = [];
  Map<String, Object?>? saved;
  String? deleted;
  CalcConfig? configSaved;
  Map<String, Object?>? presetCreated;
  Map<String, Object?>? presetUpdated;
  String? presetDeleted;

  @override
  Future<CalcOverview> overview() async => _calc(admin: admin);

  @override
  Future<CalcQuote> quote(QuoteRequest r) async {
    quotes.add(r);
    final m = extreme ? 100000.0 : 1.0;
    if (!admin) return CalcQuote(precioFinal: 6806.3 * m);
    return CalcQuote(
      detail: true,
      precioFinal: 6806.3 * m,
      material: 3000 * m,
      electricidad: 12.35 * m,
      desgaste: 8.5 * m,
      subtotal: 3020.85 * m,
      margenError: 241.67 * m,
      costoTotal: 3262.52 * m,
      ganancia: 3543.78 * m,
      marginPct: 150,
      costPerKg: 25000 * m,
    );
  }

  @override
  Future<String> saveCalc({
    required String name,
    String customer = '',
    required String filamentId,
    required double grams,
    required double hours,
    required String presetId,
    String notes = '',
  }) async {
    if (fail != null) throw ApiException('invalid', fail!);
    saved = {'name': name, 'customer': customer, 'filamentId': filamentId, 'grams': grams, 'hours': hours, 'presetId': presetId, 'notes': notes};
    return 'nuevo';
  }

  @override
  Future<void> deleteCalc(String id) async {
    if (fail != null) throw ApiException('invalid', fail!);
    deleted = id;
  }

  @override
  Future<CalcConfig> saveConfig(CalcConfig config) async {
    configSaved = config;
    return config;
  }

  @override
  Future<void> createPreset({required String name, required double marginPct, bool active = true, int sortOrder = 0}) async {
    if (fail != null) throw ApiException('invalid', fail!);
    presetCreated = {'name': name, 'marginPct': marginPct, 'active': active, 'sortOrder': sortOrder};
  }

  @override
  Future<void> updatePreset(String id, {required String name, required double marginPct, required bool active, required int sortOrder}) async =>
      presetUpdated = {'id': id, 'name': name, 'marginPct': marginPct, 'active': active, 'sortOrder': sortOrder};

  @override
  Future<void> deletePreset(String id) async => presetDeleted = id;
}

List<Override> _calcOverrides(_FakeCalcApi api, {CalcOverview Function()? overview}) => [
      calculadoraProvider.overrideWith((ref) async => (overview ?? () => _calc(admin: api.admin, extreme: api.extreme))()),
      calculadoraApiProvider.overrideWithValue(api),
    ];

// ---------------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------------

/// Los módulos del panel se abren con `push` sobre la barra del panel: la barra
/// superior lleva la flecha de volver. Este anfitrión reproduce eso.
class _Host extends StatelessWidget {
  const _Host(this.screen);
  final Widget screen;

  @override
  Widget build(BuildContext context) => Scaffold(
        body: Center(
          child: FilledButton(
            key: const Key('abrir'),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen)),
            child: const Text('Abrir'),
          ),
        ),
      );
}

Future<void> _open(
  WidgetTester tester,
  Widget screen, {
  required Phone phone,
  required MeInfo me,
  List<Override> overrides = const [],
  HefestoThemeMode theme = HefestoThemeMode.dark,
  double textScale = 1,
}) async {
  await pumpPhone(tester, _Host(screen), phone: phone, me: me, overrides: overrides, theme: theme, textScale: textScale);
  await tester.tap(find.byKey(const Key('abrir')));
  await settle(tester, 8);
  expectNoLayoutErrors(tester, 'al abrir la pantalla en ${phone.name}');
}

/// Recorre la lista de arriba abajo sacando una captura por "pantallazo" y
/// termina en el final. Falla si algo se desborda en el camino.
Future<void> _shootAll(WidgetTester tester, String name, {Finder? scrollable}) async {
  final target = scrollable ?? find.byType(Scrollable).first;
  final state = tester.state<ScrollableState>(target);
  for (var i = 0; i < 14; i++) {
    await shoot(tester, '${name}_$i');
    final pos = state.position;
    if (pos.pixels >= pos.maxScrollExtent - 0.5) break;
    pos.jumpTo(math.min(pos.pixels + pos.viewportDimension - 70, pos.maxScrollExtent));
    await settle(tester, 2);
    expectNoLayoutErrors(tester, 'al desplazar "$name" en ${currentPhone.name}');
  }
  await scrollToEnd(tester, scrollable: target);
}

/// Trae [finder] a la vista aunque la lista todavía no lo haya construido
/// (las listas arman sus hijos de a poco, a medida que se desplazan).
Future<void> _reveal(WidgetTester tester, Finder finder, {Finder? scrollable}) async {
  final state = tester.state<ScrollableState>(scrollable ?? find.byType(Scrollable).first);
  for (var pass = 0; pass < 2 && finder.evaluate().isEmpty; pass++) {
    if (pass == 1) state.position.jumpTo(0);
    for (var i = 0; i < 80 && finder.evaluate().isEmpty; i++) {
      final pos = state.position;
      if (pos.pixels >= pos.maxScrollExtent - 0.5) break;
      pos.jumpTo(math.min(pos.pixels + 160, pos.maxScrollExtent));
      await tester.pump(const Duration(milliseconds: 50));
    }
  }
  expect(finder, findsWidgets, reason: 'no apareció el elemento buscado ni desplazando la pantalla');
  await tester.ensureVisible(finder.first);
  await settle(tester, 2);
  expectNoLayoutErrors(tester, 'al desplazar hasta el elemento en ${currentPhone.name}');
}

Future<void> _scrollToTop(WidgetTester tester) async {
  tester.state<ScrollableState>(find.byType(Scrollable).first).position.jumpTo(0);
  await settle(tester, 2);
}

/// Portapapeles de mentira: devuelve lo último que copió la app.
String? Function() _mockClipboard(WidgetTester tester) {
  String? copied;
  tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
    if (call.method == 'Clipboard.setData') copied = (call.arguments as Map)['text'] as String?;
    return null;
  });
  addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));
  return () => copied;
}

Finder _inSheet(Finder f) => find.descendant(of: find.byType(BottomSheet), matching: f);

/// La hoja abierta no puede meterse debajo de la barra de estado / notch.
void _expectSheetBelowStatusBar(WidgetTester tester) {
  expect(find.byType(BottomSheet), findsOneWidget, reason: 'tendría que haber una hoja abierta');
  final top = tester.getRect(find.byType(BottomSheet)).top;
  expect(
    top >= currentPhone.top - 0.5,
    isTrue,
    reason: 'la hoja empieza en y=${top.toStringAsFixed(0)}: se mete debajo de la barra de estado '
        '(${currentPhone.top.toStringAsFixed(0)} dp) de ${currentPhone.name}',
  );
}

/// Cierra la hoja arrastrando la manija hacia abajo (la forma de cerrar que
/// queda cuando la hoja ocupa toda la pantalla).
Future<void> _closeSheetByHandle(WidgetTester tester) async {
  final rect = tester.getRect(find.byType(BottomSheet));
  expect(rect.top + 24 <= safeRect.bottom, isTrue, reason: 'la manija de la hoja tiene que quedar a la vista');
  await tester.dragFrom(Offset(rect.center.dx, rect.top + 20), const Offset(0, 420));
  await settle(tester, 8);
  expect(find.byType(BottomSheet), findsNothing, reason: 'arrastrar la manija hacia abajo tiene que cerrar la hoja');
}

/// Falla si un texto de una sola línea quedó cortado con "…".
void _expectNotTruncated(WidgetTester tester, Finder text, {required String what}) {
  expect(text, findsOneWidget, reason: 'no se encontró $what');
  final p = tester.renderObject<RenderParagraph>(text);
  final natural = p.getMaxIntrinsicWidth(double.infinity);
  expect(
    natural <= p.size.width + 0.5,
    isTrue,
    reason: '$what se corta: necesita ${natural.toStringAsFixed(0)} dp y tiene ${p.size.width.toStringAsFixed(0)} dp '
        'en ${currentPhone.name}',
  );
}

Finder get _focusedField => find.byWidgetPredicate((w) => w is EditableText && w.focusNode.hasFocus);

Finder _goldButton(String label) => find.widgetWithText(GoldButton, label);

bool _goldEnabled(WidgetTester tester, String label) {
  final ink = find.descendant(of: _goldButton(label), matching: find.byType(InkWell)).first;
  return tester.widget<InkWell>(ink).onTap != null;
}

Finder _numberField(String label) => find.widgetWithText(ArNumberField, label);

Future<void> _type(WidgetTester tester, Finder field, String text) async {
  await tester.enterText(field, text);
  await tester.pump();
}

void main() {
  setUpAll(setUpDeviceKit);

  // =========================================================================
  // REPORTES
  // =========================================================================
  group('Reportes', () {
    final me = staffWith(['reportes']);

    for (final phone in Phone.both) {
      testWidgets('pantalla completa, de arriba abajo, en ${phone.name}', (tester) async {
        await _open(tester, const AdminReportesScreen(), phone: phone, me: me, overrides: _reportesOverrides());
        expectReachable(tester, find.text('Reportes'), what: 'el título');
        expectReachable(tester, find.byTooltip('Copiar ventas (CSV)'), what: 'el botón de copiar el CSV');
        expectReachable(tester, find.byTooltip('Actualizar'), what: 'el botón de actualizar');
        expectReachable(tester, find.byType(BackButton), what: 'la flecha de volver');
        expect(find.text('Facturación 2026'), findsOneWidget);
        await _shootAll(tester, 'reportes');
        // Lo último de la pantalla (la nota del consumo) queda arriba de la barra del sistema.
        expectReachable(tester, find.textContaining('El consumo por ventas sale'), what: 'la nota final del consumo');
      });

      testWidgets('los gráficos se leen al tocarlos en ${phone.name}', (tester) async {
        await _open(tester, const AdminReportesScreen(), phone: phone, me: me, overrides: _reportesOverrides());
        // Barras por mes: tocar marzo.
        final monthly = find.byType(MonthlyChart);
        await _reveal(tester, monthly);
        final box = tester.getRect(monthly);
        await tester.tapAt(Offset(box.left + box.width * 2.5 / 12, box.bottom - 60));
        await settle(tester, 2);
        expectNoLayoutErrors(tester, 'al tocar el gráfico por mes');
        expect(find.text('Marzo'), findsOneWidget);
        await shoot(tester, 'reportes_mes_barras');
        // Líneas.
        await tester.tap(find.widgetWithText(ChoiceChip, 'Líneas'));
        await settle(tester, 2);
        expectNoLayoutErrors(tester, 'al pasar a líneas');
        await shoot(tester, 'reportes_mes_lineas');
        // Rango de días.
        await _reveal(tester, find.widgetWithText(ChoiceChip, '90 días'));
        await tester.tap(find.widgetWithText(ChoiceChip, '90 días'));
        await settle(tester, 4);
        expectNoLayoutErrors(tester, 'al elegir 90 días');
        expect(find.text('Últimos 90 días, hasta hoy.'), findsOneWidget);
        await shoot(tester, 'reportes_dia_90');
        // Dona: tocar una fila de la leyenda.
        await _reveal(tester, find.text('Carteles'));
        await tester.tap(find.text('Carteles'));
        await settle(tester, 2);
        expectNoLayoutErrors(tester, 'al tocar la leyenda de la dona');
        await shoot(tester, 'reportes_dona_tocada');
        // "Ver todos" del consumo.
        await _reveal(tester, find.text('Ver todos (8)'));
        await tester.tap(find.text('Ver todos (8)'));
        await settle(tester, 2);
        expectNoLayoutErrors(tester, 'al desplegar el consumo');
        expect(find.text('Ver menos'), findsOneWidget);
      });

      testWidgets('copiar el CSV avisa con un cartel visible en ${phone.name}', (tester) async {
        final copied = _mockClipboard(tester);
        final api = _FakeReportesApi(rows: 3);
        await _open(tester, const AdminReportesScreen(), phone: phone, me: me, overrides: _reportesOverrides(api: api));
        await tester.tap(find.byTooltip('Copiar ventas (CSV)'));
        await settle(tester, 6);
        expectNoLayoutErrors(tester, 'al copiar el CSV');
        expect(api.csvCalls, 1);
        expect(copied(), startsWith('Pedido,Estado,Total,Fecha'));
        expect(copied()!.split('\n'), hasLength(4));
        await shoot(tester, 'reportes_csv_aviso');
        expectReachable(tester, find.byType(SnackBar), what: 'el aviso del CSV');
        expect(find.textContaining('CSV copiado'), findsOneWidget);

        // Si el servidor falla, se avisa (y no queda girando para siempre).
        final roto = _FakeReportesApi(fail: 'No pudimos completar la operación. Probá de nuevo en unos segundos.');
        await _open(tester, const AdminReportesScreen(), phone: phone, me: me, overrides: _reportesOverrides(api: roto));
        await tester.tap(find.byTooltip('Copiar ventas (CSV)'));
        await settle(tester, 6);
        expectNoLayoutErrors(tester, 'al fallar la copia del CSV');
        await shoot(tester, 'reportes_csv_error');
        expectReachable(tester, find.byType(SnackBar), what: 'el aviso del error del CSV');
        expect(find.textContaining('No pudimos completar la operación'), findsOneWidget);
        expect(
          tester.widget<IconButton>(find.widgetWithIcon(IconButton, Icons.copy_all_rounded)).onPressed,
          isNotNull,
          reason: 'el botón de copiar vuelve a quedar disponible',
        );
      });

      testWidgets('estados: sin ventas, error, sin permiso y cargando en ${phone.name}', (tester) async {
        // Sin ventas (la serie diaria llega con todos los días en 0).
        await _open(
          tester,
          const AdminReportesScreen(),
          phone: phone,
          me: me,
          overrides: _reportesOverrides(overview: (_) => _reportes(empty: true), daily: (d) => _diario(d, sinVentas: true)),
        );
        await _shootAll(tester, 'reportes_vacio');
        await _reveal(tester, find.text('Todavía no hay ventas para graficar.'));
        await scrollToEnd(tester);
        expectReachable(tester, find.text('Todavía no hay consumo registrado este año.'), what: 'el último cartel vacío');

        // Error.
        await _open(
          tester,
          const AdminReportesScreen(),
          phone: phone,
          me: me,
          overrides: [
            reportesOverviewProvider.overrideWith((ref, year) => throw ApiException('unavailable', 'No pudimos completar la operación. Probá de nuevo en unos segundos.')),
          ],
        );
        await shoot(tester, 'reportes_error');
        expectReachable(tester, _goldButton('Reintentar'), what: 'el botón Reintentar');

        // Sin permiso.
        await _open(tester, const AdminReportesScreen(), phone: phone, me: staffWith(['reportes'], role: 'operator', actions: const []));
        await shoot(tester, 'reportes_sin_acceso');
        expectReachable(tester, find.text('Sin acceso'), what: 'el cartel de sin acceso');

        // Cargando (el servidor todavía no respondió).
        final never = Completer<ReportsOverview>();
        await _open(
          tester,
          const AdminReportesScreen(),
          phone: phone,
          me: me,
          overrides: [reportesOverviewProvider.overrideWith((ref, year) => never.future)],
        );
        await shoot(tester, 'reportes_cargando');
        expectNoLayoutErrors(tester, 'mientras carga');
      });

      testWidgets('si falla solo la serie diaria se puede reintentar en ${phone.name}', (tester) async {
        var fail = true;
        await _open(
          tester,
          const AdminReportesScreen(),
          phone: phone,
          me: me,
          overrides: [
            reportesOverviewProvider.overrideWith((ref, year) async => _reportes()),
            reportesDailyProvider.overrideWith((ref, days) async {
              if (fail) throw ApiException('unavailable', 'No pudimos completar la operación. Probá de nuevo en unos segundos.');
              return _diario(days);
            }),
          ],
        );
        await _reveal(tester, find.text('Reintentar'));
        await shoot(tester, 'reportes_diario_error');
        expectReachable(tester, find.text('Reintentar'), what: 'el Reintentar de la serie diaria');
        fail = false;
        await tester.tap(find.text('Reintentar'));
        await settle(tester, 4);
        expectNoLayoutErrors(tester, 'al reintentar la serie diaria');
        expect(find.text('Mejor día'), findsOneWidget);
      });

      testWidgets('datos extremos: montos de 9 cifras y nombres larguísimos en ${phone.name}', (tester) async {
        await _open(
          tester,
          const AdminReportesScreen(),
          phone: phone,
          me: me,
          overrides: _reportesOverrides(overview: (_) => _reportes(extreme: true), daily: (d) => _diario(d, extreme: true)),
        );
        await _shootAll(tester, 'reportes_extremo');
        // Con el gráfico tocado, la lectura del mes muestra los dos montos.
        final monthly = find.byType(MonthlyChart);
        await _reveal(tester, monthly);
        final box = tester.getRect(monthly);
        await tester.tapAt(Offset(box.left + box.width * 1.5 / 12, box.bottom - 60));
        await settle(tester, 2);
        expectNoLayoutErrors(tester, 'al tocar el gráfico con montos de 9 cifras');
        await shoot(tester, 'reportes_extremo_mes');
      });

      testWidgets('primer año del negocio (sin año anterior para comparar) en ${phone.name}', (tester) async {
        await _open(
          tester,
          const AdminReportesScreen(),
          phone: phone,
          me: me,
          overrides: _reportesOverrides(overview: (_) => _reportes(sinAnterior: true)),
        );
        await shoot(tester, 'reportes_sin_anterior');
        expect(find.text('2026 contra 2025'), findsOneWidget);
        expect(find.text('Sin datos del año anterior'), findsOneWidget);
      });
    }

    testWidgets('letra grande (1,3×) en el teléfono chico', (tester) async {
      await _open(tester, const AdminReportesScreen(), phone: Phone.small, me: me, overrides: _reportesOverrides(), textScale: 1.3);
      _expectNotTruncated(tester, find.text('Reportes'), what: 'el título "Reportes"');
      await _shootAll(tester, 'reportes_grande');
      // Con letra grande, tocar el gráfico por mes no puede desbordar la lectura.
      final monthly = find.byType(MonthlyChart);
      await _reveal(tester, monthly);
      final box = tester.getRect(monthly);
      await tester.tapAt(Offset(box.left + box.width * 9.5 / 12, box.bottom - 60));
      await settle(tester, 2);
      expectNoLayoutErrors(tester, 'al tocar el gráfico por mes con letra grande');
      await shoot(tester, 'reportes_grande_mes');
      // Datos extremos + letra grande.
      await _open(
        tester,
        const AdminReportesScreen(),
        phone: Phone.small,
        me: me,
        overrides: _reportesOverrides(overview: (_) => _reportes(extreme: true), daily: (d) => _diario(d, extreme: true)),
        textScale: 1.3,
      );
      await _shootAll(tester, 'reportes_grande_extremo');
      await _open(
        tester,
        const AdminReportesScreen(),
        phone: Phone.small,
        me: me,
        overrides: _reportesOverrides(overview: (_) => _reportes(sinAnterior: true)),
        textScale: 1.3,
      );
      await shoot(tester, 'reportes_grande_sin_anterior');
    });

    for (final mode in [HefestoThemeMode.light, HefestoThemeMode.warm]) {
      testWidgets('tema ${mode.name}: pantalla y aviso del CSV', (tester) async {
        _mockClipboard(tester);
        for (final phone in Phone.both) {
          await _open(tester, const AdminReportesScreen(), phone: phone, me: me, overrides: _reportesOverrides(), theme: mode);
          await _shootAll(tester, 'reportes_${mode.name}');
          await tester.tap(find.byTooltip('Copiar ventas (CSV)'));
          await settle(tester, 6);
          await shoot(tester, 'reportes_${mode.name}_csv');
          expectReachable(tester, find.byType(SnackBar), what: 'el aviso del CSV');
        }
      });
    }
  });

  // =========================================================================
  // Gráficos (CustomPaint): series vacías, de un solo punto y montos enormes
  // =========================================================================
  group('Gráficos', () {
    Future<void> pumpChart(WidgetTester tester, Widget chart, {Phone phone = Phone.small, double textScale = 1}) async {
      await pumpPhone(
        tester,
        Scaffold(body: SafeArea(child: ListView(padding: const EdgeInsets.all(32), children: [chart]))),
        phone: phone,
        textScale: textScale,
      );
    }

    testWidgets('barras y líneas por mes: sin datos, un solo mes y 9 cifras', (tester) async {
      final cases = <String, (List<double>, List<double>, int)>{
        'vacio': (const [], const [], 12),
        'un_mes': (const [150000], const [], 1),
        'ceros': (List.filled(12, 0), List.filled(12, 0), 6),
        'enorme': ([for (var i = 0; i < 12; i++) 987654321.0 - i * 1e7], [for (var i = 0; i < 12; i++) 912345678.0 - i * 2e7], 12),
        'negativo': (const [-5000, 12000, 0, 3000], const [100], 4),
      };
      for (final mode in MonthlyChartMode.values) {
        for (final e in cases.entries) {
          await pumpChart(
            tester,
            MonthlyChart(current: e.value.$1, previous: e.value.$2, year: 2026, prevYear: 2025, mode: mode, currentUntil: e.value.$3),
          );
          expectNoLayoutErrors(tester, 'gráfico por mes ${mode.name}/${e.key}');
          // Tocar el primero y el último mes.
          final box = tester.getRect(find.byType(MonthlyChart));
          for (final dx in [4.0, box.width - 4]) {
            await tester.tapAt(Offset(box.left + dx, box.bottom - 40));
            await settle(tester, 1);
            expectNoLayoutErrors(tester, 'al tocar el gráfico por mes ${mode.name}/${e.key}');
          }
          await shoot(tester, 'grafico_mes_${mode.name}_${e.key}');
        }
      }
    });

    testWidgets('dona: sin porciones, una sola, todas en cero y 9 cifras con nombres largos', (tester) async {
      final palette = chartPalette();
      final cases = <String, List<DonutSlice>>{
        'vacia': const [],
        'una': [DonutSlice('Mates', 600000, palette[0])],
        'ceros': [DonutSlice('Mates', 0, palette[0]), DonutSlice('Carteles', 0, palette[1])],
        'enorme': [
          for (var i = 0; i < 6; i++)
            DonutSlice(i.isEven ? 'Mates, bombillas y accesorios de regalo empresarial $i' : 'Otros $i', 987654321.0 - i * 1.2e8, palette[i]),
        ],
      };
      for (final scale in [1.0, 1.3]) {
        for (final e in cases.entries) {
          await pumpChart(tester, DonutChart(slices: e.value, centerLabel: 'Facturado'), textScale: scale);
          expectNoLayoutErrors(tester, 'dona ${e.key} a $scale×');
          if (e.value.isNotEmpty) {
            await tester.tap(find.text(e.value.first.label));
            await settle(tester, 1);
            expectNoLayoutErrors(tester, 'al tocar la leyenda de la dona ${e.key}');
            // Cada fila de la leyenda es un objetivo táctil: mínimo 44 dp.
            final row = find.ancestor(of: find.text(e.value.first.label), matching: find.byType(InkWell)).first;
            expect(tester.getSize(row).height >= 44, isTrue, reason: 'la fila de la leyenda mide ${tester.getSize(row).height} dp de alto');
          }
          final center = tester.getCenter(find.byType(CustomPaint).first);
          await tester.tapAt(center + const Offset(0, -70));
          await settle(tester, 1);
          expectNoLayoutErrors(tester, 'al tocar la dona ${e.key}');
          await shoot(tester, 'grafico_dona_${e.key}${scale > 1 ? '_grande' : ''}');
        }
      }
    });

    testWidgets('barra de reparto: vacía, una parte, ceros y montos enormes', (tester) async {
      final palette = chartPalette();
      for (final parts in <List<(double, Color)>>[
        const [],
        [(100, palette[0])],
        [(0, palette[0]), (0, palette[1])],
        [(987654321, palette[0]), (0.004, palette[1]), (123456789, palette[2])],
        [for (var i = 0; i < 20; i++) (5, palette[i % palette.length])],
      ]) {
        await pumpChart(tester, ShareBar(parts: parts));
        expectNoLayoutErrors(tester, 'barra de reparto con ${parts.length} partes');
      }
    });
  });

  // =========================================================================
  // GANANCIAS Y SOCIOS
  // =========================================================================
  group('Ganancias', () {
    final me = staffWith(['ganancias']);
    List<Override> ov({EarningsOverview Function(String? month)? data, _FakeGananciasApi? api}) => [
          gananciasProvider.overrideWith((ref, month) async => (data ?? (m) => _ganancias(month: m ?? '2026-11'))(month)),
          gananciasApiProvider.overrideWithValue(api ?? _FakeGananciasApi()),
        ];

    for (final phone in Phone.both) {
      testWidgets('pantalla completa, de arriba abajo, en ${phone.name}', (tester) async {
        await _open(tester, const AdminGananciasScreen(), phone: phone, me: me, overrides: ov());
        expectReachable(tester, find.text('Ganancias y socios'), what: 'el título');
        _expectNotTruncated(tester, find.text('Ganancias y socios'), what: 'el título "Ganancias y socios"');
        expectReachable(tester, find.byTooltip('Actualizar'), what: 'el botón de actualizar');
        expect(find.text('Nov 2026'), findsOneWidget);
        // El período se lee como una frase (el servidor manda "Noviembre de 2026").
        await _shootAll(tester, 'ganancias');
        await _reveal(tester, find.textContaining('de ganancia pura de noviembre de 2026'));
        await scrollToEnd(tester);
        expectReachable(tester, find.text('HF-0042'), what: 'la última venta del desglose');
      });

      testWidgets('estados: vacío, error, sin permiso y solo lectura en ${phone.name}', (tester) async {
        await _open(
          tester,
          const AdminGananciasScreen(),
          phone: phone,
          me: me,
          overrides: ov(data: (_) => EarningsOverview.fromJson({'selectedMonth': 'all'})),
        );
        await _shootAll(tester, 'ganancias_vacio');
        expectReachable(tester, find.text('Sin ventas cobradas'), what: 'el cartel de sin ventas');

        await _open(
          tester,
          const AdminGananciasScreen(),
          phone: phone,
          me: me,
          overrides: [gananciasProvider.overrideWith((ref, month) => throw ApiException('unavailable', 'No pudimos completar la operación. Probá de nuevo en unos segundos.'))],
        );
        await shoot(tester, 'ganancias_error');
        expectReachable(tester, _goldButton('Reintentar'), what: 'el botón Reintentar');

        await _open(tester, const AdminGananciasScreen(), phone: phone, me: staffWith(['ganancias'], role: 'operator', actions: const []));
        await shoot(tester, 'ganancias_sin_acceso');
        expectReachable(tester, find.text('Sin acceso'), what: 'el cartel de sin acceso');

        await _open(
          tester,
          const AdminGananciasScreen(),
          phone: phone,
          me: staffWith(['ganancias'], role: 'operator', actions: const ['ver']),
          overrides: ov(),
        );
        expect(find.text('Editar reparto'), findsNothing);
        expect(find.text('Editar costos'), findsNothing);
        await _shootAll(tester, 'ganancias_solo_lectura');
      });

      testWidgets('datos extremos: 20 socios, 36 meses, montos de 9 cifras en ${phone.name}', (tester) async {
        await _open(
          tester,
          const AdminGananciasScreen(),
          phone: phone,
          me: me,
          overrides: ov(data: (m) => _ganancias(month: m ?? '2026-11', extreme: true, rows: 30)),
        );
        await _shootAll(tester, 'ganancias_extremo');
        expectReachable(tester, find.textContaining('Se muestran las 30 ventas más recientes de 512'), what: 'la nota de ventas recortadas');
      });

      testWidgets('reparto desbalanceado: lo avisa en ${phone.name}', (tester) async {
        await _open(tester, const AdminGananciasScreen(), phone: phone, me: me, overrides: ov(data: (m) => _ganancias(balanced: false)));
        await _reveal(tester, find.textContaining('no suma 100%'));
        await shoot(tester, 'ganancias_desbalanceado');
        expect(find.text('Suma 90%'), findsOneWidget);
      });

      // ------------------------- Editor del reparto -------------------------

      Future<void> openEditor(WidgetTester tester, {EarningsOverview? data, _FakeGananciasApi? api, double textScale = 1, MeInfo? as}) async {
        await _open(
          tester,
          const AdminGananciasScreen(),
          phone: phone,
          me: as ?? me,
          overrides: ov(data: (m) => data ?? _ganancias(), api: api),
          textScale: textScale,
        );
        await _reveal(tester, find.text('Editar reparto'));
        await tester.tap(find.text('Editar reparto'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester, 'al abrir el editor del reparto');
        expect(find.text('Reparto entre socios'), findsOneWidget);
      }

      testWidgets('editor del reparto: pantalla, teclado en el primer y el último campo en ${phone.name}', (tester) async {
        await openEditor(tester);
        _expectNotTruncated(tester, find.text('Reparto entre socios'), what: 'el título del editor');
        expectReachable(tester, _goldButton('Guardar reparto'), what: 'el botón Guardar reparto');
        await _shootAll(tester, 'socios');
        expectReachable(tester, find.textContaining('Los importes de arriba son sobre'), what: 'la nota final del editor');
        expectReachable(tester, _goldButton('Guardar reparto'), what: 'el botón Guardar reparto al final');

        // Primer campo: el nombre del primer socio.
        await openKeyboard(tester, find.widgetWithText(TextField, 'Nombre').first);
        expectFocusedFieldVisible(tester);
        await shoot(tester, 'socios_teclado_primero');
        expectReachable(tester, _goldButton('Guardar reparto'), what: 'Guardar reparto con el teclado abierto (primer campo)');
        await closeKeyboard(tester);

        // Último campo: el porcentaje del último socio.
        await scrollToEnd(tester);
        await openKeyboard(tester, find.byType(ArNumberField).last);
        expectFocusedFieldVisible(tester);
        await shoot(tester, 'socios_teclado_ultimo');
        expectReachable(tester, _goldButton('Guardar reparto'), what: 'Guardar reparto con el teclado abierto (último campo)');
      });

      testWidgets('editor del reparto: el teclado numérico se cierra tocando afuera o desplazando en ${phone.name}', (tester) async {
        await openEditor(tester);
        await openKeyboard(tester, find.byType(ArNumberField).first);
        expect(_focusedField, findsOneWidget);
        // Tocar fuera del campo (el título de la pantalla).
        await tester.tap(find.text('Reparto entre socios'));
        await tester.pump();
        expect(_focusedField, findsNothing,
            reason: 'tocar fuera del campo tiene que cerrar el teclado numérico (en iPhone no trae tecla "listo")');
        await closeKeyboard(tester);
        // Desplazar la lista también lo cierra.
        await openKeyboard(tester, find.byType(ArNumberField).first);
        expect(_focusedField, findsOneWidget);
        await tester.drag(find.byType(Scrollable).first, const Offset(0, -60));
        await tester.pump();
        expect(_focusedField, findsNothing, reason: 'desplazar la lista tiene que cerrar el teclado');
      });

      testWidgets('editor del reparto: coma decimal, suma distinta de 100 y guardar en ${phone.name}', (tester) async {
        final api = _FakeGananciasApi();
        await openEditor(tester, api: api);
        expect(_goldEnabled(tester, 'Guardar reparto'), isFalse, reason: 'sin cambios no hay nada para guardar');

        await openKeyboard(tester, find.byType(ArNumberField).first);
        await _type(tester, find.byType(ArNumberField).first, '62,5');
        expectNoLayoutErrors(tester, 'al tipear un porcentaje con coma');
        // Con el teclado abierto la suma de arriba no se ve: el motivo va pegado al botón.
        expectReachable(tester, find.textContaining('Suma 102,5%: tiene que dar 100%'), what: 'el motivo por el que no se puede guardar');
        expect(_goldEnabled(tester, 'Guardar reparto'), isFalse, reason: 'con 102,5% no se puede guardar');
        await closeKeyboard(tester);
        // El aviso de "tiene que sumar 100%" se ve arriba.
        await _scrollToTop(tester);
        await shoot(tester, 'socios_no_suma');
        expect(find.textContaining('Tiene que sumar 100% para poder guardar'), findsOneWidget);

        await scrollToEnd(tester);
        await openKeyboard(tester, find.byType(ArNumberField).last);
        await _type(tester, find.byType(ArNumberField).last, '37,5');
        expectFocusedFieldVisible(tester);
        expect(find.textContaining('tiene que dar 100%'), findsNothing, reason: '62,5 + 37,5 = 100');
        expect(_goldEnabled(tester, 'Guardar reparto'), isTrue);
        await shoot(tester, 'socios_listo_para_guardar');
        // Se guarda sin cerrar el teclado: el botón está a la vista.
        await tester.tap(_goldButton('Guardar reparto'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester, 'al guardar el reparto');
        expect(api.sharesSaved!.map((s) => s.pct), [62.5, 37.5]);
        expect(api.sharesSaved!.map((s) => s.id), ['s0', 's1']);
        expect(api.removedSent, isEmpty);
        expect(find.text('Reparto entre socios'), findsNothing, reason: 'después de guardar vuelve a Ganancias');
      });

      testWidgets('editor del reparto: agregar y quitar un socio con el teclado abierto en ${phone.name}', (tester) async {
        final api = _FakeGananciasApi();
        await openEditor(tester, api: api);
        // Con el teclado abierto en un porcentaje, se llega a "Agregar socio" desplazando.
        await openKeyboard(tester, find.byType(ArNumberField).first);
        await scrollToEnd(tester);
        await shoot(tester, 'socios_agregar_con_teclado');
        expectReachable(tester, find.text('Agregar socio'), what: '"Agregar socio" con el teclado abierto');
        await tester.tap(find.text('Agregar socio'));
        await settle(tester, 3);
        expectNoLayoutErrors(tester, 'al agregar un socio');
        await closeKeyboard(tester);
        await _scrollToTop(tester);
        expect(find.byType(ArNumberField, skipOffstage: false), findsNWidgets(3));
        await _reveal(tester, find.textContaining('Poné un nombre a cada socio'));

        // El socio nuevo: nombre con el teclado abierto.
        await scrollToEnd(tester);
        await openKeyboard(tester, find.widgetWithText(TextField, 'Nombre').last);
        expectFocusedFieldVisible(tester);
        await _type(tester, find.widgetWithText(TextField, 'Nombre').last, 'Caro');
        await shoot(tester, 'socios_nuevo_nombre');
        await closeKeyboard(tester);
        await scrollToEnd(tester);
        await tester.tap(find.text('Igualar al 100%'));
        await settle(tester, 2);
        expect(find.textContaining('tiene que dar 100%'), findsNothing, reason: '33,33 + 33,33 + 33,34 = 100');
        expect(_goldEnabled(tester, 'Guardar reparto'), isTrue);

        // Quitar al segundo socio (Beto) con el teclado abierto en su porcentaje.
        // Se lo busca por su tarjeta y no por posición: con el teclado abierto
        // la lista solo arma las tarjetas que se ven, y "el segundo botón" pasa
        // a ser otro según dónde quede desplazada.
        final beto = find.ancestor(
          of: find.widgetWithText(TextField, 'Beto'),
          matching: find.byType(AdminCard),
        );
        await _scrollToTop(tester);
        await _reveal(tester, beto);
        await openKeyboard(tester, find.descendant(of: beto, matching: find.byType(ArNumberField)));
        final quitar = find.descendant(of: beto, matching: find.byTooltip('Quitar socio'));
        await _reveal(tester, quitar);
        await tester.tap(quitar);
        await settle(tester, 3);
        expectNoLayoutErrors(tester, 'al quitar un socio con el teclado abierto');
        await closeKeyboard(tester);
        await _scrollToTop(tester);
        expect(find.byType(ArNumberField, skipOffstage: false), findsNWidgets(2));
        await shoot(tester, 'socios_quitado');

        // 33,33 + 33,34 ya no suma 100: se iguala y se guarda (pide confirmación).
        await scrollToEnd(tester);
        await tester.tap(find.text('Igualar al 100%'));
        await settle(tester, 2);
        await tester.tap(_goldButton('Guardar reparto'));
        await settle(tester, 6);
        expectNoLayoutErrors(tester, 'al abrir la confirmación de quitar');
        await shoot(tester, 'socios_confirmar_quitar');
        expect(find.text('Quitar del reparto'), findsOneWidget);
        expectReachable(tester, find.widgetWithText(TextButton, 'Cancelar'), what: 'Cancelar de la confirmación');
        final confirmar = find.descendant(of: find.byType(AlertDialog), matching: find.text('Guardar'));
        expectReachable(tester, confirmar, what: 'Guardar de la confirmación');
        await tester.tap(confirmar);
        await settle(tester, 8);
        expect(api.removedSent, ['s1']);
        expect(api.sharesSaved!.map((s) => s.name), ['Ale Gómez', 'Caro']);
        expect(api.sharesSaved!.last.id, isNull, reason: 'el socio nuevo va sin id');
      });

      testWidgets('editor del reparto: salir con cambios pide confirmación en ${phone.name}', (tester) async {
        await openEditor(tester);
        await _type(tester, find.byType(ArNumberField).first, '70');
        await tester.tap(find.byType(BackButton));
        await settle(tester, 6);
        expectNoLayoutErrors(tester, 'al abrir "Descartar cambios"');
        await shoot(tester, 'socios_descartar');
        expect(find.text('Descartar cambios'), findsOneWidget);
        expectReachable(tester, find.widgetWithText(TextButton, 'Cancelar'), what: 'Cancelar');
        expectReachable(tester, find.descendant(of: find.byType(AlertDialog), matching: find.text('Descartar')), what: 'Descartar');
        await tester.tap(find.widgetWithText(TextButton, 'Cancelar'));
        await settle(tester, 6);
        expect(find.text('Reparto entre socios'), findsOneWidget, reason: 'cancelar deja el editor abierto');
        await tester.tap(find.byType(BackButton));
        await settle(tester, 6);
        await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Descartar')));
        await settle(tester, 8);
        expect(find.text('Reparto entre socios'), findsNothing);
      });

      testWidgets('editor del reparto: el error del servidor se ve con el teclado abierto en ${phone.name}', (tester) async {
        final api = _FakeGananciasApi(fail: 'Los socios cambiaron desde otro dispositivo. Actualizá la pantalla y volvé a intentar.');
        await openEditor(tester, api: api);
        await _type(tester, find.byType(ArNumberField).first, '70');
        await scrollToEnd(tester);
        await openKeyboard(tester, find.byType(ArNumberField).last);
        await _type(tester, find.byType(ArNumberField).last, '30');
        await tester.tap(_goldButton('Guardar reparto'));
        await settle(tester, 6);
        expectNoLayoutErrors(tester, 'al mostrar el error del servidor');
        await shoot(tester, 'socios_error_servidor');
        expectReachable(tester, find.textContaining('cambiaron desde otro dispositivo'), what: 'el error del servidor');
        expect(find.text('Reparto entre socios'), findsOneWidget, reason: 'con error no se cierra ni se pierde lo cargado');
      });

      testWidgets('editor del reparto: 20 socios con nombres largos en ${phone.name}', (tester) async {
        await openEditor(tester, data: _ganancias(extreme: true));
        await _shootAll(tester, 'socios_extremo');
        expectReachable(tester, _goldButton('Guardar reparto'), what: 'Guardar reparto');
        final agregar = tester.widget<ButtonStyleButton>(
          find.ancestor(of: find.text('Agregar socio'), matching: find.bySubtype<ButtonStyleButton>()).first,
        );
        expect(agregar.onPressed, isNull, reason: 'con 20 socios se llegó al tope');
        // Quitar varios y guardar: la confirmación con muchos nombres largos entra en pantalla.
        for (var i = 0; i < 6; i++) {
          final quitar = find.byTooltip('Quitar socio').last;
          await _reveal(tester, quitar);
          await tester.tap(quitar);
          await settle(tester, 2);
        }
        await scrollToEnd(tester);
        await tester.tap(find.text('Igualar al 100%'));
        await settle(tester, 2);
        await tester.tap(_goldButton('Guardar reparto'));
        await settle(tester, 6);
        expectNoLayoutErrors(tester, 'confirmación con muchos nombres');
        await shoot(tester, 'socios_extremo_confirmar');
        expectReachable(tester, find.widgetWithText(TextButton, 'Cancelar'), what: 'Cancelar de la confirmación larga');
        expectReachable(tester, find.descendant(of: find.byType(AlertDialog), matching: find.text('Guardar')), what: 'Guardar de la confirmación larga');
      });

      testWidgets('editor del reparto: sin permiso de crear / eliminar no ofrece agregar ni quitar en ${phone.name}', (tester) async {
        await openEditor(tester, as: staffWith(['ganancias'], role: 'operator', actions: const ['ver', 'editar']));
        await _shootAll(tester, 'socios_solo_editar');
        expect(find.text('Agregar socio'), findsNothing, reason: 'el servidor exige ganancias/crear para sumar un socio');
        expect(find.byTooltip('Quitar socio'), findsNothing, reason: 'el servidor exige ganancias/eliminar para quitar un socio');
        expect(find.text('Igualar al 100%'), findsOneWidget);
      });

      // ------------------------- Costos de producción -------------------------

      testWidgets('costos de producción: formulario con teclado en ${phone.name}', (tester) async {
        final api = _FakeGananciasApi();
        await _open(tester, const AdminGananciasScreen(), phone: phone, me: me, overrides: ov(api: api));
        await _reveal(tester, find.text('Editar costos'));
        await tester.tap(find.text('Editar costos'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester, 'al abrir los costos');
        _expectNotTruncated(tester, find.text('Costos de producción'), what: 'el título de costos');
        expect(find.text('95,5'), findsOneWidget, reason: 'el kWh se ve con coma decimal');
        await _shootAll(tester, 'costos');
        expectReachable(tester, _goldButton('Guardar'), what: 'el botón Guardar al final');

        await openKeyboard(tester, _numberField('Precio del kWh'));
        expectFocusedFieldVisible(tester);
        await shoot(tester, 'costos_teclado_primero');
        await _type(tester, _numberField('Precio del kWh'), '1.500,50');
        // El teclado numérico se cierra tocando afuera.
        await tester.tap(find.text('Costos de producción'));
        await tester.pump();
        expect(_focusedField, findsNothing, reason: 'tocar fuera del campo tiene que cerrar el teclado numérico');
        await closeKeyboard(tester);

        await openKeyboard(tester, _numberField('Costo de mantenimiento'));
        expectFocusedFieldVisible(tester);
        await shoot(tester, 'costos_teclado_ultimo');
        // Con el teclado abierto se llega a Guardar desplazando.
        await scrollToEnd(tester);
        await shoot(tester, 'costos_teclado_guardar');
        expectReachable(tester, _goldButton('Guardar'), what: 'Guardar con el teclado abierto');
        await tester.tap(_goldButton('Guardar'));
        await settle(tester, 8);
        expect(api.costsSaved, const CostSettings(kwhPrice: 1500.5, machineWatts: 220, machineLifeHours: 8000, maintenanceCost: 320000));
      });
    }

    testWidgets('letra grande (1,3×) en el teléfono chico', (tester) async {
      await _open(tester, const AdminGananciasScreen(), phone: Phone.small, me: me, overrides: ov(), textScale: 1.3);
      await _shootAll(tester, 'ganancias_grande');
      await _open(
        tester,
        const AdminGananciasScreen(),
        phone: Phone.small,
        me: me,
        overrides: ov(data: (m) => _ganancias(extreme: true, rows: 30)),
        textScale: 1.3,
      );
      await _shootAll(tester, 'ganancias_grande_extremo');

      // Editor del reparto con letra grande + confirmación.
      await _open(tester, const AdminGananciasScreen(), phone: Phone.small, me: me, overrides: ov(), textScale: 1.3);
      await _reveal(tester, find.text('Editar reparto'));
      await tester.tap(find.text('Editar reparto'));
      await settle(tester, 8);
      _expectNotTruncated(tester, find.text('Reparto entre socios'), what: 'el título del editor con letra grande');
      await _shootAll(tester, 'socios_grande');
      await openKeyboard(tester, find.byType(ArNumberField).last);
      expectFocusedFieldVisible(tester);
      await shoot(tester, 'socios_grande_teclado');
      expectReachable(tester, _goldButton('Guardar reparto'), what: 'Guardar reparto con letra grande y teclado');
      await closeKeyboard(tester);
      await _type(tester, find.byType(ArNumberField).first, '70');
      await tester.tap(find.byType(BackButton));
      await settle(tester, 6);
      expectNoLayoutErrors(tester, 'confirmación con letra grande');
      await shoot(tester, 'socios_grande_descartar');
      expectReachable(tester, find.widgetWithText(TextButton, 'Cancelar'), what: 'Cancelar con letra grande');
      expectReachable(tester, find.descendant(of: find.byType(AlertDialog), matching: find.text('Descartar')), what: 'Descartar con letra grande');
      await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Descartar')));
      await settle(tester, 8);

      // Costos con letra grande.
      await _reveal(tester, find.text('Editar costos'));
      await tester.tap(find.text('Editar costos'));
      await settle(tester, 8);
      _expectNotTruncated(tester, find.text('Costos de producción'), what: 'el título de costos con letra grande');
      await _shootAll(tester, 'costos_grande');
      await openKeyboard(tester, _numberField('Costo de mantenimiento'));
      expectFocusedFieldVisible(tester);
      await scrollToEnd(tester);
      expectReachable(tester, _goldButton('Guardar'), what: 'Guardar de costos con letra grande y teclado');
    });

    for (final mode in [HefestoThemeMode.light, HefestoThemeMode.warm]) {
      testWidgets('tema ${mode.name}: pantalla, editor y confirmación', (tester) async {
        for (final phone in Phone.both) {
          await _open(tester, const AdminGananciasScreen(), phone: phone, me: me, overrides: ov(), theme: mode);
          await _shootAll(tester, 'ganancias_${mode.name}');
          await _reveal(tester, find.text('Editar reparto'));
          await tester.tap(find.text('Editar reparto'));
          await settle(tester, 8);
          await shoot(tester, 'socios_${mode.name}');
          await _type(tester, find.byType(ArNumberField).first, '70');
          await tester.tap(find.byType(BackButton));
          await settle(tester, 6);
          await shoot(tester, 'socios_${mode.name}_descartar');
          expectReachable(tester, find.descendant(of: find.byType(AlertDialog), matching: find.text('Descartar')), what: 'Descartar');
        }
      });
    }
  });

  // =========================================================================
  // CALCULADORA 3D
  // =========================================================================
  group('Calculadora', () {
    final admin = staffWith(['calculadora']);
    final operador = staffWith(['calculadora'], role: 'operator', actions: const ['ver', 'crear']);

    Future<void> openCalc(
      WidgetTester tester,
      _FakeCalcApi api, {
      required Phone phone,
      MeInfo? me,
      CalcOverview Function()? data,
      HefestoThemeMode theme = HefestoThemeMode.dark,
      double textScale = 1,
    }) =>
        _open(
          tester,
          const AdminCalculadoraScreen(),
          phone: phone,
          me: me ?? admin,
          overrides: _calcOverrides(api, overview: data),
          theme: theme,
          textScale: textScale,
        );

    /// Camino real: ícono "Tipos y márgenes" → botón "Agregar tipo".
    Future<void> openPresetSheet(WidgetTester tester) async {
      await tester.tap(find.byTooltip('Tipos y márgenes'));
      await settle(tester, 8);
      expectNoLayoutErrors(tester, 'al abrir Tipos y márgenes');
      await tester.tap(find.byType(FloatingActionButton));
      await settle(tester, 8);
      expectNoLayoutErrors(tester, 'al abrir la hoja de alta de tipo');
      expect(find.text('Nuevo tipo'), findsOneWidget);
    }

    /// La columna de la barra fija de abajo (precio final + estado).
    Finder priceBar() => find.ancestor(of: find.text('PRECIO FINAL SUGERIDO'), matching: find.byType(Column)).first;

    Finder sheetList() => find.descendant(of: _inSheet(find.byType(ListView)), matching: find.byType(Scrollable)).first;

    for (final phone in Phone.both) {
      testWidgets('formulario: barra superior, pestañas y teclado en el primer y el último campo en ${phone.name}', (tester) async {
        final api = _FakeCalcApi();
        await openCalc(tester, api, phone: phone);
        expectReachable(tester, find.text('Calculadora 3D'), what: 'el título');
        _expectNotTruncated(tester, find.text('Calculadora 3D'), what: 'el título "Calculadora 3D" con sus dos íconos');
        expectReachable(tester, find.byTooltip('Tipos y márgenes'), what: 'el ícono de tipos y márgenes');
        expectReachable(tester, find.byTooltip('Configuración global'), what: 'el ícono de configuración');
        expectReachable(tester, find.widgetWithText(ChoiceChip, 'Calcular'), what: 'la pestaña Calcular');
        expectReachable(tester, find.widgetWithText(ChoiceChip, 'Historial (2)'), what: 'la pestaña Historial');
        await _shootAll(tester, 'calc');
        expectReachable(tester, find.text('PRECIO FINAL SUGERIDO'), what: 'la barra del precio');
        expectReachable(tester, _goldButton('Guardar'), what: 'Guardar (barra del precio)');

        await _scrollToTop(tester);
        await openKeyboard(tester, find.widgetWithText(TextField, 'Nombre de la pieza'));
        expectFocusedFieldVisible(tester);
        await shoot(tester, 'calc_teclado_primero');
        expectReachable(tester, _goldButton('Guardar'), what: 'Guardar con el teclado abierto (primer campo)');
        await closeKeyboard(tester);

        final notas = find.widgetWithText(TextField, 'Observaciones (opcional)');
        await _reveal(tester, notas);
        await openKeyboard(tester, notas);
        expectFocusedFieldVisible(tester);
        await shoot(tester, 'calc_teclado_ultimo');
        expectReachable(tester, _goldButton('Guardar'), what: 'Guardar con el teclado abierto (último campo)');
        // El campo de varias líneas no trae tecla "listo": tocar afuera lo cierra.
        await tester.tap(find.text('Calculadora 3D'));
        await tester.pump();
        expect(_focusedField, findsNothing, reason: 'tocar fuera del campo tiene que cerrar el teclado');
      });

      testWidgets('cotiza con "1.500,50", muestra el desglose y guarda en ${phone.name}', (tester) async {
        final api = _FakeCalcApi();
        await openCalc(tester, api, phone: phone);
        final gramos = _numberField('Gramos utilizados');
        await _reveal(tester, gramos);
        await openKeyboard(tester, gramos);
        await _type(tester, gramos, '1.500,50');
        await settle(tester, 6);
        expectNoLayoutErrors(tester, 'al cotizar');
        expectFocusedFieldVisible(tester);
        expect(api.quotes.single.grams, 1500.5, reason: '"1.500,50" es mil quinientos coma cinco');
        expect(find.text('\$6.806,30'), findsOneWidget);
        await shoot(tester, 'calc_cotizado_teclado');
        // El teclado numérico se cierra tocando afuera.
        await tester.tap(find.text('Calculadora 3D'));
        await tester.pump();
        expect(_focusedField, findsNothing, reason: 'tocar fuera del campo tiene que cerrar el teclado numérico');
        await closeKeyboard(tester);
        await _reveal(tester, find.text('Desglose del costo'));
        await shoot(tester, 'calc_desglose');
        await scrollToEnd(tester);
        expectReachable(tester, find.textContaining('Ganancia \$3.543,78'), what: 'el final del desglose');

        await _scrollToTop(tester);
        await _type(tester, find.widgetWithText(TextField, 'Nombre de la pieza'), 'Soporte nuevo');
        await tester.tap(_goldButton('Guardar'));
        await settle(tester, 6);
        expectNoLayoutErrors(tester, 'al guardar el cálculo');
        expect(api.saved, {
          'name': 'Soporte nuevo',
          'customer': '',
          'filamentId': 'f0',
          'grams': 1500.5,
          'hours': 0.0,
          'presetId': 'p0',
          'notes': '',
        });
        await shoot(tester, 'calc_guardado');
        expectReachable(tester, find.byType(SnackBar), what: 'el aviso de guardado');
      });

      testWidgets('si el servidor rechaza el guardado, el error se ve en la barra del precio en ${phone.name}', (tester) async {
        final api = _FakeCalcApi(fail: 'El filamento elegido ya no existe. Elegí otro.');
        await openCalc(tester, api, phone: phone);
        await _type(tester, find.widgetWithText(TextField, 'Nombre de la pieza'), 'Soporte');
        final gramos = _numberField('Gramos utilizados');
        await _reveal(tester, gramos);
        await _type(tester, gramos, '120');
        await settle(tester, 6);
        await _scrollToTop(tester);
        await tester.tap(_goldButton('Guardar'));
        await settle(tester, 6);
        expectNoLayoutErrors(tester, 'al mostrar el error de guardado');
        await shoot(tester, 'calc_error_guardar');
        expectReachable(
          tester,
          find.descendant(of: priceBar(), matching: find.textContaining('ya no existe')),
          what: 'el error del servidor en la barra del precio',
        );
        expect(api.saved, isNull);
      });

      testWidgets('estados: operador, sin filamentos ni historial, error y sin permiso en ${phone.name}', (tester) async {
        await openCalc(tester, _FakeCalcApi(admin: false), phone: phone, me: operador);
        expect(find.byTooltip('Tipos y márgenes'), findsNothing, reason: 'los márgenes son solo del administrador');
        expect(find.byTooltip('Configuración global'), findsNothing, reason: 'sin permiso de editar');
        await _shootAll(tester, 'calc_operador');

        await openCalc(tester, _FakeCalcApi(), phone: phone, data: () => _calc(filaments: 0, presets: 0, history: 0));
        await _shootAll(tester, 'calc_sin_filamentos');
        expect(find.text('Elegí un filamento.'), findsOneWidget);
        await tester.tap(find.widgetWithText(ChoiceChip, 'Historial (0)'));
        await settle(tester, 4);
        expectNoLayoutErrors(tester, 'con el historial vacío');
        await _shootAll(tester, 'calc_historial_vacio');
        expectReachable(tester, find.text('Todavía no guardaste cálculos'), what: 'el cartel de historial vacío');

        await _open(
          tester,
          const AdminCalculadoraScreen(),
          phone: phone,
          me: admin,
          overrides: [
            calculadoraProvider.overrideWith((ref) => throw ApiException('unavailable', 'No pudimos completar la operación. Probá de nuevo en unos segundos.')),
          ],
        );
        await shoot(tester, 'calc_error');
        expectReachable(tester, _goldButton('Reintentar'), what: 'el botón Reintentar');

        await _open(
          tester,
          const AdminCalculadoraScreen(),
          phone: phone,
          me: staffWith(['calculadora'], role: 'operator', actions: const []),
          overrides: _calcOverrides(_FakeCalcApi(admin: false)),
        );
        await shoot(tester, 'calc_sin_acceso');
        expectReachable(tester, find.text('Sin acceso'), what: 'el cartel de sin acceso');
      });

      testWidgets('selector de filamento: 40 filamentos, buscador con teclado y cierre en ${phone.name}', (tester) async {
        final api = _FakeCalcApi(extreme: true);
        await openCalc(tester, api, phone: phone, data: () => _calc(extreme: true, filaments: 40));
        await _reveal(tester, find.text('PLA · Rojo · Grilon3'));
        await tester.tap(find.text('PLA · Rojo · Grilon3'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester, 'al abrir el selector de filamento');
        await shoot(tester, 'calc_filamento_hoja');
        _expectSheetBelowStatusBar(tester);
        expectReachable(tester, _inSheet(find.text('Elegí el filamento')), what: 'el título de la hoja');
        // El final de la lista queda arriba de la barra del sistema.
        await scrollToEnd(tester, scrollable: sheetList());
        await shoot(tester, 'calc_filamento_hoja_final');
        expectReachable(tester, _inSheet(find.byType(ListTile)).last, what: 'el último filamento de la lista');

        // Buscador con el teclado abierto.
        final buscador = _inSheet(find.byType(TextField));
        await openKeyboard(tester, buscador);
        expectFocusedFieldVisible(tester);
        _expectSheetBelowStatusBar(tester);
        await _type(tester, buscador, 'dorado');
        await settle(tester, 2);
        expectNoLayoutErrors(tester, 'al buscar un filamento');
        await shoot(tester, 'calc_filamento_hoja_teclado');
        expectReachable(tester, _inSheet(find.byType(ListTile)).first, what: 'el primer resultado con el teclado abierto');
        await tester.tap(_inSheet(find.byType(ListTile)).first);
        await settle(tester, 8);
        expect(find.byType(BottomSheet), findsNothing, reason: 'elegir un filamento cierra la hoja');
        await closeKeyboard(tester);
        expectNoLayoutErrors(tester, 'con un filamento de nombre larguísimo elegido');
        await shoot(tester, 'calc_filamento_elegido');

        // Sin resultados y cierre con la manija.
        expect(find.textContaining('· Dorado · Printalot'), findsOneWidget, reason: 'se eligió el primer resultado de la búsqueda');
        await tester.tap(find.textContaining('· Dorado · Printalot'));
        await settle(tester, 8);
        await _type(tester, _inSheet(find.byType(TextField)), 'zzz');
        await settle(tester, 2);
        expect(_inSheet(find.text('Sin resultados')), findsOneWidget);
        await shoot(tester, 'calc_filamento_sin_resultados');
        await _closeSheetByHandle(tester);
      });

      testWidgets('historial: lista larga, buscador con teclado y detalle con eliminar en ${phone.name}', (tester) async {
        final api = _FakeCalcApi(extreme: true);
        await openCalc(tester, api, phone: phone, data: () => _calc(extreme: true, history: 32));
        await tester.tap(find.widgetWithText(ChoiceChip, 'Historial (32)'));
        await settle(tester, 4);
        expectNoLayoutErrors(tester, 'al abrir el historial');
        await _shootAll(tester, 'calc_historial');

        final buscador = find.widgetWithText(TextField, 'Buscar pieza, cliente o tipo…');
        await _reveal(tester, buscador);
        await openKeyboard(tester, buscador);
        expectFocusedFieldVisible(tester);
        await shoot(tester, 'calc_historial_teclado');
        await closeKeyboard(tester);

        // Detalle del cálculo con nombre, cliente y observaciones larguísimos.
        final item = find.text('Maceta grande: $_largo 0');
        await _reveal(tester, item);
        await tester.tap(item);
        await settle(tester, 8);
        expectNoLayoutErrors(tester, 'al abrir el detalle de un cálculo');
        await shoot(tester, 'calc_detalle');
        _expectSheetBelowStatusBar(tester);
        final eliminarHoja = _inSheet(find.text('Eliminar del historial'));
        expectReachable(tester, eliminarHoja, what: '"Eliminar del historial"');
        await scrollToEnd(tester, scrollable: _inSheet(find.byType(Scrollable)).first);
        await shoot(tester, 'calc_detalle_final');
        expectReachable(tester, eliminarHoja, what: '"Eliminar del historial" (con el detalle al final)');

        await tester.tap(eliminarHoja);
        await settle(tester, 6);
        expectNoLayoutErrors(tester, 'al abrir la confirmación de eliminar');
        await shoot(tester, 'calc_detalle_confirmar');
        expectReachable(tester, find.widgetWithText(TextButton, 'Cancelar'), what: 'Cancelar');
        final eliminar = find.descendant(of: find.byType(AlertDialog), matching: find.text('Eliminar'));
        expectReachable(tester, eliminar, what: 'Eliminar');
        await tester.tap(eliminar);
        await settle(tester, 8);
        expect(api.deleted, 'h0');
        expect(find.byType(BottomSheet), findsNothing, reason: 'después de eliminar se cierra la hoja');
      });

      testWidgets('tipos y márgenes: lista larga, botón flotante y hoja con teclado en ${phone.name}', (tester) async {
        final api = _FakeCalcApi(extreme: true);
        await openCalc(tester, api, phone: phone);
        await tester.tap(find.byTooltip('Tipos y márgenes'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester, 'al abrir Tipos y márgenes');
        _expectNotTruncated(tester, find.text('Tipos y márgenes'), what: 'el título "Tipos y márgenes"');
        final fab = find.byType(FloatingActionButton);
        expectReachable(tester, fab, what: 'el botón "Agregar tipo"');
        await _shootAll(tester, 'tipos');
        // Al final de la lista, el último tipo no queda debajo del botón flotante.
        final ultimo = find.byTooltip('Eliminar').last;
        expectReachable(tester, ultimo, what: 'el último tipo de la lista');
        expect(
          tester.getRect(ultimo).bottom <= tester.getRect(fab).top + 0.5,
          isTrue,
          reason: 'el botón flotante tapa al último tipo (${tester.getRect(ultimo)} contra ${tester.getRect(fab)})',
        );

        // Alta de un tipo, con el teclado en cada campo.
        await tester.tap(fab);
        await settle(tester, 8);
        expectNoLayoutErrors(tester, 'al abrir la hoja de alta');
        await shoot(tester, 'tipos_hoja');
        _expectSheetBelowStatusBar(tester);
        final guardar = _inSheet(_goldButton('Guardar'));
        expectReachable(tester, guardar, what: 'Guardar de la hoja');
        final nombre = _inSheet(find.widgetWithText(TextField, 'Nombre'));
        await openKeyboard(tester, nombre);
        expectFocusedFieldVisible(tester);
        _expectSheetBelowStatusBar(tester);
        expectReachable(tester, guardar, what: 'Guardar con el teclado abierto (nombre)');
        await _type(tester, nombre, 'Figuras articuladas de colección pintadas a mano');
        await shoot(tester, 'tipos_hoja_teclado_nombre');
        final margen = _numberField('Margen de ganancia');
        await tester.tap(margen, warnIfMissed: false);
        await settle(tester, 4);
        expectFocusedFieldVisible(tester);
        expectReachable(tester, guardar, what: 'Guardar con el teclado abierto (margen)');
        // Un margen que no entra en la base se avisa en el campo (antes fallaba al guardar).
        await _type(tester, margen, '10000');
        expect(find.text('Máximo 9.999,99.'), findsOneWidget);
        expect(_goldEnabled(tester, 'Guardar'), isFalse);
        await _type(tester, margen, '200,5');
        expectNoLayoutErrors(tester, 'al tipear el margen');
        await shoot(tester, 'tipos_hoja_teclado_margen');
        // El teclado numérico se cierra tocando afuera (el título de la hoja).
        await tester.tap(_inSheet(find.text('Nuevo tipo')));
        await tester.pump();
        expect(_focusedField, findsNothing, reason: 'tocar fuera del campo tiene que cerrar el teclado numérico');
        await closeKeyboard(tester);
        await tester.tap(guardar);
        await settle(tester, 8);
        expect(api.presetCreated, {
          'name': 'Figuras articuladas de colección pintadas a mano',
          'marginPct': 200.5,
          'active': true,
          'sortOrder': 30,
        });
        expect(find.byType(BottomSheet), findsNothing, reason: 'después de guardar se cierra la hoja');

        // Edición: abre con los datos del tipo y se cierra con la manija.
        await _scrollToTop(tester);
        await tester.tap(find.text('Llaveros'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester, 'al abrir la hoja de edición');
        expect(find.text('Editar tipo'), findsOneWidget);
        await shoot(tester, 'tipos_hoja_editar');
        await _closeSheetByHandle(tester);

        // Eliminar pide confirmación.
        await tester.tap(find.byTooltip('Eliminar').first);
        await settle(tester, 6);
        expectNoLayoutErrors(tester, 'al abrir la confirmación de eliminar un tipo');
        await shoot(tester, 'tipos_confirmar_eliminar');
        expectReachable(tester, find.widgetWithText(TextButton, 'Cancelar'), what: 'Cancelar');
        final eliminar = find.descendant(of: find.byType(AlertDialog), matching: find.text('Eliminar'));
        expectReachable(tester, eliminar, what: 'Eliminar');
        await tester.tap(eliminar);
        await settle(tester, 6);
        expect(api.presetDeleted, 'p0');
      });

      testWidgets('configuración global: formulario con teclado en ${phone.name}', (tester) async {
        final api = _FakeCalcApi();
        await openCalc(tester, api, phone: phone);
        await tester.tap(find.byTooltip('Configuración global'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester, 'al abrir la configuración global');
        _expectNotTruncated(tester, find.text('Configuración global'), what: 'el título "Configuración global"');
        await _shootAll(tester, 'calc_config');
        expectReachable(tester, _goldButton('Guardar'), what: 'Guardar al final de la pantalla');

        await _scrollToTop(tester);
        await openKeyboard(tester, _numberField('Precio del kWh'));
        expectFocusedFieldVisible(tester);
        await shoot(tester, 'calc_config_teclado_primero');
        await closeKeyboard(tester);

        final ultimo = _numberField('Margen de error');
        await _reveal(tester, ultimo);
        await openKeyboard(tester, ultimo);
        expectFocusedFieldVisible(tester);
        await _type(tester, ultimo, '12,5');
        await shoot(tester, 'calc_config_teclado_ultimo');
        // Con el teclado abierto se llega a Guardar desplazando.
        await scrollToEnd(tester);
        expectReachable(tester, _goldButton('Guardar'), what: 'Guardar con el teclado abierto');
        await tester.tap(_goldButton('Guardar'));
        await settle(tester, 8);
        expect(api.configSaved?.marginErrorPct, 12.5);
        expect(find.text('Configuración global'), findsNothing, reason: 'después de guardar vuelve a la calculadora');
      });
    }

    testWidgets('letra grande (1,3×) en el teléfono chico', (tester) async {
      final api = _FakeCalcApi(extreme: true);
      await openCalc(tester, api, phone: Phone.small, data: () => _calc(extreme: true, filaments: 40, history: 6), textScale: 1.3);
      await _shootAll(tester, 'calc_grande');
      final gramos = _numberField('Gramos utilizados');
      await _reveal(tester, gramos);
      await openKeyboard(tester, gramos);
      await _type(tester, gramos, '120');
      await settle(tester, 6);
      expectNoLayoutErrors(tester, 'al cotizar con letra grande');
      expectFocusedFieldVisible(tester);
      expectReachable(tester, _goldButton('Guardar'), what: 'Guardar con letra grande y teclado');
      await shoot(tester, 'calc_grande_teclado');
      await closeKeyboard(tester);
      await scrollToEnd(tester);
      await shoot(tester, 'calc_grande_desglose');

      // Selector de filamento.
      await _reveal(tester, find.text('PLA · Rojo · Grilon3'));
      await tester.tap(find.text('PLA · Rojo · Grilon3'));
      await settle(tester, 8);
      expectNoLayoutErrors(tester, 'selector de filamento con letra grande');
      _expectSheetBelowStatusBar(tester);
      await openKeyboard(tester, _inSheet(find.byType(TextField)));
      expectFocusedFieldVisible(tester);
      await shoot(tester, 'calc_grande_filamento');
      await closeKeyboard(tester);
      await _closeSheetByHandle(tester);

      // Historial y detalle.
      await tester.tap(find.widgetWithText(ChoiceChip, 'Historial (6)'));
      await settle(tester, 4);
      expectNoLayoutErrors(tester, 'historial con letra grande');
      await _shootAll(tester, 'calc_grande_historial');
      final item = find.text('Maceta grande: $_largo 0');
      await _reveal(tester, item);
      await tester.tap(item);
      await settle(tester, 8);
      expectNoLayoutErrors(tester, 'detalle con letra grande');
      await shoot(tester, 'calc_grande_detalle');
      _expectSheetBelowStatusBar(tester);
      expectReachable(tester, _inSheet(find.text('Eliminar del historial')), what: '"Eliminar del historial" con letra grande');
      await _closeSheetByHandle(tester);

      // Tipos y hoja de alta con el teclado.
      await openPresetSheet(tester);
      await openKeyboard(tester, _numberField('Margen de ganancia'));
      expectFocusedFieldVisible(tester);
      _expectSheetBelowStatusBar(tester);
      await shoot(tester, 'tipos_grande_hoja_teclado');
      expectReachable(tester, _inSheet(_goldButton('Guardar')), what: 'Guardar de la hoja con letra grande y teclado');
      await closeKeyboard(tester);
      await _closeSheetByHandle(tester);
      await _shootAll(tester, 'tipos_grande');
    });

    for (final mode in [HefestoThemeMode.light, HefestoThemeMode.warm]) {
      testWidgets('tema ${mode.name}: formulario, selector de filamento y hoja de tipo', (tester) async {
        for (final phone in Phone.both) {
          await openCalc(tester, _FakeCalcApi(), phone: phone, theme: mode);
          final gramos = _numberField('Gramos utilizados');
          await _reveal(tester, gramos);
          await _type(tester, gramos, '120');
          await settle(tester, 6);
          await _scrollToTop(tester);
          await _shootAll(tester, 'calc_${mode.name}');
          await _reveal(tester, find.text('PLA · Rojo · Grilon3'));
          await tester.tap(find.text('PLA · Rojo · Grilon3'));
          await settle(tester, 8);
          expectNoLayoutErrors(tester, 'selector de filamento en tema ${mode.name}');
          await shoot(tester, 'calc_${mode.name}_filamento');
          _expectSheetBelowStatusBar(tester);
          await _closeSheetByHandle(tester);
          await openPresetSheet(tester);
          await shoot(tester, 'calc_${mode.name}_tipo');
          expectReachable(tester, _inSheet(_goldButton('Guardar')), what: 'Guardar de la hoja');
        }
      });
    }
  });

  // =========================================================================
  // Diálogo de confirmación del kit de análisis
  // =========================================================================
  group('Confirmación (kit de análisis)', () {
    Widget launcher({required String title, required String message, String label = 'Eliminar', bool destructive = true}) => Scaffold(
          appBar: AppBar(title: const Text('Prueba')),
          body: Builder(
            builder: (context) => Center(
              child: FilledButton(
                key: const Key('preguntar'),
                onPressed: () => confirmDialog(context, title: title, message: message, confirmLabel: label, destructive: destructive),
                child: const Text('Preguntar'),
              ),
            ),
          ),
        );

    for (final phone in Phone.both) {
      for (final scale in [1.0, 1.3]) {
        testWidgets('textos largos a $scale× en ${phone.name}', (tester) async {
          await pumpPhone(
            tester,
            launcher(
              title: 'Eliminar el tipo "Figuras articuladas de colección pintadas a mano"',
              message: List.filled(14, '¿Eliminar "$_largo"? Los cálculos ya guardados no se tocan. Si solo querés ocultarlo, desactivalo.').join(' '),
              label: 'Eliminar definitivamente',
            ),
            phone: phone,
            textScale: scale,
          );
          await tester.tap(find.byKey(const Key('preguntar')));
          await settle(tester, 6);
          expectNoLayoutErrors(tester, 'confirmación con textos largos');
          await shoot(tester, 'confirmacion_larga${scale > 1 ? '_grande' : ''}');
          expectReachable(tester, find.widgetWithText(TextButton, 'Cancelar'), what: 'Cancelar');
          expectReachable(tester, find.text('Eliminar definitivamente'), what: 'la acción principal');
          // El final del mensaje se puede leer (desplazando el contenido).
          final dialogScroll = find.descendant(of: find.byType(AlertDialog), matching: find.byType(Scrollable));
          expect(dialogScroll, findsWidgets, reason: 'un mensaje largo tiene que poder desplazarse, no cortarse');
          await scrollToEnd(tester, scrollable: dialogScroll.first);
          await shoot(tester, 'confirmacion_larga_final${scale > 1 ? '_grande' : ''}');
          expectReachable(tester, find.widgetWithText(TextButton, 'Cancelar'), what: 'Cancelar (al final del mensaje)');
          await tester.tap(find.widgetWithText(TextButton, 'Cancelar'));
          await settle(tester, 6);
          expect(find.byType(AlertDialog), findsNothing);
        });
      }

      testWidgets('texto corto, en los tres temas, en ${phone.name}', (tester) async {
        for (final mode in HefestoThemeMode.values) {
          await pumpPhone(
            tester,
            launcher(title: 'Eliminar cálculo', message: '¿Eliminar "Soporte auriculares" del historial? No se puede deshacer.'),
            phone: phone,
            theme: mode,
          );
          await tester.tap(find.byKey(const Key('preguntar')));
          await settle(tester, 6);
          expectNoLayoutErrors(tester, 'confirmación corta');
          await shoot(tester, 'confirmacion_${mode.name}');
          expectReachable(tester, find.widgetWithText(TextButton, 'Cancelar'), what: 'Cancelar');
          expectReachable(tester, find.descendant(of: find.byType(AlertDialog), matching: find.text('Eliminar')), what: 'Eliminar');
        }
      });
    }
  });
}
