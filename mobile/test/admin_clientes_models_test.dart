import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/clientes/clientes_models.dart';
import 'package:hefesto/features/admin/clientes/clientes_providers.dart';
import 'package:hefesto/features/admin/sale_status.dart';

import 'admin_crecimiento_samples.dart';

void main() {
  group('CustomersPage', () {
    test('parsea la lista, los contadores y las reglas de nivel', () {
      final page = CustomersPage.fromJson(sampleCustomersJson());
      expect(page.items, hasLength(3));
      expect(page.counts.all, 3);
      expect(page.counts.of(CustomerTier.gold), 1);
      expect(page.counts.of(null), 3);
      expect(page.totalSpent, 2387500.5);
      expect(page.tiers[CustomerTier.gold]!.minOrders, 10);
      expect(page.tiers[CustomerTier.silver]!.minSpent, 40000);
    });

    test('numeric como String, nulls y manuales', () {
      final items = CustomersPage.fromJson(sampleCustomersJson()).items;
      expect(items[2].spent, 2300000);
      expect(items[2].tier, CustomerTier.gold);
      expect(items[1].isManual, isTrue);
      expect(items[1].email, isNull);
      expect(items[1].contactLine, '011 5555-1234');
      expect(items[1].name, startsWith('Cliente de feria'));
      expect(items[2].contactLine, 'ana@mail.com');
      expect(items[0].note, 'Le gusta el rojo oscuro');
    });

    test('tolera una respuesta mínima o rara sin lanzar', () {
      final page = CustomersPage.fromJson({
        'items': [
          {'id': 'x', 'name': '  ', 'tier': 'inventado', 'orders': null, 'spent': null, 'since': 'no-es-fecha'},
        ],
      });
      expect(page.items.single.name, 'Sin nombre');
      expect(page.items.single.tier, CustomerTier.bronze);
      expect(page.items.single.orders, 0);
      expect(page.counts.all, 1, reason: 'sin counts usa el largo de la lista');
      expect(page.tiers, isEmpty);
      expect(CustomersPage.fromJson({}).items, isEmpty);
    });
  });

  group('búsqueda local (igual que el servidor)', () {
    final items = CustomersPage.fromJson(sampleCustomersJson()).items;
    List<String> find(String q) => items.where((c) => c.matches(q)).map((c) => c.name).toList();

    test('por nombre, email y ciudad sin distinguir mayúsculas', () {
      expect(find('  ANA '), ['Ana Gómez']);
      expect(find('juan@'), ['Juan Pérez']);
      expect(find('posadas'), ['Juan Pérez']);
      expect(find(''), hasLength(3));
    });

    test('por teléfono ignorando espacios y guiones', () {
      expect(find('3757624148'), ['Juan Pérez']);
      expect(find('5555 1234'), hasLength(1));
      expect(find('76'), isEmpty, reason: 'con menos de 3 dígitos solo busca el texto literal');
    });
  });

  group('CustomerDetail', () {
    test('parsea ficha, pedidos y puntos', () {
      final d = CustomerDetail.fromJson({
        'customer': sampleCustomersJson()['items'][0],
        'orders': [
          {
            'id': 'o1',
            'orderNumber': 'HF-0042',
            'status': 'delivered',
            'total': 57500,
            'createdAt': '2026-10-01T10:00:00.000Z',
          },
          {'id': 'o2', 'orderNumber': null, 'status': 'raro', 'total': '1000.00', 'createdAt': null},
        ],
        'points': {
          'balance': 120,
          'earned': 200,
          'redeemed': 80,
          'redemptions': [
            {'id': 'p1', 'reason': 'Canje: \$2.000 · cupón PREMIO-AB12C', 'points': 80, 'createdAt': '2026-10-02T10:00:00.000Z'},
          ],
        },
      });
      expect(d.customer.name, 'Juan Pérez');
      expect(d.orders, hasLength(2));
      expect(d.orders[0].status, SaleStatus.delivered);
      expect(d.orders[0].total, 57500);
      expect(d.orders[1].orderNumber, '—');
      expect(d.orders[1].status, SaleStatus.pendingPayment, reason: 'estado desconocido cae a pendiente');
      expect(d.orders[1].total, 1000);
      expect(d.points.balance, 120);
      expect(d.points.redemptions.single.points, 80);
    });

    test('cliente manual sin pedidos ni puntos', () {
      final d = CustomerDetail.fromJson({
        'customer': sampleCustomersJson()['items'][1],
        'orders': <dynamic>[],
        'points': {'balance': 0, 'earned': 0, 'redeemed': 0, 'redemptions': <dynamic>[]},
      });
      expect(d.customer.isManual, isTrue);
      expect(d.orders, isEmpty);
      expect(d.points.redemptions, isEmpty);
      // Sin bloque de puntos tampoco rompe.
      expect(CustomerDetail.fromJson({'customer': sampleCustomersJson()['items'][1]}).points.balance, 0);
    });
  });

  group('WhatsApp: número argentino', () {
    test('mismo criterio que el detalle de ventas', () {
      expect(customerWaNumber('+54 3757 62-4148'), '543757624148');
      expect(customerWaNumber('0054 11 5555-1234'), '541155551234');
      expect(customerWaNumber('011 5555-1234'), '5491155551234');
      expect(customerWaNumber('3757624148'), '5493757624148');
    });
  });

  group('cuerpos que se mandan al servidor', () {
    test('customerBody recorta los espacios y manda todo (vacío = sin dato)', () {
      expect(
        customerBody(name: '  Juan Pérez ', email: ' juan@mail.com', phone: '', city: ' Posadas ', note: '  '),
        {'name': 'Juan Pérez', 'email': 'juan@mail.com', 'phone': '', 'city': 'Posadas', 'note': ''},
      );
    });
  });
}
