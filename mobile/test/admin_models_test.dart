import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/models.dart';
import 'package:hefesto/features/admin/admin_models.dart';
import 'package:hefesto/features/admin/sale_status.dart';

void main() {
  group('SaleStatus', () {
    test('fromApi conoce los 8 estados y cae a pendiente con uno desconocido', () {
      for (final s in SaleStatus.values) {
        expect(SaleStatus.fromApi(s.api), s);
      }
      expect(SaleStatus.fromApi('algo_raro'), SaleStatus.pendingPayment);
      expect(SaleStatus.fromApi(null), SaleStatus.pendingPayment);
    });

    test('las transiciones son las MISMAS que las del servidor (transitions.ts)', () {
      // Contrato entre apps: si el servidor cambia la máquina de estados y la
      // app no, este test avisa antes de que aparezcan botones que fallan.
      final file = File('../src/features/orders/transitions.ts');
      if (!file.existsSync()) {
        markTestSkipped('No está el código de la web junto a la app.');
        return;
      }
      final src = file.readAsStringSync();
      final block = RegExp(r'ORDER_TRANSITIONS[^{]*\{([\s\S]*?)\n\};').firstMatch(src)!.group(1)!;
      final server = <String, List<String>>{};
      for (final m in RegExp(r'(\w+):\s*\[([^\]]*)\]').allMatches(block)) {
        server[m.group(1)!] = RegExp(r'"(\w+)"').allMatches(m.group(2)!).map((e) => e.group(1)!).toList();
      }
      expect(server.keys.length, 8);
      for (final s in SaleStatus.values) {
        expect(
          s.next.map((n) => n.api).toList()..sort(),
          (server[s.api] ?? [])..sort(),
          reason: 'transiciones desde ${s.api}',
        );
      }
    });

    test('cancelar y reembolsar son destructivos y terminales', () {
      expect(SaleStatus.cancelled.isDestructive, isTrue);
      expect(SaleStatus.refunded.isFinal, isTrue);
      expect(SaleStatus.cancelled.next, isEmpty);
      expect(SaleStatus.delivered.isFinal, isFalse);
    });
  });

  group('MeInfo.permissions', () {
    final me = MeInfo.fromJson({
      'id': 'u1',
      'email': 'a@b.com',
      'fullName': 'Ale',
      'role': 'operator',
      'isStaff': true,
      'permissions': {
        'pedidos': {'ver': true, 'crear': false, 'editar': true, 'eliminar': false},
        'filamentos': {'ver': true, 'crear': false, 'editar': false, 'eliminar': false},
      },
    });

    test('can() respeta cada acción', () {
      expect(me.can('pedidos', 'ver'), isTrue);
      expect(me.can('pedidos', 'editar'), isTrue);
      expect(me.can('pedidos', 'eliminar'), isFalse);
      expect(me.can('filamentos', 'editar'), isFalse);
      expect(me.can('reportes', 'ver'), isFalse, reason: 'módulo ausente = sin permiso');
      expect(me.isAdmin, isFalse);
    });

    test('un cliente (no staff) no puede nada aunque venga con permisos', () {
      final c = MeInfo.fromJson({
        'id': 'c',
        'role': 'customer',
        'isStaff': false,
        'permissions': {'pedidos': {'ver': true}},
      });
      expect(c.can('pedidos', 'ver'), isFalse);
    });
  });

  group('AdminDashboard.fromJson (forma de /api/v1/admin/dashboard)', () {
    final d = AdminDashboard.fromJson({
      'greetingName': 'Ale',
      'kpis': {'revenue': 1250000.5, 'salesCount': 48, 'pendingCount': 3, 'lowStockCount': 2},
      'revenueSeries': [
        {'date': '2026-10-29', 'total': 0},
        {'date': '2026-10-30', 'total': 32500},
        {'date': '2026-10-31', 'total': 8000.0},
      ],
      'last7': 40500,
      'last30': 123000,
      'counts': {'pendingPayment': 3, 'inProduction': 5, 'ready': 1},
      'statusCounts': {'pending_payment': 3},
      'recentOrders': [
        {
          'id': 'o1',
          'orderNumber': 'HF-0042',
          'customerName': null,
          'paymentMethod': 'transfer',
          'total': 32500,
          'status': 'in_production',
          'createdAt': '2026-10-30T15:00:00.000Z',
          'updatedAt': '2026-10-30T16:00:00.000Z',
          'itemsSummary': 'Cartel ×2',
        },
      ],
      'lowStock': [
        {
          'id': 'f1',
          'material': 'PLA',
          'color': 'Rojo',
          'brand': 'Grilon3',
          'diameter': '1.75',
          'stockGrams': 120,
          'spoolGrams': 1000,
          'costPerKg': 20000,
          'alertThresholdGrams': 200,
          'lowStock': true,
          'status': 'bajo',
          'hex': '#CC2200',
        },
      ],
      'degraded': <String>[],
    });

    test('lee KPIs, serie y contadores', () {
      expect(d.greetingName, 'Ale');
      expect(d.revenue, 1250000.5);
      expect(d.salesCount, 48);
      expect(d.series.length, 3);
      expect(d.series[1].total, 32500);
      expect(d.last7, 40500);
      expect(d.inProduction, 5);
    });

    test('los últimos pedidos aceptan cliente nulo', () {
      expect(d.recent.single.customerName, isNull);
      expect(d.recent.single.ref, 'HF-0042');
      expect(d.recent.single.status, SaleStatus.inProduction);
      expect(d.recent.single.isManual, isFalse);
    });

    test('el stock bajo trae el color real', () {
      expect(d.lowStock.single.isLow, isTrue);
      expect(d.lowStock.single.hex, '#CC2200');
    });

    test('tolera un payload vacío (nunca revienta la pantalla)', () {
      final empty = AdminDashboard.fromJson({});
      expect(empty.series, isEmpty);
      expect(empty.recent, isEmpty);
      expect(empty.revenue, 0);
    });
  });

  group('SaleDetail', () {
    test('pedido online: cliente, dirección, ítems e historial', () {
      final s = SaleDetail.online({
        'id': 'o1',
        'orderNumber': 'HF-0042',
        'status': 'shipped',
        'paymentMethod': 'mercadopago',
        'subtotal': 60000,
        'discountAmount': 5000,
        'shippingCost': 2500,
        'total': 57500,
        'shippingAddress': {
          'fullName': 'Juan Pérez',
          'phone': '+54 3757 624148',
          'street': 'Av. Siempreviva 742',
          'city': 'Posadas',
          'province': 'Misiones',
          'postalCode': '3300',
          'zone': 'Centro',
          'deliveryType': 'local',
          'notes': 'Timbre roto',
        },
        'trackingCode': 'AB123',
        'internalNote': null,
        'cancelReason': null,
        'createdAt': '2026-10-30T15:00:00.000Z',
        'paidAt': '2026-10-30T15:05:00.000Z',
        'customer': {'fullName': null, 'phone': null},
        'items': [
          {
            'id': 'i1',
            'productName': 'Mate Mario',
            'variantLabel': 'Rojo',
            'unitPrice': '30000.00',
            'quantity': 2,
            'lineTotal': '60000.00',
          },
        ],
        'history': [
          {'fromStatus': null, 'toStatus': 'pending_payment', 'note': null, 'createdAt': '2026-10-30T15:00:00.000Z'},
          {'fromStatus': 'pending_payment', 'toStatus': 'confirmed', 'note': 'Pago ok', 'createdAt': '2026-10-30T15:05:00.000Z'},
        ],
      });
      expect(s.title, 'HF-0042');
      expect(s.status, SaleStatus.shipped);
      expect(s.customerName, 'Juan Pérez', reason: 'si el perfil no tiene nombre, usa el de la dirección');
      expect(s.customerPhone, '+54 3757 624148');
      expect(s.addressText, 'Av. Siempreviva 742 · Centro · Posadas, Misiones (3300)');
      expect(s.addressNotes, 'Timbre roto');
      expect(SaleDetail.deliveryLabel(s.address), 'Envío local');
      expect(s.items.single.unitPrice, 30000, reason: 'numeric de Postgres llega como string');
      expect(s.items.single.quantity, 2);
      expect(s.history.length, 2);
      expect(s.history.first.from, isNull);
      expect(s.trackingCode, 'AB123');
      expect(s.paidAt, isNotNull);
    });

    test('retiro en el taller no muestra dirección', () {
      final s = SaleDetail.online({
        'id': 'o2',
        'orderNumber': 'HF-0043',
        'status': 'ready',
        'paymentMethod': 'cash',
        'total': 1000,
        'shippingAddress': {'deliveryType': 'pickup', 'fullName': 'Ana', 'phone': '3757000000'},
        'createdAt': '2026-10-30T15:00:00.000Z',
        'items': <dynamic>[],
        'history': <dynamic>[],
      });
      expect(s.addressText, 'Retira en el taller');
    });

    test('venta manual simple (sin desglose) arma una sola línea', () {
      final s = SaleDetail.manual({
        'id': 'm1',
        'saleDate': '2026-10-29T12:00:00.000Z',
        'customerName': 'Cliente de feria',
        'detail': '5 llaveros',
        'category': 'Llaveros',
        'status': 'delivered',
        'paymentMethod': 'cash',
        'quantity': 5,
        'total': 10000,
        'cancelReason': null,
        'items': <dynamic>[],
      });
      expect(s.isManual, isTrue);
      expect(s.items.single.name, '5 llaveros');
      expect(s.items.single.quantity, 5);
      expect(s.items.single.unitPrice, 2000);
      expect(s.history, isEmpty);
    });

    test('venta manual con desglose junta variante y color', () {
      final s = SaleDetail.manual({
        'id': 'm2',
        'saleDate': '2026-10-29T12:00:00.000Z',
        'customerName': 'X',
        'status': 'confirmed',
        'paymentMethod': 'transfer',
        'quantity': 3,
        'total': 9000,
        'items': [
          {'id': 'a', 'productName': 'Porta sahumerio', 'variantLabel': 'Grande', 'color': 'Negro', 'unitPrice': 3000, 'quantity': 3, 'lineTotal': 9000},
        ],
      });
      expect(s.items.single.variant, 'Grande · Negro');
    });
  });

  group('SalesPage / StockPage', () {
    test('SalesPage lee filas de ambos orígenes', () {
      final p = SalesPage.fromJson({
        'total': 2,
        'items': [
          {'id': 'a', 'source': 'online', 'date': '2026-10-30T10:00:00.000Z', 'customerName': 'Ana', 'label': 'Mate', 'ref': 'HF-1', 'paymentMethod': 'cash', 'status': 'confirmed', 'total': 5000},
          {'id': 'b', 'source': 'manual', 'date': '2026-10-29T10:00:00.000Z', 'customerName': 'Beto', 'label': '', 'ref': null, 'paymentMethod': 'cash', 'status': 'delivered', 'total': 1200.5},
        ],
      });
      expect(p.items.map((e) => e.isManual), [false, true]);
      expect(p.items[1].total, 1200.5);
    });

    test('StockPage cuenta bajos y agotados que manda el servidor', () {
      final p = StockPage.fromJson({
        'counts': {'total': 3, 'low': 1, 'out': 1},
        'items': [
          {'id': '1', 'material': 'PLA', 'color': 'Rojo', 'brand': 'X', 'diameter': '1.75', 'stockGrams': 0, 'spoolGrams': 1000, 'alertThresholdGrams': 200, 'status': 'agotado', 'hex': null},
        ],
      });
      expect(p.low, 1);
      expect(p.out, 1);
      expect(p.items.single.isOut, isTrue);
    });
  });
}
