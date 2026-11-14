import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:hefesto/features/admin/reportes/reportes_api.dart';
import 'package:hefesto/features/admin/reportes/reportes_models.dart';
import 'package:hefesto/features/admin/reportes/reportes_screen.dart';
import 'package:hefesto/features/admin/reportes/reportes_sections.dart' show formatGrams;

import 'analisis_test_kit.dart';

ReportsOverview _overview({int year = 2026, bool empty = false}) => ReportsOverview.fromJson({
      'year': year,
      'prevYear': year - 1,
      'years': [2026, 2025, 2024],
      'kpis': empty
          ? {}
          : {'revenue': 1250000, 'salesCount': 48, 'unitsSold': 130, 'newCustomers': 12, 'avgTicket': 26042},
      'monthsCurrent': empty ? [] : [100000, 120000, 90000, 150000, 110000, 130000, 140000, 125000, 135000, 150000, 0, 0],
      'monthsPrev': empty ? [] : [80000, 90000, 85000, 100000, 95000, 105000, 110000, 100000, 120000, 130000, 140000, 160000],
      'yoy': empty
          ? {}
          : {'asOfMonth': 10, 'current': 1250000, 'prevSamePeriod': 1015000, 'deltaPct': 23.2},
      'categoryBreakdown': empty
          ? []
          : [
              {'name': 'Mates', 'revenue': 600000},
              {'name': 'Carteles', 'revenue': 330000},
              {'name': 'Llaveros', 'revenue': 120000},
              {'name': 'Figuras', 'revenue': 80000},
              {'name': 'Macetas', 'revenue': 40000},
              {'name': 'Sin categoria', 'revenue': 20000},
              {'name': 'Otros', 'revenue': 10000},
            ],
      'topProducts': empty
          ? []
          : [
              {'name': 'Mate Mario', 'qty': 40, 'revenue': 500000},
              {'name': 'Cartel Personalizado con un nombre bastante largo para probar el recorte', 'qty': 22, 'revenue': 330000},
              {'name': 'Llavero Hefesto', 'qty': 15, 'revenue': 45000},
            ],
      'bySource': {
        'storefront': {'revenue': empty ? 0 : 900000, 'count': empty ? 0 : 30, 'pct': empty ? 0 : 72},
        'manual': {'revenue': empty ? 0 : 350000, 'count': empty ? 0 : 18, 'pct': empty ? 0 : 28},
      },
      'consumption': empty
          ? []
          : [
              for (var i = 0; i < 8; i++)
                {'material': 'PLA', 'color': 'Color $i', 'grams': 3200 - i * 300, 'cost': 64000 - i * 6000, 'source': i == 3 ? 'fallas' : 'ventas'},
            ],
      'consumptionTotals': empty ? {} : {'grams': 17600, 'cost': 352000},
    });

DailySeries _daily(int days) => DailySeries.fromJson({
      'days': days,
      'points': [
        for (var i = days - 1; i >= 0; i--)
          {
            'date': DateTime(2026, 10, 31).subtract(Duration(days: i)).toIso8601String().substring(0, 10),
            'total': (i * 7919) % 5 == 0 ? 0 : 8000 + ((i * 7919) % 40) * 1500,
          },
      ],
      'total': days * 20000,
      'average': 20000,
      'best': {'date': '2026-10-20', 'total': 61500},
    });

