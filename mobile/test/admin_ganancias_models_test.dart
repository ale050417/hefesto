import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/ganancias/ganancias_api.dart';
import 'package:hefesto/features/admin/ganancias/ganancias_models.dart';
import 'package:hefesto/features/admin/ganancias/shares_logic.dart';

/// Lo que devuelve `GET /api/v1/admin/ganancias?mes=2026-10` (forma real del servidor).
Map<String, dynamic> _json() => {
      'settings': {'kwhPrice': 95, 'machineWatts': 220, 'machineLifeHours': 8000, 'maintenanceCost': 320000},
      'shares': [
        {'id': 'a1', 'name': 'Ale', 'role': 'Dueño', 'pct': 60},
        {'id': 'b2', 'name': 'Beto', 'role': null, 'pct': '40.00'},
      ],
      'sharesTotal': 100,
      'totals': {'ingreso': 500000, 'amort': 150000, 'profit': 350000, 'grams': 4200, 'orders': 3, 'profitPct': 70},
      'months': [
        {'value': '2026-10', 'label': 'Octubre 2026'},
        {'value': '2026-09', 'label': 'Septiembre 2026'},
      ],
      'selectedMonth': '2026-10',
      'payouts': [
        {'name': 'Ale', 'amount': 210000},
        {'name': 'Beto', 'amount': 140000},
      ],
      'rows': [
        {
          'id': 'r1',
          'orderNumber': 'HF-0042',
          'customerName': 'Juan Pérez',
          'createdAt': '2026-10-30T15:00:00.000Z',
          'ingreso': 57500,
          'amort': 12000.5,
          'gananciaPura': 45499.5,
          'grams': 320,
          'manual': false,
          'split': [
            {'name': 'Ale', 'amount': 27299.7},
            {'name': 'Beto', 'amount': 18199.8},
          ],
        },
        {
          'id': 'r2',
          'orderNumber': 'Manual · 5 llaveros',
          'customerName': null,
          'createdAt': '2026-10-29T12:00:00.000Z',
          'ingreso': 10000,
          'amort': 2000,
          'gananciaPura': 8000,
          'grams': 0,
          'manual': true,
          'split': <dynamic>[],
        },
      ],
      'rowsTotal': 3,
      'truncated': true,
    };

