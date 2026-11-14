import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/features/admin/calculadora/calc_config_screen.dart';
import 'package:hefesto/features/admin/calculadora/calculadora_api.dart';
import 'package:hefesto/features/admin/calculadora/calculadora_models.dart';
import 'package:hefesto/features/admin/calculadora/calculadora_screen.dart';
import 'package:hefesto/features/admin/calculadora/presets_screen.dart';

import 'analisis_test_kit.dart';

Map<String, dynamic> _filament(String id, String color, num cost, String hex) =>
    {'id': id, 'material': 'PLA', 'color': color, 'brand': 'Grilon3', 'costPerKg': cost, 'hex': hex};

Map<String, dynamic> _hist(String id, String name, num price, {bool admin = true, String? customer}) => {
      'id': id,
      'name': name,
      'customer': customer,
      'material': 'PLA',
      'color': 'Rojo',
      'grams': 120,
      'hours': 3.5,
      'precioFinal': price,
      'notes': id == 'h1' ? 'Pidió el rojo más oscuro' : null,
      'createdAt': '2026-10-3${id.length}T10:00:00.000Z',
      if (admin) ...{'costPerKg': 25000, 'marginPct': 150, 'costoTotal': 1234.5, 'ganancia': 1851.75},
    };

CalcOverview _overview({bool admin = true, bool noFilaments = false}) => CalcOverview.fromJson({
      'isAdmin': admin,
      'config': {'kwhPrice': 95, 'machineWatts': 220, 'machineLifeHours': 8000, 'maintenanceCost': 320000, 'marginErrorPct': 8},
      'filaments': noFilaments
          ? []
          : [_filament('f1', 'Rojo', 25000, '#CC2200'), _filament('f2', 'Dorado', 35000, '#C9A84C')],
      'presetOptions': [
        {'id': 'p1', 'name': 'Llaveros'},
        {'id': 'p2', 'name': 'Macetas'},
      ],
      'presets': admin
          ? [
              {'id': 'p1', 'name': 'Llaveros', 'marginPct': 150, 'active': true, 'sortOrder': 0},
              {'id': 'p2', 'name': 'Macetas', 'marginPct': 80.5, 'active': true, 'sortOrder': 1},
              {'id': 'p3', 'name': 'Viejo', 'marginPct': 60, 'active': false, 'sortOrder': 2},
            ]
          : [],
      'history': [
        _hist('h1', 'Soporte auriculares', 3086.25, admin: admin, customer: 'Juan'),
        _hist('h22', 'Maceta grande con un nombre bastante largo para probar el recorte', 12500, admin: admin),
      ],
      'stats': {
        'count': 2,
        'grams': 240,
        'hours': 7,
        if (admin) ...{'ganancia': 3703.5, 'precioFinal': 15586.25},
      },
    });

class _FakeApi implements CalculadoraApi {
  _FakeApi({this.admin = true});
  final bool admin;

  final List<QuoteRequest> quotes = [];
  Map<String, Object?>? saved;
  String? deleted;
  CalcConfig? configSaved;
  Map<String, Object?>? presetCreated;
  Map<String, Object?>? presetUpdated;
  String? presetDeleted;

  @override
  Future<CalcOverview> overview() async => _overview(admin: admin);

