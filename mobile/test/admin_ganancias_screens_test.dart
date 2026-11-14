import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/features/admin/ganancias/cost_settings_screen.dart';
import 'package:hefesto/features/admin/ganancias/ganancias_api.dart';
import 'package:hefesto/features/admin/ganancias/ganancias_models.dart';
import 'package:hefesto/features/admin/ganancias/ganancias_screen.dart';
import 'package:hefesto/features/admin/ganancias/shares_editor_screen.dart';

import 'analisis_test_kit.dart';

Map<String, dynamic> _row(String id, String title, num ingreso, num amort, {bool manual = false, String? customer}) => {
      'id': id,
      'orderNumber': title,
      'customerName': customer,
      'createdAt': '2026-10-2${id.length}T15:00:00.000Z',
      'ingreso': ingreso,
      'amort': amort,
      'gananciaPura': ingreso - amort,
      'grams': manual ? 0 : 320,
      'manual': manual,
      'split': [
        {'name': 'Ale Gómez', 'amount': (ingreso - amort) * 0.6},
        {'name': 'Beto', 'amount': (ingreso - amort) * 0.4},
      ],
    };

EarningsOverview _overview({bool balanced = true, String month = '2026-10', int rows = 3}) => EarningsOverview.fromJson({
      'settings': {'kwhPrice': 95, 'machineWatts': 220, 'machineLifeHours': 8000, 'maintenanceCost': 320000},
      'shares': [
        {'id': 'a1', 'name': 'Ale Gómez', 'role': 'Dueño', 'pct': 60},
        {'id': 'b2', 'name': 'Beto', 'role': null, 'pct': balanced ? 40 : 30},
      ],
      'sharesTotal': balanced ? 100 : 90,
      'totals': {'ingreso': 500000, 'amort': 150000, 'profit': 350000, 'grams': 4200, 'orders': rows, 'profitPct': 70},
      'months': [
        {'value': '2026-10', 'label': 'Octubre 2026'},
        {'value': '2026-09', 'label': 'Septiembre 2026'},
        {'value': '2026-08', 'label': 'Agosto 2026'},
      ],
      'selectedMonth': month,
      'payouts': [
        {'name': 'Ale Gómez', 'amount': 210000},
        {'name': 'Beto', 'amount': 140000},
      ],
      'rows': [
        for (var i = 0; i < rows; i++)
          _row('r$i', i == 1 ? 'Manual · 5 llaveros personalizados con nombre' : 'HF-004$i', 57500, 12000.5,
              manual: i == 1, customer: i == 1 ? null : 'Juan Pérez'),
      ],
      'rowsTotal': rows,
      'truncated': false,
    });

class _FakeApi implements GananciasApi {
  _FakeApi({this.fail});
  final String? fail;
  List<ShareDraft>? sharesSaved;
  List<String>? removedSent;
  CostSettings? costsSaved;
  int saveCalls = 0;

  @override
  Future<EarningsOverview> overview({String? month}) async => _overview();

