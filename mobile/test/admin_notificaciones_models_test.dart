import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/notificaciones/notifications_models.dart';

import 'support/notifications_kit.dart';

void main() {
  group('NotificationsData.fromJson', () {
    final d = NotificationsData.fromJson(notificationsJson());

    test('lee la lista, el total sin ver y los tipos con la forma real de la API', () {
      expect(d.items, hasLength(4));
      expect(d.unread, 2);
      final n = d.items.first;
      expect(n.id, 'n1');
      expect(n.kind, 'inquiry');
      expect(n.title, 'Consulta nueva');
      expect(n.body, 'Antonella: Trofeo (x4) — Sabunim Itati');
      expect(n.link, '/admin/consultas');
      expect(n.unread, isTrue);
      expect(n.createdAt!.toUtc(), DateTime.utc(2026, 11, 25, 14, 3));
      expect(d.items.last.body, isNull);
      expect(d.items.last.link, isNull);
      expect(d.kinds.map((k) => k.key), ['inquiry', 'order', 'low_stock', 'fix']);
      expect(d.kinds.first.label, 'Consultas nuevas');
      expect(d.kinds.first.description, 'Cuando atención al cliente carga una consulta para cotizar.');
      expect(d.kinds.first.enabled, isTrue);
      expect(d.kinds[2].enabled, isFalse);
      expect(d.mutedKeys, ['low_stock']);
    });

    test('tipos que la app no conoce y campos de más se aceptan', () {
      final odd = NotificationsData.fromJson({
        'items': [
          {
            'id': 'x1',
            'kind': 'algo_nuevo',
            'title': 'Tipo del futuro',
            'unread': true,
            'createdAt': '2026-11-25T10:00:00.000Z',
            'priority': 'high',
            'extra': {'a': 1},
          },
        ],
        'unread': 1,
        'kinds': [
          {'key': 'algo_nuevo', 'enabled': true, 'group': 'x'},
          {'key': 'otro', 'label': '   ', 'enabled': false},
        ],
        'serverTime': '2026-11-25T10:00:01.000Z',
      });
      expect(odd.items.single.kind, 'algo_nuevo');
      expect(odd.items.single.title, 'Tipo del futuro');
      // Sin nombre: se muestra la clave.
      expect(odd.kinds.map((k) => k.label), ['algo_nuevo', 'otro']);
      expect(odd.kinds.first.description, isNull);
      expect(odd.mutedKeys, ['otro']);
    });

    test('respuesta vacía, campos que faltan o basura no rompen', () {
      final empty = NotificationsData.fromJson({});
      expect(empty.items, isEmpty);
      expect(empty.unread, 0);
      expect(empty.kinds, isEmpty);
      expect(empty.latest, isNull);

      final odd = NotificationsData.fromJson({
        'items': [
          {'id': '', 'title': 'sin id'},
          'basura',
          null,
          {'id': 'a', 'createdAt': 'no es fecha', 'unread': 'sí'},
          {'id': 'b', 'title': 'Con título', 'unread': true, 'body': '', 'link': ''},
        ],
        'kinds': [
          {'label': 'sin clave'},
          7,
          {'key': 'order'},
        ],
      });
      expect(odd.items.map((n) => n.id), ['a', 'b']);
      final a = odd.items.first;
      expect(a.title, 'Novedad');
      expect(a.kind, 'other');
      expect(a.unread, isFalse);
      expect(a.createdAt, isNull);
      expect(odd.items.last.body, isNull);
      expect(odd.items.last.link, isNull);
      // Sin `unread` en la respuesta: se cuentan los de la lista.
      expect(odd.unread, 1);
      expect(odd.kinds.single.key, 'order');
      expect(odd.kinds.single.enabled, isTrue, reason: 'sin el dato, el tipo se considera prendido');

      expect(NotificationsData.fromJson({'items': null, 'unread': -4, 'kinds': 'x'}).unread, 0);
      expect(NotificationsData.fromJson({'unread': '5'}).unread, 5);
    });
  });

  group('cambios locales', () {
    final d = NotificationsData.fromJson(notificationsJson());

    test('marcar todo como visto deja el total en cero y ningún aviso sin ver', () {
      final read = d.allRead();
      expect(read.unread, 0);
      expect(read.items.any((n) => n.unread), isFalse);
      expect(read.items, hasLength(4));
      expect(read.kinds, hasLength(4));
    });

    test('apagar y prender un tipo arma la lista completa de silenciados', () {
      expect(d.withKindEnabled('order', false).mutedKeys, ['order', 'low_stock']);
      expect(d.withKindEnabled('low_stock', true).mutedKeys, isEmpty);
      expect(d.withKindEnabled('no_existe', false).mutedKeys, ['low_stock']);
    });

    test('el aviso de la tarjeta de Inicio es el más nuevo sin ver', () {
      expect(d.latest!.id, 'n1');
      final later = NotificationsData.fromJson({
        'items': [notifJson('a', unread: false), notifJson('b', title: 'Pedido nuevo')],
      });
      expect(later.latest!.id, 'b');
      expect(d.allRead().latest!.id, 'n1');
    });
  });

  group('textos', () {
    test('cuántas novedades', () {
      expect(notificationsCountLabel(1), 'Tenés 1 novedad');
      expect(notificationsCountLabel(3), 'Tenés 3 novedades');
      expect(notificationsBadgeLabel(7), '7');
      expect(notificationsBadgeLabel(99), '99');
      expect(notificationsBadgeLabel(120), '99+');
    });

    test('hace cuánto', () {
      final now = DateTime(2026, 11, 25, 15);
      expect(notificationAgo(now.subtract(const Duration(seconds: 20)), now: now), 'recién');
      expect(notificationAgo(now.subtract(const Duration(minutes: 5)), now: now), 'hace 5 min');
      expect(notificationAgo(now.subtract(const Duration(hours: 3)), now: now), 'hace 3 h');
      expect(notificationAgo(now.subtract(const Duration(hours: 30)), now: now), 'ayer');
      expect(notificationAgo(now.subtract(const Duration(days: 4)), now: now), 'hace 4 d');
      expect(notificationAgo(DateTime(2026, 10, 2, 9), now: now), '02/10/2026');
      // Un reloj adelantado en el servidor no da "hace -1 min".
      expect(notificationAgo(now.add(const Duration(minutes: 2)), now: now), 'recién');
    });
  });

  group('a dónde lleva un aviso', () {
    test('cada dirección de la web tiene su pantalla en la app', () {
      expect(notificationTarget('/admin/consultas'), (route: '/admin/m/consultas', permission: 'consultas', tab: false));
      expect(notificationTarget('/admin/filamentos'), (route: '/admin/m/filamentos', permission: 'filamentos', tab: false));
      expect(notificationTarget('/admin/arreglos'), (route: '/admin/m/arreglos', permission: 'arreglos', tab: false));
      expect(notificationTarget('/admin/calculadora'), (route: '/admin/m/calculadora', permission: 'calculadora', tab: false));
      expect(notificationTarget('/admin/produccion'), (route: '/admin/cola', permission: 'produccion', tab: true));
      expect(notificationTarget('/admin/pedidos'), (route: '/admin/ventas', permission: 'pedidos', tab: true));
    });

    test('un pedido con id abre su detalle; con otra cosa, la lista de ventas', () {
      const id = '0b8f6c1e-2a3d-4e5f-8a9b-1c2d3e4f5a6b';
      expect(notificationTarget('/admin/pedidos/$id'), (route: '/admin/venta/online/$id', permission: 'pedidos', tab: false));
      expect(notificationTarget('/admin/pedidos/$id?tab=pago')!.route, '/admin/venta/online/$id');
      expect(notificationTarget('/admin/pedidos/nuevo')!.route, '/admin/ventas');
      expect(notificationTarget('/admin/pedidos?status=ready')!.route, '/admin/ventas');
    });

    test('sub-rutas, parámetros y dirección completa también sirven', () {
      expect(notificationTarget('/admin/consultas/abc')!.route, '/admin/m/consultas');
      expect(notificationTarget('/admin/consultas?id=7')!.route, '/admin/m/consultas');
      expect(notificationTarget('https://hefesto3d.com.ar/admin/arreglos')!.route, '/admin/m/arreglos');
    });

    test('lo que la app no tiene no lleva a ningún lado', () {
      expect(notificationTarget(null), isNull);
      expect(notificationTarget(''), isNull);
      expect(notificationTarget('/admin'), isNull);
      expect(notificationTarget('/admin/mensajes'), isNull);
      expect(notificationTarget('/cuenta/pedidos'), isNull);
      expect(notificationTarget('/admin/consultasviejas'), isNull);
      expect(notificationTarget('cualquier cosa'), isNull);
    });
  });
}
