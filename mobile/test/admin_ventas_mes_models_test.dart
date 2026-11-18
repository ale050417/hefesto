import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/admin_models.dart';
import 'package:hefesto/features/admin/sale_month.dart';
import 'package:hefesto/features/admin/sale_status.dart';

SaleRow _sale(String id, String date, String status) => SaleRow.fromJson({
      'id': id,
      'source': 'online',
      'date': date,
      'customerName': 'Cliente $id',
      'label': 'Producto',
      'ref': 'HF-$id',
      'paymentMethod': 'transfer',
      'status': status,
      'total': 1000,
    });

void main() {
  group('monthKeyOf (hora de Argentina)', () {
    test('una venta del 31 a las 22:30 en Argentina es de ESE mes, aunque en UTC ya sea día 1', () {
      // 31/10 22:30 en Argentina (UTC−3) = 01/11 01:30 UTC.
      expect(monthKeyOf(DateTime.utc(2026, 11, 1, 1, 30)), '2026-10');
      // Y la misma venta leída del JSON (que el modelo pasa a hora local).
      expect(monthKeyOf(_sale('x', '2026-11-01T01:30:00.000Z', 'confirmed').date), '2026-10');
    });

    test('los bordes del mes: 00:00 del 1 en Argentina ya es el mes nuevo', () {
      expect(monthKeyOf(DateTime.utc(2026, 11, 1, 2, 59, 59)), '2026-10');
      expect(monthKeyOf(DateTime.utc(2026, 11, 1, 3)), '2026-11');
    });

    test('fin de año: el 31/12 a la noche sigue siendo diciembre', () {
      expect(monthKeyOf(DateTime.utc(2027, 1, 1, 2)), '2026-12');
      expect(monthKeyOf(DateTime.utc(2027, 1, 1, 3)), '2027-01');
    });

    test('no depende de si la fecha viene en UTC o en hora local: es el mismo instante', () {
      final utc = DateTime.utc(2026, 11, 1, 1, 30);
      expect(monthKeyOf(utc.toLocal()), monthKeyOf(utc));
    });

    test('un día cualquiera del medio', () {
      expect(monthKeyOf(DateTime.utc(2026, 3, 15, 18)), '2026-03');
    });
  });

  group('stepMonth y rótulos', () {
    test('avanza y retrocede cruzando de año', () {
      expect(stepMonth('2026-11', 1), '2026-12');
      expect(stepMonth('2026-12', 1), '2027-01');
      expect(stepMonth('2026-01', -1), '2025-12');
      expect(stepMonth('2026-11', -11), '2025-12');
      expect(stepMonth('2026-11', 14), '2028-01');
      expect(stepMonth('2026-11', 0), '2026-11');
    });

    test('el mes con el año, en minúscula para una frase y con mayúscula para el botón', () {
      expect(monthLabel('2026-11'), 'noviembre 2026');
      expect(monthLabel('2027-01'), 'enero 2027');
      expect(monthTitle('2026-11'), 'Noviembre 2026');
      expect(monthTitle('2026-09'), 'Septiembre 2026');
    });
  });

  group('estados abiertos', () {
    test('abierta = ni entregada, ni cancelada, ni reembolsada', () {
      final open = SaleStatus.values.where(isOpenStatus).toSet();
      expect(open, {
        SaleStatus.pendingPayment,
        SaleStatus.confirmed,
        SaleStatus.inProduction,
        SaleStatus.ready,
        SaleStatus.shipped,
      });
    });

    test('filtros: todos, sin cerrar y uno puntual', () {
      expect(SaleStatusFilter.all.isAll, isTrue);
      expect(SaleStatusFilter.all.matches(SaleStatus.cancelled), isTrue);
      expect(SaleStatusFilter.unclosed.matches(SaleStatus.ready), isTrue);
      expect(SaleStatusFilter.unclosed.matches(SaleStatus.delivered), isFalse);
      const ready = SaleStatusFilter.only(SaleStatus.ready);
      expect(ready.matches(SaleStatus.ready), isTrue);
      expect(ready.matches(SaleStatus.shipped), isFalse);
      expect(ready, const SaleStatusFilter.only(SaleStatus.ready));
      expect(ready == SaleStatusFilter.all, isFalse);
    });
  });

  group('buildSalesMonthView', () {
    final rows = [
      _sale('n', '2026-11-01T01:30:00.000Z', 'confirmed'), // 31/10 22:30 en Argentina
      _sale('a', '2026-10-30T15:00:00.000Z', 'in_production'),
      _sale('b', '2026-10-29T15:00:00.000Z', 'delivered'),
      _sale('c', '2026-10-28T15:00:00.000Z', 'cancelled'),
      _sale('s1', '2026-09-12T15:00:00.000Z', 'in_production'),
      _sale('s2', '2026-09-03T15:00:00.000Z', 'delivered'),
      _sale('g', '2026-08-05T15:00:00.000Z', 'pending_payment'),
    ];

    test('un mes: lista, contadores por estado y sin cerrar de ese mes', () {
      final v = buildSalesMonthView(rows, month: '2026-10');
      expect(v.list.map((r) => r.id), ['n', 'a', 'b', 'c']);
      expect(v.inMonth, 4);
      expect(v.counts[SaleStatus.inProduction], 1);
      expect(v.counts[SaleStatus.confirmed], 1);
      expect(v.counts[SaleStatus.delivered], 1);
      expect(v.counts[SaleStatus.pendingPayment], isNull);
      expect(v.openCount, 2);
      expect(v.inOtherMonths, 3);
    });

    test('avisa lo que quedó sin cerrar de meses ANTERIORES al elegido', () {
      expect(buildSalesMonthView(rows, month: '2026-10').overdue, 2); // s1 y g
      expect(buildSalesMonthView(rows, month: '2026-09').overdue, 1); // g
      expect(buildSalesMonthView(rows, month: '2026-08').overdue, 0);
      // Lo abierto de meses POSTERIORES no es "atrasado".
      expect(buildSalesMonthView(rows, month: '2026-11').overdue, 4);
      expect(buildSalesMonthView(rows, month: '2026-11').list, isEmpty);
    });

    test('todos los meses: sin aviso de atrasadas y con todo contado', () {
      final v = buildSalesMonthView(rows, month: null);
      expect(v.list, hasLength(7));
      expect(v.overdue, 0);
      expect(v.inOtherMonths, 0);
      expect(v.openCount, 4);
    });

    test('el estado se aplica DESPUÉS: los contadores siguen siendo los del mes', () {
      final v = buildSalesMonthView(rows, month: '2026-10', status: const SaleStatusFilter.only(SaleStatus.delivered));
      expect(v.list.map((r) => r.id), ['b']);
      expect(v.inMonth, 4);
      expect(v.counts[SaleStatus.cancelled], 1);
    });

    test('"Ver" del aviso: todos los meses + sin cerrar', () {
      final v = buildSalesMonthView(rows, month: null, status: SaleStatusFilter.unclosed);
      expect(v.list.map((r) => r.id), ['n', 'a', 's1', 'g']);
    });

    test('sin ventas', () {
      final v = buildSalesMonthView(const [], month: '2026-10');
      expect(v.list, isEmpty);
      expect(v.inMonth, 0);
      expect(v.overdue, 0);
    });
  });

  test('texto del aviso de atrasadas', () {
    expect(overdueLabel(1), 'Hay 1 pedido de meses anteriores sin cerrar');
    expect(overdueLabel(4), 'Hay 4 pedidos de meses anteriores sin cerrar');
  });
}
