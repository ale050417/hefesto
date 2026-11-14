import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/reportes/reportes_models.dart';

/// Lo que devuelve `GET /api/v1/admin/reportes?year=2026` (forma real del servidor).
Map<String, dynamic> _overviewJson() => {
      'year': 2026,
      'prevYear': 2025,
      'years': [2026, 2025, 2024],
      'kpis': {'revenue': 1250000, 'salesCount': 48, 'unitsSold': 130, 'newCustomers': 12, 'avgTicket': 26042},
      'monthsCurrent': [100000, 120000, 90000, 150000, 110000, 130000, 140000, 125000, 135000, 150000, 0, 0],
      'monthsPrev': [80000, 90000, 85000, 100000, 95000, 105000, 110000, 100000, 120000, 130000, 140000, 160000],
      'yoy': {'asOfMonth': 10, 'current': 1250000, 'prevSamePeriod': 1015000, 'deltaPct': 23.2},
      'categoryBreakdown': [
        {'name': 'Mates', 'revenue': 600000},
        {'name': 'Sin categoria', 'revenue': 50000.5},
      ],
      'topProducts': [
        {'name': 'Mate Mario', 'qty': 40, 'revenue': 500000},
        {'name': 'Cartel Personalizado', 'qty': 22, 'revenue': 330000},
      ],
      'bySource': {
        'storefront': {'revenue': 900000, 'count': 30, 'pct': 72},
        'manual': {'revenue': 350000, 'count': 18, 'pct': 28},
      },
      'consumption': [
        {'material': 'PLA', 'color': 'Rojo', 'grams': 3200, 'cost': 64000, 'source': 'ventas'},
        {'material': 'PLA', 'color': 'Negro', 'grams': 150.5, 'cost': 3010, 'source': 'fallas'},
      ],
      'consumptionTotals': {'grams': 3350.5, 'cost': 67010},
    };

void main() {
  group('ReportsOverview.fromJson', () {
    test('parsea el payload completo del servidor', () {
      final o = ReportsOverview.fromJson(_overviewJson());
      expect(o.year, 2026);
      expect(o.prevYear, 2025);
      expect(o.years, [2026, 2025, 2024]);
      expect(o.kpis.revenue, 1250000);
      expect(o.kpis.salesCount, 48);
      expect(o.kpis.avgTicket, 26042);
      expect(o.monthsCurrent, hasLength(12));
      expect(o.monthsCurrent[9], 150000);
      expect(o.monthsPrev[11], 160000);
      expect(o.yoy.asOfMonth, 10);
      expect(o.yoy.deltaPct, 23.2);
      expect(o.categories.map((c) => c.name), ['Mates', 'Sin categoria']);
      expect(o.categories[1].revenue, 50000.5);
      expect(o.topProducts.first.name, 'Mate Mario');
      expect(o.topProducts.first.qty, 40);
      expect(o.storefront.pct, 72);
      expect(o.manual.count, 18);
      expect(o.consumption, hasLength(2));
      expect(o.consumption[0].isFailure, isFalse);
      expect(o.consumption[1].isFailure, isTrue);
      expect(o.consumptionGrams, 3350.5);
      expect(o.hasSales, isTrue);
    });

    test('los numeric de Postgres pueden llegar como String', () {
      final j = _overviewJson();
      j['kpis'] = {'revenue': '1250000.50', 'salesCount': '48', 'unitsSold': '130', 'newCustomers': '12', 'avgTicket': '26042'};
      j['monthsCurrent'] = ['100.5', '200', null];
      final o = ReportsOverview.fromJson(j);
      expect(o.kpis.revenue, 1250000.5);
      expect(o.kpis.salesCount, 48);
      expect(o.monthsCurrent.sublist(0, 4), [100.5, 200, 0, 0]);
      expect(o.monthsCurrent, hasLength(12), reason: 'siempre 12 meses');
    });

    test('un JSON vacío o con nulls no rompe (año sin ventas)', () {
      final o = ReportsOverview.fromJson({'year': 2027});
      expect(o.year, 2027);
      expect(o.prevYear, 2026);
      expect(o.years, [2027, 2026], reason: 'si no vienen años, el actual y el anterior');
      expect(o.kpis.revenue, 0);
      expect(o.monthsCurrent, everyElement(0));
      expect(o.categories, isEmpty);
      expect(o.topProducts, isEmpty);
      expect(o.consumption, isEmpty);
      expect(o.yoy.deltaPct, isNull);
      expect(o.hasSales, isFalse);
    });

    test('ignora basura en las listas y campos desconocidos', () {
      final j = _overviewJson();
      j['topProducts'] = [null, 'x', {'name': null, 'qty': 'abc', 'revenue': null}];
      j['campoNuevo'] = {'a': 1};
      final o = ReportsOverview.fromJson(j);
      expect(o.topProducts, hasLength(1));
      expect(o.topProducts.single.name, 'Sin nombre');
      expect(o.topProducts.single.qty, 0);
    });

    test('un nombre de categoría vacío no deja un hueco', () {
      final j = _overviewJson();
      j['categoryBreakdown'] = [
        {'name': '  ', 'revenue': 10},
      ];
      expect(ReportsOverview.fromJson(j).categories.single.name, 'Sin categoría');
    });
  });

  group('DailySeries.fromJson', () {
    test('serie diaria con mejor día', () {
      final s = DailySeries.fromJson({
        'days': 7,
        'points': [
          for (var i = 1; i <= 7; i++) {'date': '2026-10-0$i', 'total': i * 1000},
        ],
        'total': 28000,
        'average': 4000,
        'best': {'date': '2026-10-07', 'total': 7000},
      });
      expect(s.days, 7);
      expect(s.points, hasLength(7));
      expect(s.points.first.date.day, 1);
      expect(s.points.last.total, 7000);
      expect(s.total, 28000);
      expect(s.best?.total, 7000);
    });

    test('sin ventas no hay mejor día', () {
      final s = DailySeries.fromJson({
        'days': 30,
        'points': [
          {'date': '2026-10-31', 'total': 0},
        ],
        'total': 0,
        'average': 0,
        'best': null,
      });
      expect(s.best, isNull);
      expect(s.average, 0);
    });
  });

  test('CsvExport.fromJson', () {
    final e = CsvExport.fromJson({'csv': 'Pedido,Estado,Total,Fecha\n"HF-1","confirmed","1000","2026-10-01"', 'rows': 1, 'days': 365});
    expect(e.rows, 1);
    expect(e.csv, startsWith('Pedido,Estado'));
    expect(CsvExport.fromJson({}).csv, '');
  });
}
