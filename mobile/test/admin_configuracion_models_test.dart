import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/configuracion/config_models.dart';
import 'package:hefesto/features/admin/configuracion/config_widgets.dart' show parseHex, parseNumber, plainNumber;

import 'admin_configuracion_fixtures.dart';

void main() {
  group('AdminConfig.fromJson', () {
    final cfg = AdminConfig.fromJson(configJson());

    test('negocio con horarios de dos turnos', () {
      expect(cfg.negocio.storeName, 'Hefesto 3D');
      expect(cfg.negocio.tiktok, '@hefesto.tiktok');
      expect(cfg.negocio.cuit, '');
      expect(cfg.negocio.hours, hasLength(3));
      expect(cfg.negocio.hours[0].morning.from, '09:00');
      expect(cfg.negocio.hours[0].closed, isFalse);
      expect(cfg.negocio.hours[1].afternoon.on, isFalse);
      expect(cfg.negocio.hours[2].closed, isTrue);
    });

    test('envíos: precios numéricos o en texto', () {
      expect(cfg.envios.city, 'Iguazú');
      expect(cfg.envios.freeOver, 30000);
      expect(cfg.envios.zones.map((z) => z.price), [1500, 2000.5]);
      expect(cfg.envios.pickupEnabled, isTrue);
      expect(cfg.envios.deliveryEnabled, isFalse);
    });

    test('pagos: solo "conectado", nunca un token', () {
      expect(cfg.pagos.mpConnected, isFalse);
      expect(cfg.pagos.enabledNames, ['Transferencia', 'MercadoPago']);
      expect(cfg.pagos.cashNote, 'Solo retiro');
    });

    test('tienda: temporada, secciones, banners (con campos que faltan)', () {
      final t = cfg.tienda;
      expect(t.isVidriera, isFalse);
      expect(t.season, 'navidad');
      expect(t.seasons.firstWhere((s) => s.key == 'navidad').hasDeco, isTrue);
      expect(t.homeSections.firstWhere((s) => s.id == 'faq').on, isFalse);
      expect(t.banners, hasLength(2));
      expect(t.banners[0].subtitle, isNull);
      expect(t.banners[0].ctaHref, '/productos');
      expect(t.banners[1].imageUrl, isNull);
      expect(t.banners[1].isActive, isFalse);
      expect(t.logoUrl, isNull);
      expect(t.bannerIntervalSec, 7);
    });

    test('textos: de fábrica vs propios, y la cotización', () {
      expect(cfg.textos.trustBar, hasLength(2));
      expect(cfg.textos.trustBarCustom, isFalse);
      expect(cfg.textos.faqCustom, isTrue);
      expect(cfg.textos.quote.depositPct, 50);
      expect(cfg.textos.quote.notes, ['Las dimensiones pueden variar.']);
    });

    test('una respuesta vacía da valores por defecto, sin lanzar', () {
      final empty = AdminConfig.fromJson(<String, dynamic>{});
      expect(empty.negocio.storeName, '');
      expect(empty.negocio.hours, isEmpty);
      expect(empty.envios.pickupEnabled, isTrue);
      expect(empty.pagos.transferEnabled, isTrue);
      expect(empty.tienda.businessMode, 'checkout');
      expect(empty.tienda.bannerIntervalSec, 5);
      expect(empty.textos.faq, isEmpty);
    });

    test('tipos inesperados no rompen (null, números como texto)', () {
      final j = jsonDecode(jsonEncode(configJson())) as Map<String, dynamic>;
      (j['envios'] as Map)['freeOver'] = '45000.00';
      (j['tienda'] as Map)['seasonIntensity'] = '26';
      (j['negocio'] as Map)['storeName'] = null;
      (j['tienda'] as Map)['banners'] = null;
      final cfg2 = AdminConfig.fromJson(j);
      expect(cfg2.envios.freeOver, 45000);
      expect(cfg2.tienda.seasonIntensity, 26);
      expect(cfg2.negocio.storeName, '');
      expect(cfg2.tienda.banners, isEmpty);
    });
  });

  group('HourRow', () {
    test('toJson tiene la forma que espera el servidor', () {
      final row = HourRow(
        label: '  Lun a Vie ',
        morning: const HourShift(on: true, from: '09:00', to: '13:00'),
      );
      expect(row.toJson(), {
        'label': 'Lun a Vie',
        'morning': {'on': true, 'from': '09:00', 'to': '13:00'},
        'afternoon': {'on': false, 'from': '', 'to': ''},
      });
    });

    test('copyWith cambia solo un turno', () {
      final row = HourRow.fromJson((configJson()['negocio'] as Map)['hours'][0] as Map<String, dynamic>);
      final changed = row.copyWith(afternoon: row.afternoon.copyWith(on: false));
      expect(changed.afternoon.on, isFalse);
      expect(changed.morning.on, isTrue);
      expect(changed.label, 'Lun a Vie');
    });
  });

  group('TeamData.fromJson', () {
    final team = TeamData.fromJson(teamJson());

    test('miembros: nombre para mostrar, rol y estado', () {
      expect(team.canManage, isTrue);
      expect(team.team, hasLength(3));
      expect(team.team[0].isSelf, isTrue);
      expect(team.team[0].isLastAdmin, isTrue);
      expect(team.team[1].pending, isTrue);
      expect(team.team[1].displayName, 'anto@x.com', reason: 'sin nombre usa el mail');
      expect(team.team[2].roleLabel, 'Operador', reason: 'sin rol personalizado cae al de acceso');
      expect(team.activeCount, 2);
      expect(team.pendingCount, 1);
    });

    test('roles: matriz de permisos', () {
      final op = team.roles[1];
      expect(op.allows('pedidos', 'editar'), isTrue);
      expect(op.allows('pedidos', 'eliminar'), isFalse);
      expect(op.allows('auditoria', 'ver'), isFalse);
      expect(op.visibleModules, 2, reason: 'pedidos y productos tienen "ver"; config está vacío');
      expect(team.roles[0].allows('auditoria', 'ver'), isTrue, reason: 'el administrador puede todo');
      expect(team.modules.map((m) => m.key), ['pedidos', 'productos', 'config', 'auditoria']);
    });

    test('vacío', () {
      final empty = TeamData.fromJson(<String, dynamic>{});
      expect(empty.canManage, isFalse);
      expect(empty.team, isEmpty);
      expect(empty.roles, isEmpty);
    });
  });

  group('ayudas de formularios', () {
    test('plainNumber', () {
      expect(plainNumber(1500), '1500');
      expect(plainNumber(1500.0), '1500');
      expect(plainNumber(12.5), '12.5');
    });

    test('parseNumber entiende lo que se escribe en Argentina', () {
      expect(parseNumber('1500'), 1500);
      expect(parseNumber('1.500'), 1500, reason: 'punto de miles');
      expect(parseNumber('1.500.000'), 1500000);
      expect(parseNumber('1500,5'), 1500.5);
      expect(parseNumber('1.500,50'), 1500.5);
      expect(parseNumber('12.5'), 12.5);
      expect(parseNumber('  '), isNull);
      expect(parseNumber('abc'), isNull);
    });

    test('parseHex', () {
      expect(parseHex('#C9A84C').toARGB32(), 0xFFC9A84C);
      expect(parseHex('nada').toARGB32(), isNot(0xFFC9A84C), reason: 'gris neutro');
      expect(parseHex(null), isNotNull);
    });
  });
}