  @override
  Future<List<ProfitShare>> saveShares(List<ShareDraft> shares, {List<String> removedIds = const []}) async {
    saveCalls++;
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

Finder _pctFields() => find.byType(TextFormField);
Finder _saveButton() => find.text('Guardar reparto');

bool _enabled(WidgetTester tester, String label) {
  final inkWell = find.ancestor(of: find.text(label), matching: find.byType(InkWell)).first;
  return tester.widget<InkWell>(inkWell).onTap != null;
}

void main() {
  setUpAll(analisisSetUp);

  final me = meWith(['ganancias']);

  testWidgets('Ganancias: KPIs, reparto, socios, costos y desglose', (tester) async {
    await showScreen(
      tester,
      'ganancias',
      const AdminGananciasScreen(),
      height: 2800,
      me: me,
      overrides: [gananciasProvider.overrideWith((ref, month) async => _overview())],
    );
    expect(find.text('Ingresos cobrados'), findsOneWidget);
    expect(find.text('\$500.000'), findsOneWidget);
    expect(find.text('Ganancia pura'), findsOneWidget);
    expect(find.text('70% del ingreso'), findsOneWidget);
    expect(find.text('A cobrar por persona'), findsOneWidget);
    expect(find.text('\$210.000'), findsOneWidget);
    expect(find.text('Socios y porcentajes'), findsOneWidget);
    expect(find.text('Suma 100%'), findsOneWidget);
    expect(find.text('Editar reparto'), findsOneWidget);
    expect(find.text('Editar costos'), findsOneWidget);
    expect(find.text('Configuración de costos'), findsOneWidget);
    expect(find.text('\$95,00'), findsOneWidget);
    expect(find.text('HF-0040'), findsOneWidget);
    expect(find.text('Manual'), findsOneWidget);
    expect(find.text('Oct 2026'), findsOneWidget);
    expect(find.text('Todos'), findsOneWidget);
  });

  testWidgets('Ganancias: elegir un mes pide ese mes al servidor', (tester) async {
    final asked = <String?>[];
    await showScreen(
      tester,
      'ganancias_mes',
      const AdminGananciasScreen(),
      height: 1400,
      me: me,
      overrides: [
        gananciasProvider.overrideWith((ref, month) async {
          asked.add(month);
          return _overview(month: month ?? '2026-10');
        }),
      ],
    );
    expect(asked, [null]);
    await tester.tap(find.widgetWithText(ChoiceChip, 'Sep 2026'));
    await advance(tester, 300);
    expect(asked.last, '2026-09');
    await tester.tap(find.widgetWithText(ChoiceChip, 'Todos'));
    await advance(tester, 300);
    expect(asked.last, 'all');
  });

  testWidgets('Ganancias: sin permiso de editar no aparecen los botones de edición', (tester) async {
    await showScreen(
      tester,
      'ganancias_solo_lectura',
      const AdminGananciasScreen(),
      height: 2600,
      me: meWith(['ganancias'], role: 'operator', actions: {'ver'}),
      overrides: [gananciasProvider.overrideWith((ref, month) async => _overview())],
    );
    expect(find.text('Editar reparto'), findsNothing);
    expect(find.text('Editar costos'), findsNothing);
    expect(find.textContaining('Solo lectura'), findsOneWidget);
  });

  testWidgets('Ganancias: si el reparto no suma 100% lo avisa', (tester) async {
    await showScreen(
      tester,
      'ganancias_desbalanceado',
      const AdminGananciasScreen(),
      height: 2600,
      me: me,
      overrides: [gananciasProvider.overrideWith((ref, month) async => _overview(balanced: false))],
    );
    expect(find.text('Suma 90%'), findsOneWidget);
    expect(find.textContaining('no suma 100%'), findsOneWidget);
  });

  testWidgets('Ganancias: más de 25 ventas se muestran de a poco', (tester) async {
    await showScreen(
      tester,
      'ganancias_muchas',
      const AdminGananciasScreen(),
      height: 3200,
      me: me,
      overrides: [gananciasProvider.overrideWith((ref, month) async => _overview(rows: 40))],
    );
    expect(find.textContaining('Ver más (15 restantes)'), findsOneWidget);
  });

  testWidgets('Ganancias: sin ventas ni socios', (tester) async {
    await showScreen(
      tester,
      'ganancias_vacio',
      const AdminGananciasScreen(),
      height: 1800,
      me: me,
      overrides: [
        gananciasProvider.overrideWith((ref, month) async => EarningsOverview.fromJson({'selectedMonth': 'all'})),
      ],
    );
    expect(find.text('Sin ventas cobradas'), findsOneWidget);
    expect(find.text('Agregá socios o cargá ventas para ver el reparto.'), findsOneWidget);
    expect(find.text('Todavía no hay socios cargados.'), findsOneWidget);
  });

  testWidgets('Ganancias: a 360dp de ancho y con letra grande no se desborda', (tester) async {
    await showScreen(
      tester,
      'ganancias_360',
      const AdminGananciasScreen(),
      width: 360,
      height: 3800,
      textScale: 1.4,
      me: me,
      overrides: [gananciasProvider.overrideWith((ref, month) async => _overview())],
    );
    expect(find.text('Ingresos cobrados'), findsOneWidget);
  });

  testWidgets('Ganancias: un error del servidor se muestra con "Reintentar"', (tester) async {
    await showScreen(
      tester,
      'ganancias_error',
      const AdminGananciasScreen(),
      me: me,
      overrides: [gananciasProvider.overrideWith((ref, month) => throw Exception('boom'))],
    );
    expect(find.text('Reintentar'), findsOneWidget);
  });

  group('editor de socios', () {
    testWidgets('sin cambios no se puede guardar', (tester) async {
      final api = _FakeApi();
      await showScreen(
        tester,
        'socios',
        SharesEditorScreen(overview: _overview()),
        height: 1200,
        me: me,
        overrides: [gananciasApiProvider.overrideWithValue(api)],
      );
      expect(find.text('Suma 100%'), findsOneWidget);
      expect(_pctFields(), findsNWidgets(2));
      expect(_enabled(tester, 'Guardar reparto'), isFalse);
    });

    testWidgets('si no suma 100% avisa y no deja guardar; al cerrar el 100% guarda todo junto', (tester) async {
      final api = _FakeApi();
      await showScreen(
        tester,
        'socios_edicion',
        SharesEditorScreen(overview: _overview()),
        height: 1200,
        me: me,
        overrides: [gananciasApiProvider.overrideWithValue(api)],
      );
      await tester.enterText(_pctFields().at(0), '70');
      await tester.pump();
      expect(find.text('Suma 110%'), findsOneWidget);
      expect(find.textContaining('Tiene que sumar 100%'), findsOneWidget);
      expect(_enabled(tester, 'Guardar reparto'), isFalse);

      await tester.enterText(_pctFields().at(1), '30');
      await tester.pump();
      expect(find.text('Suma 100%'), findsOneWidget);
      expect(_enabled(tester, 'Guardar reparto'), isTrue);
      // "Le toca" se recalcula con el % tipeado: 70% de $350.000.
      expect(find.text('\$245.000'), findsOneWidget);

      await tester.tap(_saveButton());
      await advance(tester, 300);
      expect(api.saveCalls, 1);
      final sent = api.sharesSaved!;
      expect(sent.map((s) => s.id), ['a1', 'b2']);
      expect(sent.map((s) => s.pct), [70, 30]);
      expect(api.removedSent, isEmpty);
    });

    testWidgets('acepta coma decimal argentina', (tester) async {
      final api = _FakeApi();
      await showScreen(
        tester,
        'socios_coma',
        SharesEditorScreen(overview: _overview()),
        height: 1200,
        me: me,
        overrides: [gananciasApiProvider.overrideWithValue(api)],
      );
      await tester.enterText(_pctFields().at(0), '62,5');
      await tester.enterText(_pctFields().at(1), '37,5');
      await tester.pump();
      expect(find.text('Suma 100%'), findsOneWidget);
      await tester.tap(_saveButton());
      await advance(tester, 300);
      expect(api.sharesSaved!.map((s) => s.pct), [62.5, 37.5]);
    });

    testWidgets('un porcentaje inválido bloquea el guardado', (tester) async {
      final api = _FakeApi();
      await showScreen(
        tester,
        'socios_invalido',
        SharesEditorScreen(overview: _overview()),
        height: 1200,
        me: me,
        overrides: [gananciasApiProvider.overrideWithValue(api)],
      );
      await tester.enterText(_pctFields().at(0), '150');
      await tester.pump();
      expect(find.text('Máximo 100.'), findsOneWidget);
      expect(_enabled(tester, 'Guardar reparto'), isFalse);
    });

    testWidgets('agregar un socio e igualar al 100%', (tester) async {
      final api = _FakeApi();
      await showScreen(
        tester,
        'socios_agregar',
        SharesEditorScreen(overview: _overview()),
        height: 1700,
        me: me,
        overrides: [gananciasApiProvider.overrideWithValue(api)],
      );
      await tester.tap(find.text('Agregar socio'));
      await tester.pump();
      expect(_pctFields(), findsNWidgets(3));
      expect(find.textContaining('Poné un nombre a cada socio'), findsOneWidget);
      await tester.tap(find.text('Igualar al 100%'));
      await tester.pump();
      expect(find.text('Suma 100%'), findsOneWidget);
      expect(find.text('33,33'), findsNWidgets(2));
      expect(find.text('33,34'), findsOneWidget);
      // Con un socio sin nombre todavía no se puede guardar.
      expect(_enabled(tester, 'Guardar reparto'), isFalse);
      await tester.enterText(find.widgetWithText(TextField, 'Nombre').at(2), 'Caro');
      await tester.pump();
      expect(_enabled(tester, 'Guardar reparto'), isTrue);
      await tester.tap(_saveButton());
      await advance(tester, 300);
      final sent = api.sharesSaved!;
      expect(sent, hasLength(3));
      expect(sent.last.id, isNull, reason: 'el socio nuevo va sin id');
      expect(sent.last.name, 'Caro');
    });

    testWidgets('quitar un socio pide confirmación y manda su id', (tester) async {
      final api = _FakeApi();
      await showScreen(
        tester,
        'socios_quitar',
        SharesEditorScreen(overview: _overview()),
        height: 1200,
        me: me,
        overrides: [gananciasApiProvider.overrideWithValue(api)],
      );
      await tester.tap(find.byTooltip('Quitar socio').last);
      await tester.pump();
      expect(_pctFields(), findsNWidgets(1));
      await tester.enterText(_pctFields().at(0), '100');
      await tester.pump();
      expect(_enabled(tester, 'Guardar reparto'), isTrue);
      await tester.tap(_saveButton());
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Quitar del reparto'), findsOneWidget);
      expect(find.textContaining('Beto'), findsWidgets);
      await tester.tap(find.text('Guardar').last);
      await advance(tester, 300);
      expect(api.removedSent, ['b2']);
      expect(api.sharesSaved!.single.pct, 100);
    });

    testWidgets('con un solo socio no se puede quitar', (tester) async {
      await showScreen(
        tester,
        'socios_uno',
        SharesEditorScreen(
          overview: EarningsOverview.fromJson({
            'shares': [
              {'id': 'a1', 'name': 'Ale', 'pct': 100},
            ],
          }),
        ),
        me: me,
        overrides: [gananciasApiProvider.overrideWithValue(_FakeApi())],
      );
      final btn = tester.widget<IconButton>(find.widgetWithIcon(IconButton, Icons.delete_outline_rounded));
      expect(btn.onPressed, isNull);
    });

    testWidgets('el error del servidor se muestra en línea', (tester) async {
      final api = _FakeApi(fail: 'Los socios cambiaron desde otro dispositivo. Actualizá la pantalla y volvé a intentar.');
      await showScreen(
        tester,
        'socios_error',
        SharesEditorScreen(overview: _overview()),
        height: 1200,
        me: me,
        overrides: [gananciasApiProvider.overrideWithValue(api)],
      );
      await tester.enterText(_pctFields().at(0), '70');
      await tester.enterText(_pctFields().at(1), '30');
      await tester.pump();
      await tester.tap(_saveButton());
      await advance(tester, 300);
      expect(find.textContaining('cambiaron desde otro dispositivo'), findsOneWidget);
    });
  });

  group('costos de producción', () {
    const settings = CostSettings(kwhPrice: 95, machineWatts: 220, machineLifeHours: 8000, maintenanceCost: 320000);

    testWidgets('se ven los valores con formato argentino y no guarda sin cambios', (tester) async {
      await showScreen(
        tester,
        'costos',
        const CostSettingsScreen(settings: settings),
        me: me,
        overrides: [gananciasApiProvider.overrideWithValue(_FakeApi())],
      );
      expect(find.text('95'), findsOneWidget);
      expect(find.text('8.000'), findsOneWidget);
      expect(find.text('320.000'), findsOneWidget);
      expect(_enabled(tester, 'Guardar'), isFalse);
    });

    testWidgets('edita, valida y guarda', (tester) async {
      final api = _FakeApi();
      await showScreen(
        tester,
        'costos_edicion',
        const CostSettingsScreen(settings: settings),
        me: me,
        overrides: [gananciasApiProvider.overrideWithValue(api)],
      );
      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), '120,5');
      await tester.enterText(fields.at(2), '0');
      await tester.pump();
      expect(find.text('Mínimo 1.'), findsOneWidget, reason: 'la vida útil no puede ser 0');
      expect(_enabled(tester, 'Guardar'), isFalse);
      await tester.enterText(fields.at(2), '10.000');
      await tester.pump();
      expect(_enabled(tester, 'Guardar'), isTrue);
      await tester.tap(find.text('Guardar'));
      await advance(tester, 300);
      expect(api.costsSaved, const CostSettings(kwhPrice: 120.5, machineWatts: 220, machineLifeHours: 10000, maintenanceCost: 320000));
    });
  });
}