void main() {
  setUpAll(analisisSetUp);

  final me = meWith(['reportes']);

  test('formatGrams: gramos con coma decimal y kg a partir de 1000', () {
    expect(formatGrams(0), '0 g');
    expect(formatGrams(120.5), '120,5 g');
    expect(formatGrams(320), '320 g');
    expect(formatGrams(3200), '3,2 kg');
    expect(formatGrams(17600), '17,6 kg');
    expect(formatGrams(1250), '1,25 kg');
  });

  testWidgets('Reportes: tarjetas, gráficos y rankings', (tester) async {
    await showScreen(
      tester,
      'reportes',
      const AdminReportesScreen(),
      height: 3600,
      me: me,
      overrides: [
        reportesOverviewProvider.overrideWith((ref, year) async => _overview()),
        reportesDailyProvider.overrideWith((ref, days) async => _daily(days)),
      ],
    );
    expect(find.text('Facturación 2026'), findsOneWidget);
    expect(find.text('Ticket promedio'), findsOneWidget);
    expect(find.text('\$1.250.000'), findsWidgets, reason: 'KPI y tarjeta año contra año');
    expect(find.text('\$26.042'), findsOneWidget);
    expect(find.text('2026 contra 2025'), findsOneWidget);
    expect(find.text('+23,2%'), findsOneWidget);
    expect(find.text('Ventas por mes'), findsOneWidget);
    expect(find.text('Ventas por día'), findsOneWidget);
    expect(find.textContaining('Ventas por origen'), findsOneWidget);
    expect(find.text('Tienda online'), findsOneWidget);
    expect(find.text('Ventas por categoría'), findsOneWidget);
    expect(find.text('Mate Mario'), findsOneWidget);
    expect(find.textContaining('Cartel Personalizado'), findsOneWidget);
    expect(find.textContaining('Consumo de filamento'), findsOneWidget);
    // Consumo colapsado: 6 de 8, con "Ver todos".
    expect(find.text('Ver todos (8)'), findsOneWidget);
  });

  testWidgets('Reportes: cambiar de año pide ese año al servidor', (tester) async {
    final asked = <int?>[];
    await showScreen(
      tester,
      'reportes_anio',
      const AdminReportesScreen(),
      height: 1800,
      me: me,
      overrides: [
        reportesOverviewProvider.overrideWith((ref, year) async {
          asked.add(year);
          return _overview(year: year ?? 2026);
        }),
        reportesDailyProvider.overrideWith((ref, days) async => _daily(days)),
      ],
    );
    expect(asked, [null], reason: 'la primera vez el servidor elige el año en curso');
    await tester.tap(find.widgetWithText(ChoiceChip, '2025'));
    await advance(tester, 300);
    expect(asked.last, 2025);
    expect(find.text('Facturación 2025'), findsOneWidget);
  });

  testWidgets('Reportes: el selector de rango de días pide 7, 30 o 90', (tester) async {
    final asked = <int>[];
    await showScreen(
      tester,
      'reportes_rango',
      const AdminReportesScreen(),
      height: 2200,
      me: me,
      overrides: [
        reportesOverviewProvider.overrideWith((ref, year) async => _overview()),
        reportesDailyProvider.overrideWith((ref, days) async {
          asked.add(days);
          return _daily(days);
        }),
      ],
    );
    expect(asked, [30]);
    await tester.ensureVisible(find.widgetWithText(ChoiceChip, '7 días'));
    await tester.tap(find.widgetWithText(ChoiceChip, '7 días'));
    await advance(tester, 300);
    await tester.ensureVisible(find.widgetWithText(ChoiceChip, '90 días'));
    await tester.tap(find.widgetWithText(ChoiceChip, '90 días'));
    await advance(tester, 300);
    expect(asked, [30, 7, 90]);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Reportes: sin ventas se ve prolijo (estados vacíos)', (tester) async {
    await showScreen(
      tester,
      'reportes_vacio',
      const AdminReportesScreen(),
      height: 3400,
      me: me,
      overrides: [
        reportesOverviewProvider.overrideWith((ref, year) async => _overview(empty: true)),
        reportesDailyProvider.overrideWith((ref, days) async => DailySeries.fromJson({'days': days, 'points': []})),
      ],
    );
    expect(find.text('Todavía no hay ventas para graficar.'), findsOneWidget);
    expect(find.text('Sin ventas por categoría todavía.'), findsOneWidget);
    expect(find.text('Sin ventas en el período.'), findsOneWidget);
    expect(find.text('Todavía no hay consumo registrado este año.'), findsOneWidget);
  });

  testWidgets('Reportes: a 360dp de ancho y con letra grande no se desborda', (tester) async {
    await showScreen(
      tester,
      'reportes_360',
      const AdminReportesScreen(),
      width: 360,
      height: 4200,
      textScale: 1.4,
      me: me,
      overrides: [
        reportesOverviewProvider.overrideWith((ref, year) async => _overview()),
        reportesDailyProvider.overrideWith((ref, days) async => _daily(days)),
      ],
    );
    expect(find.text('Facturación 2026'), findsOneWidget);
  });

  for (final mode in [HefestoThemeMode.light, HefestoThemeMode.warm]) {
    testWidgets('Reportes en tema ${mode.name}', (tester) async {
      await showScreen(
        tester,
        'reportes_${mode.name}',
        const AdminReportesScreen(),
        height: 1700,
        theme: mode,
        me: me,
        overrides: [
          reportesOverviewProvider.overrideWith((ref, year) async => _overview()),
          reportesDailyProvider.overrideWith((ref, days) async => _daily(days)),
        ],
      );
      expect(find.text('Facturación 2026'), findsOneWidget);
    });
  }

  testWidgets('Reportes: un error del servidor se muestra con "Reintentar"', (tester) async {
    await showScreen(
      tester,
      'reportes_error',
      const AdminReportesScreen(),
      me: me,
      overrides: [
        reportesOverviewProvider.overrideWith((ref, year) => throw Exception('boom')),
      ],
    );
    expect(find.text('Reintentar'), findsOneWidget);
  });

  testWidgets('Reportes: sin permiso se muestra "Sin acceso"', (tester) async {
    await showScreen(
      tester,
      'reportes_sin_acceso',
      const AdminReportesScreen(),
      me: meWith(['reportes'], role: 'operator', actions: {}),
    );
    expect(find.text('Sin acceso'), findsOneWidget);
  });
}