void main() {
  group('EarningsOverview.fromJson', () {
    test('parsea el payload completo del servidor', () {
      final o = EarningsOverview.fromJson(_json());
      expect(o.settings.kwhPrice, 95);
      expect(o.settings.machineLifeHours, 8000);
      expect(o.shares, hasLength(2));
      expect(o.shares[0].role, 'Dueño');
      expect(o.shares[1].role, isNull);
      expect(o.shares[1].pct, 40, reason: 'numeric como String');
      expect(o.sharesTotal, 100);
      expect(o.totals.profit, 350000);
      expect(o.totals.profitPct, 70);
      expect(o.totals.orders, 3);
      expect(o.months.first.shortLabel, 'Oct 2026');
      expect(o.months.last.shortLabel, 'Sep 2026');
      expect(o.selectedMonth, '2026-10');
      expect(o.isAll, isFalse);
      expect(o.selectedLabel, 'Octubre 2026');
      expect(o.payouts.map((p) => p.amount), [210000, 140000]);
      expect(o.rows, hasLength(2));
      expect(o.rows[0].title, 'HF-0042');
      expect(o.rows[0].split.first.amount, 27299.7);
      expect(o.rows[1].manual, isTrue);
      expect(o.rows[1].customer, isNull);
      expect(o.rows[1].split, isEmpty);
      expect(o.truncated, isTrue);
      expect(o.rowsTotal, 3);
    });

    test('mes "all" y sin datos', () {
      final o = EarningsOverview.fromJson({'selectedMonth': 'all'});
      expect(o.isAll, isTrue);
      expect(o.selectedLabel, isNull);
      expect(o.rows, isEmpty);
      expect(o.shares, isEmpty);
      expect(o.sharesTotal, 0);
      expect(o.totals.ingreso, 0);
      expect(o.settings.machineLifeHours, 1, reason: 'nunca 0 (evita dividir por cero)');
    });

    test('sin sharesTotal lo calcula de los socios', () {
      final j = _json()..remove('sharesTotal');
      expect(EarningsOverview.fromJson(j).sharesTotal, 100);
    });
  });

  group('CostSettings', () {
    test('toJson manda lo que valida el servidor y la igualdad es por valor', () {
      const a = CostSettings(kwhPrice: 95.5, machineWatts: 220, machineLifeHours: 8000, maintenanceCost: 320000);
      expect(a.toJson(), {
        'kwhPrice': 95.5,
        'machineWatts': 220,
        'machineLifeHours': 8000,
        'maintenanceCost': 320000,
      });
      expect(a, const CostSettings(kwhPrice: 95.5, machineWatts: 220, machineLifeHours: 8000, maintenanceCost: 320000));
      expect(a == const CostSettings(kwhPrice: 96, machineWatts: 220, machineLifeHours: 8000, maintenanceCost: 320000), isFalse);
    });
  });

  test('ShareDraft.toJson: los socios nuevos van sin id', () {
    expect(const ShareDraft(id: 'a1', name: 'Ale', role: 'Dueño', pct: 60).toJson(), {
      'id': 'a1',
      'name': 'Ale',
      'role': 'Dueño',
      'pct': 60,
    });
    expect(const ShareDraft(name: 'Caro', pct: 40).toJson().containsKey('id'), isFalse);
  });

  group('reglas del reparto (mismas que la web y el servidor)', () {
    test('suma 100% redondeada', () {
      expect(isBalanced(100), isTrue);
      expect(isBalanced(99.99), isTrue);
      expect(isBalanced(100.4), isTrue);
      expect(isBalanced(100.5), isFalse);
      expect(isBalanced(99.4), isFalse);
      expect(isBalanced(0), isFalse);
      expect(isBalanced(160), isFalse);
    });

    test('igualar al 100%: el último se queda con el resto', () {
      expect(equalSplit(1), [100]);
      expect(equalSplit(2), [50, 50]);
      expect(equalSplit(3), [33.33, 33.33, 33.34]);
      expect(equalSplit(0), isEmpty);
      for (var n = 1; n <= 20; n++) {
        final parts = equalSplit(n);
        expect(parts.fold(0.0, (a, b) => a + b), closeTo(100, 0.0001), reason: 'n=$n');
        expect(isBalanced(parts.fold(0.0, (a, b) => a + b)), isTrue);
      }
    });

    test('cuánto le toca a cada socio', () {
      expect(shareAmount(350000, 60), 210000);
      expect(shareAmount(350000, 33.33), closeTo(116655, 0.01));
      expect(shareAmount(-500, 50), 0, reason: 'sin ganancia no hay reparto');
    });

    test('texto de la suma', () {
      expect(sharesTotalLabel(100), 'Suma 100%');
      expect(sharesTotalLabel(99.5), 'Suma 99,5%');
    });

    test('detecta cambios (altas, bajas, nombre, rol y porcentaje)', () {
      const orig = [
        ShareValues(id: 'a', name: 'Ale', role: '', pct: 60),
        ShareValues(id: 'b', name: 'Beto', role: 'Diseño', pct: 40),
      ];
      expect(sharesChanged(orig, List.of(orig), removed: 0), isFalse);
      expect(sharesChanged(orig, List.of(orig), removed: 1), isTrue);
      expect(sharesChanged(orig, [orig[0]], removed: 0), isTrue);
      expect(
        sharesChanged(orig, [orig[0], const ShareValues(id: 'b', name: 'Beto', role: 'Diseño', pct: 45)], removed: 0),
        isTrue,
      );
      expect(
        sharesChanged(orig, [orig[0], const ShareValues(id: 'b', name: ' Beto ', role: 'Diseño', pct: 40)], removed: 0),
        isFalse,
        reason: 'los espacios no cuentan',
      );
      expect(
        sharesChanged(orig, [orig[0], const ShareValues(name: 'Caro', role: '', pct: 40)], removed: 0),
        isTrue,
        reason: 'un socio sin id es nuevo',
      );
    });
  });
}
