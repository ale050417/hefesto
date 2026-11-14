import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/filamentos/filamentos_format.dart';
import 'package:hefesto/features/admin/produccion/produccion_models.dart';
import 'package:hefesto/features/admin/sale_status.dart';

/// JSON con la forma real de `GET /api/v1/admin/produccion`.
Map<String, dynamic> boardJson() => {
      'columns': [
        {'status': 'pending_payment', 'label': 'Pendiente de pago', 'count': 1},
        {'status': 'in_production', 'label': 'En producción', 'count': 1},
      ],
      'items': [
        {
          'id': 'o1',
          'source': 'online',
          'label': 'Mate Mario ×2 · Cartel',
          'customerName': 'Juan Pérez',
          'total': 57500,
          'status': 'in_production',
          'createdAt': '2026-10-29T10:00:00.000Z',
          'ageHours': 50,
          'late': true,
        },
        {
          'id': 'm1',
          'source': 'manual',
          'label': '5 llaveros',
          'customerName': 'Feria',
          'total': 10000,
          'status': 'pending_payment',
          'createdAt': '2026-10-31T10:00:00.000Z',
          'ageHours': 2,
          'late': false,
        },
        {
          'id': 'o2',
          'source': 'online',
          'label': 'Figura',
          'customerName': null,
          'total': '4500.00',
          'status': 'ready',
          'createdAt': '2026-10-30T10:00:00.000Z',
          'ageHours': 26,
          'late': false,
        },
      ],
      'counts': {'total': 3, 'online': 2, 'manual': 1, 'late': 1},
      'degraded': <String>[],
    };

void main() {
  group('BoardData.fromJson', () {
    final d = BoardData.fromJson(boardJson());

    test('lee las tarjetas', () {
      expect(d.items, hasLength(3));
      final c = d.items.first;
      expect(c.id, 'o1');
      expect(c.source, 'online');
      expect(c.isManual, isFalse);
      expect(c.status, SaleStatus.inProduction);
      expect(c.total, 57500);
      expect(c.ageHours, 50);
      expect(c.late, isTrue);
      expect(c.createdAt, isNotNull);
    });

    test('un total como String y un cliente nulo no rompen', () {
      final c = d.items.last;
      expect(c.total, 4500);
      expect(c.customerName, isNull);
    });

    test('arma una columna por etapa del flujo con su cantidad', () {
      expect(d.columns.map((c) => c.status), SaleStatus.flow);
      int n(SaleStatus s) => d.columns.firstWhere((c) => c.status == s).count;
      expect(n(SaleStatus.inProduction), 1);
      expect(n(SaleStatus.ready), 1);
      expect(n(SaleStatus.delivered), 0);
    });

    test('demoradas y etapa', () {
      expect(d.lateCount, 1);
      expect(d.inStage(SaleStatus.pendingPayment).single.id, 'm1');
    });

    test('un cuerpo vacío no rompe', () {
      final x = BoardData.fromJson({});
      expect(x.items, isEmpty);
      expect(x.lateCount, 0);
      expect(x.degraded, isEmpty);
    });

    test('las fuentes caídas llegan en degraded', () {
      final x = BoardData.fromJson({
        'items': <dynamic>[],
        'degraded': ['ventas manuales'],
      });
      expect(x.degraded, ['ventas manuales']);
    });
  });

  group('BoardCard.nextStages', () {
    BoardCard card(String status) =>
        BoardCard.fromJson({'id': 'x', 'source': 'online', 'label': 'x', 'status': status, 'total': 1});

    test('avanza por el flujo del taller, sin cancelar ni reembolsar', () {
      expect(card('pending_payment').nextStages, [SaleStatus.confirmed]);
      expect(card('confirmed').nextStages, [SaleStatus.inProduction]);
      expect(card('in_production').nextStages, [SaleStatus.ready]);
      expect(card('ready').nextStages, [SaleStatus.shipped, SaleStatus.delivered]);
      expect(card('shipped').nextStages, [SaleStatus.delivered]);
    });

    test('lo entregado no tiene más etapas', () {
      expect(card('delivered').nextStages, isEmpty);
    });
  });

  test('formatAgo (antigüedad de la tarjeta)', () {
    expect(formatAgo(0), 'recién');
    expect(formatAgo(50), 'hace 2 d');
    expect(formatAgo(26), 'hace 1 d');
  });
}