  @override
  Future<CalcQuote> quote(QuoteRequest r) async {
    quotes.add(r);
    // Respuestas de ejemplo del servidor: la app NO calcula nada de esto.
    if (!admin) return const CalcQuote(precioFinal: 6806.3);
    return const CalcQuote(
      detail: true,
      precioFinal: 6806.3,
      material: 3000,
      electricidad: 12.35,
      desgaste: 8.5,
      subtotal: 3020.85,
      margenError: 241.67,
      costoTotal: 3262.52,
      ganancia: 3543.78,
      marginPct: 150,
      costPerKg: 25000,
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
    saved = {'name': name, 'customer': customer, 'filamentId': filamentId, 'grams': grams, 'hours': hours, 'presetId': presetId, 'notes': notes};
    return 'nuevo';
  }

  @override
  Future<void> deleteCalc(String id) async => deleted = id;

  @override
  Future<CalcConfig> saveConfig(CalcConfig config) async {
    configSaved = config;
    return config;
  }

  @override
  Future<void> createPreset({required String name, required double marginPct, bool active = true, int sortOrder = 0}) async =>
      presetCreated = {'name': name, 'marginPct': marginPct, 'active': active, 'sortOrder': sortOrder};

  @override
  Future<void> updatePreset(String id, {required String name, required double marginPct, required bool active, required int sortOrder}) async =>
      presetUpdated = {'id': id, 'name': name, 'marginPct': marginPct, 'active': active, 'sortOrder': sortOrder};

  @override
  Future<void> deletePreset(String id) async => presetDeleted = id;
}

bool _enabled(WidgetTester tester, String label) {
  final inkWell = find.ancestor(of: find.text(label), matching: find.byType(InkWell)).first;
  return tester.widget<InkWell>(inkWell).onTap != null;
}

Future<void> _fill(WidgetTester tester, String label, String text) async {
  await tester.enterText(find.widgetWithText(TextFormField, label), text);
  await tester.pump();
}

void main() {
  setUpAll(analisisSetUp);

  final admin = meWith(['calculadora']);
  final operator = meWith(['calculadora'], role: 'operator', actions: {'ver', 'crear'});

  testWidgets('Calculadora (admin): formulario vacío', (tester) async {
    final api = _FakeApi();
    await showScreen(
      tester,
      'calculadora',
      const AdminCalculadoraScreen(),
      height: 1300,
      me: admin,
      overrides: [
        calculadoraProvider.overrideWith((ref) async => _overview()),
        calculadoraApiProvider.overrideWithValue(api),
      ],
    );
    expect(find.text('Calcular'), findsOneWidget);
    expect(find.text('Historial (2)'), findsOneWidget);
    expect(find.text('Nuevo presupuesto'), findsOneWidget);
    expect(find.text('PLA · Rojo · Grilon3'), findsOneWidget, reason: 'el primer filamento viene elegido');
    expect(find.text('\$25.000 por kg'), findsOneWidget);
    expect(find.text('Llaveros · 150%'), findsOneWidget, reason: 'el admin ve el margen de cada tipo');
    expect(find.text('PRECIO FINAL SUGERIDO'), findsOneWidget);
    expect(find.text('Cargá gramos u horas.'), findsOneWidget);
    expect(find.byTooltip('Tipos y márgenes'), findsOneWidget);
    expect(find.byTooltip('Configuración global'), findsOneWidget);
    expect(api.quotes, isEmpty, reason: 'sin datos no se cotiza');
  });

  testWidgets('Calculadora: cotiza en el servidor con debounce, sin calcular nada en la app', (tester) async {
    final api = _FakeApi();
    await showScreen(
      tester,
      'calculadora_cotiza',
      const AdminCalculadoraScreen(),
      height: 1900,
      me: admin,
      overrides: [
        calculadoraProvider.overrideWith((ref) async => _overview()),
        calculadoraApiProvider.overrideWithValue(api),
      ],
    );
    await _fill(tester, 'Gramos utilizados', '120,5');
    await _fill(tester, 'Horas', '3');
    await _fill(tester, 'Minutos', '30');
    expect(api.quotes, isEmpty, reason: 'todavía está dentro del debounce');
    expect(find.text('Calculando…'), findsOneWidget);
    await advance(tester, 600);
    expect(api.quotes, hasLength(1), reason: 'se juntaron los tres cambios en una sola consulta');
    final q = api.quotes.single;
    expect(q.grams, 120.5);
    expect(q.hours, 3.5, reason: '3 h + 30 min');
    expect(q.filamentId, 'f1');
    expect(q.presetId, 'p1');
    // Lo que se ve es lo que dijo el servidor, tal cual.
    expect(find.text('\$6.806,30'), findsOneWidget);
    expect(find.text('Desglose del costo'), findsOneWidget);
    expect(find.text('\$3.000,00'), findsOneWidget);
    expect(find.text('\$3.262,52'), findsOneWidget);
    expect(find.textContaining('Ganancia \$3.543,78 · margen 150%'), findsOneWidget);
    await snap(tester, 'calculadora_cotizado');
  });

  testWidgets('Calculadora: cambiar el tipo de producto vuelve a cotizar', (tester) async {
    final api = _FakeApi();
    await showScreen(
      tester,
      'calculadora_tipo',
      const AdminCalculadoraScreen(),
      height: 1900,
      me: admin,
      overrides: [
        calculadoraProvider.overrideWith((ref) async => _overview()),
        calculadoraApiProvider.overrideWithValue(api),
      ],
    );
    await _fill(tester, 'Gramos utilizados', '50');
    await advance(tester, 600);
    await tester.tap(find.text('Macetas · 80,5%'));
    await advance(tester, 600);
    expect(api.quotes.map((q) => q.presetId), ['p1', 'p2']);
  });

  testWidgets('Calculadora: un número inválido no se manda al servidor', (tester) async {
    final api = _FakeApi();
    await showScreen(
      tester,
      'calculadora_invalido',
      const AdminCalculadoraScreen(),
      height: 1900,
      me: admin,
      overrides: [
        calculadoraProvider.overrideWith((ref) async => _overview()),
        calculadoraApiProvider.overrideWithValue(api),
      ],
    );
    await _fill(tester, 'Gramos utilizados', '1.2.3');
    await advance(tester, 600);
    expect(find.text('No entiendo ese número. Ejemplo: 1.234,50'), findsOneWidget);
    expect(find.text('Revisá los números marcados.'), findsOneWidget);
    await _fill(tester, 'Minutos', '75');
    expect(find.text('Máximo 59.'), findsOneWidget);
    expect(api.quotes, isEmpty);
  });

  testWidgets('Calculadora: guardar en el historial manda ids y números, nunca costo ni margen', (tester) async {
    final api = _FakeApi();
    await showScreen(
      tester,
      'calculadora_guarda',
      const AdminCalculadoraScreen(),
      height: 1900,
      me: admin,
      overrides: [
        calculadoraProvider.overrideWith((ref) async => _overview()),
        calculadoraApiProvider.overrideWithValue(api),
      ],
    );
    await _fill(tester, 'Gramos utilizados', '120');
    await _fill(tester, 'Horas', '3');
    await advance(tester, 600);
    expect(_enabled(tester, 'Guardar'), isFalse, reason: 'falta el nombre');
    expect(find.text('Poné un nombre para guardarlo.'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextField, 'Nombre de la pieza'), 'Soporte nuevo');
    await tester.pump();
    expect(_enabled(tester, 'Guardar'), isTrue);
    await tester.tap(find.text('Guardar'));
    await advance(tester, 400);
    expect(api.saved, {
      'name': 'Soporte nuevo',
      'customer': '',
      'filamentId': 'f1',
      'grams': 120.0,
      'hours': 3.0,
      'presetId': 'p1',
      'notes': '',
    });
    expect(find.text('Presupuesto guardado en el historial'), findsOneWidget);
    // Después de guardar el formulario queda limpio.
    expect(find.text('Cargá gramos u horas.'), findsOneWidget);
  });

  testWidgets('Calculadora (operador): solo ve el precio final, nunca el margen ni la ganancia', (tester) async {
    final api = _FakeApi(admin: false);
    await showScreen(
      tester,
      'calculadora_operador',
      const AdminCalculadoraScreen(),
      height: 1500,
      me: operator,
      overrides: [
        calculadoraProvider.overrideWith((ref) async => _overview(admin: false)),
        calculadoraApiProvider.overrideWithValue(api),
      ],
    );
    expect(find.text('Llaveros'), findsOneWidget);
    expect(find.textContaining('150'), findsNothing);
    expect(find.byTooltip('Tipos y márgenes'), findsNothing);
    expect(find.byTooltip('Configuración global'), findsNothing, reason: 'sin permiso de editar');
    await _fill(tester, 'Gramos utilizados', '100');
    await advance(tester, 600);
    expect(find.text('\$6.806,30'), findsOneWidget);
    expect(find.text('Desglose del costo'), findsNothing);
    expect(find.textContaining('margen'), findsNothing);
    expect(find.textContaining('Ganancia'), findsNothing);
  });

  testWidgets('Calculadora: sin filamentos avisa en vez de romper', (tester) async {
    await showScreen(
      tester,
      'calculadora_sin_filamentos',
      const AdminCalculadoraScreen(),
      height: 1300,
      me: admin,
      overrides: [
        calculadoraProvider.overrideWith((ref) async => _overview(noFilaments: true)),
        calculadoraApiProvider.overrideWithValue(_FakeApi()),
      ],
    );
    expect(find.textContaining('No hay filamentos cargados'), findsOneWidget);
    expect(find.text('Elegí un filamento.'), findsOneWidget);
  });

  testWidgets('Calculadora: elegir otro filamento desde el selector', (tester) async {
    final api = _FakeApi();
    await showScreen(
      tester,
      'calculadora_filamento',
      const AdminCalculadoraScreen(),
      height: 1900,
      me: admin,
      overrides: [
        calculadoraProvider.overrideWith((ref) async => _overview()),
        calculadoraApiProvider.overrideWithValue(api),
      ],
    );
    await _fill(tester, 'Gramos utilizados', '80');
    await advance(tester, 600);
    await tester.tap(find.text('PLA · Rojo · Grilon3'));
    await advance(tester, 400);
    expect(find.text('\$35.000 por kg'), findsOneWidget);
    await tester.tap(find.text('PLA · Dorado · Grilon3'));
    await advance(tester, 800);
    expect(api.quotes.last.filamentId, 'f2');
  });

  group('historial', () {
    testWidgets('admin: estadísticas, búsqueda y detalle con costos', (tester) async {
      final api = _FakeApi();
      await showScreen(
        tester,
        'calculadora_historial',
        const AdminCalculadoraScreen(),
        height: 1700,
        me: admin,
        overrides: [
          calculadoraProvider.overrideWith((ref) async => _overview()),
          calculadoraApiProvider.overrideWithValue(api),
        ],
      );
      await tester.tap(find.text('Historial (2)'));
      await advance(tester, 300);
      expect(find.text('Ganancias calculadas'), findsOneWidget);
      expect(find.text('Facturación estimada'), findsOneWidget);
      expect(find.text('Soporte auriculares'), findsOneWidget);
      expect(find.text('\$3.086'), findsOneWidget);

      await tester.enterText(find.byType(TextField).first, 'sopor');
      await tester.pump();
      expect(find.textContaining('Maceta grande'), findsNothing);

      await tester.tap(find.text('Soporte auriculares'));
      await advance(tester, 500);
      expect(find.text('Costo total de producción'), findsOneWidget);
      expect(find.text('\$1.234,50'), findsOneWidget);
      expect(find.text('Pidió el rojo más oscuro'), findsOneWidget);

      await tester.tap(find.text('Eliminar del historial'));
      await advance(tester, 400);
      expect(find.text('Eliminar cálculo'), findsOneWidget);
      await tester.tap(find.text('Eliminar').last);
      await advance(tester, 500);
      expect(api.deleted, 'h1');
    });

    testWidgets('operador: ve los cálculos pero sin costos ni ganancia', (tester) async {
      await showScreen(
        tester,
        'calculadora_historial_operador',
        const AdminCalculadoraScreen(),
        height: 1700,
        me: operator,
        overrides: [
          calculadoraProvider.overrideWith((ref) async => _overview(admin: false)),
          calculadoraApiProvider.overrideWithValue(_FakeApi(admin: false)),
        ],
      );
      await tester.tap(find.text('Historial (2)'));
      await advance(tester, 300);
      expect(find.text('Ganancias calculadas'), findsNothing);
      expect(find.text('Facturación estimada'), findsNothing);
      expect(find.text('Piezas presupuestadas'), findsOneWidget);
      await tester.tap(find.text('Soporte auriculares'));
      await advance(tester, 500);
      expect(find.text('Costo total de producción'), findsNothing);
      expect(find.text('Ganancia'), findsNothing);
      expect(find.text('Eliminar del historial'), findsNothing, reason: 'sin permiso de eliminar');
    });

    testWidgets('historial vacío', (tester) async {
      await showScreen(
        tester,
        'calculadora_historial_vacio',
        const AdminCalculadoraScreen(),
        height: 1300,
        me: admin,
        overrides: [
          calculadoraProvider.overrideWith(
            (ref) async => CalcOverview.fromJson({'isAdmin': true, 'config': {}, 'stats': {}}),
          ),
          calculadoraApiProvider.overrideWithValue(_FakeApi()),
        ],
      );
      await tester.tap(find.text('Historial (0)'));
      await advance(tester, 300);
      expect(find.text('Todavía no guardaste cálculos'), findsOneWidget);
    });
  });

  group('configuración global', () {
    testWidgets('valida y guarda con formato argentino', (tester) async {
      final api = _FakeApi();
      final config = _overview().config;
      await showScreen(
        tester,
        'calculadora_config',
        CalcConfigScreen(config: config),
        height: 1100,
        me: admin,
        overrides: [calculadoraApiProvider.overrideWithValue(api)],
      );
      expect(_enabled(tester, 'Guardar'), isFalse);
      await _fill(tester, 'Margen de error', '120');
      expect(find.text('Máximo 100.'), findsOneWidget);
      expect(_enabled(tester, 'Guardar'), isFalse);
      await _fill(tester, 'Margen de error', '12,5');
      await _fill(tester, 'Costo de mantenimiento', '350.000');
      expect(_enabled(tester, 'Guardar'), isTrue);
      await tester.tap(find.text('Guardar'));
      await advance(tester, 400);
      expect(
        api.configSaved,
        const CalcConfig(kwhPrice: 95, machineWatts: 220, machineLifeHours: 8000, maintenanceCost: 350000, marginErrorPct: 12.5),
      );
    });
  });

  group('tipos y márgenes (admin)', () {
    testWidgets('lista los tipos con su margen y los inactivos marcados', (tester) async {
      await showScreen(
        tester,
        'calculadora_tipos',
        const PresetsScreen(),
        height: 1000,
        me: admin,
        overrides: [
          calculadoraProvider.overrideWith((ref) async => _overview()),
          calculadoraApiProvider.overrideWithValue(_FakeApi()),
        ],
      );
      expect(find.text('Llaveros'), findsOneWidget);
      expect(find.text('Margen 150%'), findsOneWidget);
      expect(find.text('Margen 80,5%'), findsOneWidget);
      expect(find.text('Margen 60% · oculto'), findsOneWidget);
      expect(find.text('Agregar tipo'), findsOneWidget);
    });

    testWidgets('crear un tipo con margen decimal', (tester) async {
      final api = _FakeApi();
      await showScreen(
        tester,
        'calculadora_tipo_nuevo',
        const PresetsScreen(),
        height: 1000,
        me: admin,
        overrides: [
          calculadoraProvider.overrideWith((ref) async => _overview()),
          calculadoraApiProvider.overrideWithValue(api),
        ],
      );
      await tester.tap(find.text('Agregar tipo'));
      await advance(tester, 500);
      expect(find.text('Nuevo tipo'), findsOneWidget);
      expect(_enabled(tester, 'Guardar'), isFalse, reason: 'falta el nombre');
      await tester.enterText(find.widgetWithText(TextField, 'Nombre'), 'Figuras');
      await _fill(tester, 'Margen de ganancia', '200,5');
      expect(_enabled(tester, 'Guardar'), isTrue);
      await tester.tap(find.text('Guardar'));
      await advance(tester, 500);
      expect(api.presetCreated, {'name': 'Figuras', 'marginPct': 200.5, 'active': true, 'sortOrder': 3});
    });

    testWidgets('eliminar pide confirmación', (tester) async {
      final api = _FakeApi();
      await showScreen(
        tester,
        'calculadora_tipo_borrar',
        const PresetsScreen(),
        height: 1000,
        me: admin,
        overrides: [
          calculadoraProvider.overrideWith((ref) async => _overview()),
          calculadoraApiProvider.overrideWithValue(api),
        ],
      );
      await tester.tap(find.byTooltip('Eliminar').first);
      await advance(tester, 400);
      expect(find.text('Eliminar tipo'), findsOneWidget);
      expect(api.presetDeleted, isNull, reason: 'todavía no confirmó');
      await tester.tap(find.text('Eliminar').last);
      await advance(tester, 400);
      expect(api.presetDeleted, 'p1');
    });

    testWidgets('el operador no ve los márgenes', (tester) async {
      await showScreen(
        tester,
        'calculadora_tipos_operador',
        const PresetsScreen(),
        me: operator,
        overrides: [
          calculadoraProvider.overrideWith((ref) async => _overview(admin: false)),
          calculadoraApiProvider.overrideWithValue(_FakeApi(admin: false)),
        ],
      );
      expect(find.text('Sin acceso'), findsOneWidget);
      expect(find.textContaining('Margen'), findsNothing);
    });
  });

  testWidgets('Calculadora: a 360dp y con letra grande no se desborda', (tester) async {
    final api = _FakeApi();
    await showScreen(
      tester,
      'calculadora_360',
      const AdminCalculadoraScreen(),
      width: 360,
      height: 1500,
      textScale: 1.4,
      me: admin,
      overrides: [
        calculadoraProvider.overrideWith((ref) async => _overview()),
        calculadoraApiProvider.overrideWithValue(api),
      ],
    );
    await _fill(tester, 'Gramos utilizados', '120');
    await advance(tester, 600);
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Historial (2)'));
    await advance(tester, 400);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Calculadora: un error del servidor se muestra con "Reintentar"', (tester) async {
    await showScreen(
      tester,
      'calculadora_error',
      const AdminCalculadoraScreen(),
      me: admin,
      overrides: [calculadoraProvider.overrideWith((ref) => throw ApiException('unavailable', 'No pudimos conectarnos.'))],
    );
    expect(find.text('Reintentar'), findsOneWidget);
    expect(find.text('No pudimos conectarnos.'), findsOneWidget);
  });

  testWidgets('Calculadora: sin permiso se muestra "Sin acceso"', (tester) async {
    await showScreen(
      tester,
      'calculadora_sin_acceso',
      const AdminCalculadoraScreen(),
      me: meWith(['calculadora'], role: 'operator', actions: {}),
    );
    expect(find.text('Sin acceso'), findsOneWidget);
  });
}
