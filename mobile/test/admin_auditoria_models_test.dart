import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/auditoria/audit_labels.dart';
import 'package:hefesto/features/admin/auditoria/audit_models.dart';
import 'package:hefesto/features/admin/auditoria/auditoria_screen.dart';
import 'package:intl/date_symbol_data_local.dart';

/// JSON con la forma real de `GET /api/v1/admin/auditoria` (ver
/// src/core/audit/query.ts).
Map<String, dynamic> _pageJson() => {
      'items': [
        {
          'id': '11111111-1111-4111-8111-111111111111',
          'action': 'order.status_changed',
          'actionLabel': 'Cambió estado de pedido',
          'entityType': 'order',
          'entityId': '9f1c2d3e-0000-4000-8000-000000000001',
          'metadata': {'from': 'confirmed', 'to': 'in_production', 'orderNumber': 'HF-0042', 'status': 'in_production'},
          'createdAt': '2026-10-30T15:30:00.000Z',
          'actor': {'id': 'u1', 'name': 'Ale', 'role': 'admin'},
        },
        {
          'id': '22222222-2222-4222-8222-222222222222',
          'action': 'manual_sale.created',
          'actionLabel': 'Cargó una venta manual',
          'entityType': 'manual_sale',
          'entityId': 'abc',
          'metadata': {'total': '15000.00', 'customer': 'Feria'},
          'createdAt': '2026-10-30T12:00:00.000Z',
          'actor': null,
        },
        {
          'id': '33333333-3333-4333-8333-333333333333',
          'action': 'algo.nuevo_que_la_app_no_conoce',
          'actionLabel': 'Algo nuevo del servidor',
          'entityType': null,
          'entityId': null,
          'metadata': null,
          'createdAt': 'fecha-rota',
          'actor': {'id': 'u2', 'name': null, 'role': null},
        },
      ],
      'page': 1,
      'pageSize': 30,
      'hasMore': true,
      'facets': {
        'actions': [
          {'value': 'order.status_changed', 'label': 'Cambió estado de pedido', 'count': 12},
          {'value': 'team.member_invited', 'label': 'Invitó a una persona al equipo', 'count': 1},
        ],
        'entityTypes': [
          {'value': 'order', 'count': 14},
          {'value': 'manual_sale', 'count': 3},
        ],
        'actors': [
          {'id': 'u1', 'name': 'Ale', 'count': 15},
          {'id': 'sistema', 'name': null, 'count': 2},
        ],
      },
    };

AuditEntry _entry(String action, {Object? metadata, String? serverLabel, DateTime? at}) => AuditEntry(
      id: 'e-$action',
      action: action,
      actionLabel: serverLabel,
      metadata: metadata,
      createdAt: at ?? DateTime(2026, 10, 30, 12),
    );

void main() {
  setUpAll(() => initializeDateFormatting('es_AR'));

  group('AuditPage.fromJson', () {
    final page = AuditPage.fromJson(_pageJson());

    test('lee los eventos, la paginación y las opciones de filtro', () {
      expect(page.items, hasLength(3));
      expect(page.hasMore, isTrue);
      expect(page.page, 1);
      expect(page.facets!.entityTypes.map((e) => e.value), ['order', 'manual_sale']);
      expect(page.facets!.actors.last.isSystem, isTrue);
      expect(page.facets!.actions.first.count, 12);
    });

    test('un evento completo', () {
      final e = page.items.first;
      expect(e.action, 'order.status_changed');
      expect(e.actor!.displayName, 'Ale');
      expect(e.actor!.roleLabel, 'Administrador');
      expect(e.metaMap['orderNumber'], 'HF-0042');
      expect(e.createdAt.toUtc(), DateTime.utc(2026, 10, 30, 15, 30));
    });

    test('sin autor (lo hizo el sistema) y sin detalle no rompen', () {
      final e = page.items[1];
      expect(e.actor, isNull);
      final raro = page.items[2];
      expect(raro.metadata, isNull);
      expect(raro.metaMap, isEmpty);
      expect(raro.entityType, isNull);
      expect(raro.actor!.displayName, 'Sin nombre');
      expect(raro.actor!.roleLabel, isNull);
    });

    test('una fecha rota no lanza', () {
      expect(page.items[2].createdAt.millisecondsSinceEpoch, 0);
    });

    test('respuesta vacía o con campos que faltan', () {
      final empty = AuditPage.fromJson(<String, dynamic>{});
      expect(empty.items, isEmpty);
      expect(empty.hasMore, isFalse);
      expect(empty.page, 1);
      expect(empty.facets, isNull);
    });

    test('el detalle puede ser una lista o un texto suelto', () {
      final lista = AuditEntry.fromJson({'id': 'x', 'action': 'a.b', 'metadata': [1, 2], 'createdAt': '2026-10-30T12:00:00Z'});
      expect(lista.metaMap, isEmpty);
      expect(auditDetailRows(lista).single.value, '[1, 2]');
      expect(lista.prettyMetadata, contains('1'));
    });
  });

  group('AuditFilters', () {
    final now = DateTime(2026, 10, 31, 15, 20);

    test('sin filtros no manda nada', () {
      expect(const AuditFilters().toQuery(now), isEmpty);
      expect(const AuditFilters().isEmpty, isTrue);
    });

    test('arma la consulta con búsqueda, entidad, acción, persona y período', () {
      const f = AuditFilters(
        q: '  mate ',
        entity: 'order',
        action: 'order.status_changed',
        actor: 'u1',
        period: AuditPeriod.today,
      );
      final q = f.toQuery(now);
      expect(q['q'], 'mate');
      expect(q['entity'], 'order');
      expect(q['action'], 'order.status_changed');
      expect(q['actor'], 'u1');
      expect(DateTime.parse(q['desde'] as String).toLocal(), DateTime(2026, 10, 31));
      expect(f.hasChips, isTrue);
    });

    test('período: 7 y 30 días hacia atrás', () {
      expect(AuditPeriod.week.since(now), now.subtract(const Duration(days: 7)));
      expect(AuditPeriod.month.since(now), now.subtract(const Duration(days: 30)));
      expect(AuditPeriod.all.since(now), isNull);
    });

    test('copyWith puede borrar un filtro (null) sin tocar los demás', () {
      const f = AuditFilters(entity: 'order', actor: 'u1');
      final g = f.copyWith(entity: null);
      expect(g.entity, isNull);
      expect(g.actor, 'u1');
      expect(f.copyWith(q: 'x').entity, 'order');
    });

    test('igualdad por valor (para no recargar si no cambió)', () {
      expect(const AuditFilters(entity: 'order'), const AuditFilters(entity: 'order'));
      expect(const AuditFilters(entity: 'order') == const AuditFilters(entity: 'product'), isFalse);
    });
  });

  group('traducción de acciones', () {
    test('los códigos conocidos salen en castellano', () {
      expect(auditActionLabel('order.status_changed'), 'Cambió el estado de un pedido');
      expect(auditActionLabel('manual_sale.created'), 'Cargó una venta manual');
      expect(auditActionLabel('team.member_invited'), 'Invitó a una persona al equipo');
    });

    test('un código desconocido usa el texto del servidor y, sin él, una versión legible', () {
      expect(auditActionLabel('algo.nuevo', serverLabel: 'Hizo algo nuevo'), 'Hizo algo nuevo');
      expect(auditActionLabel('order.x_y'), 'Order: x y');
      expect(auditActionLabel('suelto'), 'Suelto');
      expect(auditActionLabel('a.b', serverLabel: '  '), 'A: b');
    });

    test('entidades', () {
      expect(auditEntityLabel('manual_sale'), 'Venta manual');
      expect(auditEntityLabel('team'), 'Equipo');
      expect(auditEntityLabel('raro_tipo'), 'Raro tipo');
      expect(auditEntityLabel(null), 'General');
    });

    test('toda acción conocida tiene ícono propio (ninguna cae en "otro")', () {
      for (final code in auditActionLabels.keys) {
        expect(auditKindOf(code), isNot(AuditKind.other), reason: code);
      }
    });

    test('tipos: alta, baja, estado, aviso, equipo', () {
      expect(auditKindOf('product.created'), AuditKind.created);
      expect(auditKindOf('product.deleted'), AuditKind.deleted);
      expect(auditKindOf('order.bulk_deleted'), AuditKind.deleted);
      expect(auditKindOf('order.status_changed'), AuditKind.status);
      expect(auditKindOf('manual_sale.status_changed'), AuditKind.status);
      expect(auditKindOf('inventory.order_deduct_failed'), AuditKind.warning);
      expect(auditKindOf('inventory.manual_sale_no_deduct'), AuditKind.warning);
      expect(auditKindOf('team.invite_resent'), AuditKind.team);
      expect(auditKindOf('settings.updated'), AuditKind.settings);
      expect(auditKindOf('coupon.updated'), AuditKind.updated);
    });

    test('la app conoce TODAS las acciones que la web traduce (contrato entre apps)', () {
      final file = File('../src/core/audit/labels.ts');
      if (!file.existsSync()) {
        markTestSkipped('No está el código de la web junto a la app.');
        return;
      }
      final codes = RegExp(r'^\s*"([a-z_]+\.[a-z_]+)":', multiLine: true)
          .allMatches(file.readAsStringSync())
          .map((m) => m.group(1)!)
          .toSet();
      expect(codes, isNotEmpty);
      for (final code in codes) {
        expect(auditActionLabels.containsKey(code), isTrue, reason: 'falta traducir $code en la app');
      }
    });
  });

  group('detalle legible', () {
    test('traduce claves, formatea plata y estados', () {
      final e = _entry('order.status_changed', metadata: {
        'orderNumber': 'HF-0042',
        'status': 'in_production',
        'total': '15000.00',
        'customer': 'Juan Pérez',
        'reason': '',
        'extra': null,
        'cantidadDePiezas': 3,
        'activo': true,
      });
      final rows = {for (final r in auditDetailRows(e)) r.label: r.value};
      expect(rows['Pedido'], 'HF-0042');
      expect(rows['Estado'], 'En producción');
      expect(rows['Total'], r'$15.000');
      expect(rows['Cliente'], 'Juan Pérez');
      expect(rows['Cantidad de piezas'], '3');
      expect(rows['Activo'], 'Sí');
      expect(rows.containsKey('Motivo'), isFalse, reason: 'lo vacío se salta');
      expect(rows.containsKey('Extra'), isFalse);
    });

    test('un estado desconocido se muestra tal cual', () {
      final e = _entry('x.status_changed', metadata: {'status': 'estado_nuevo'});
      expect(auditDetailRows(e).single.value, 'estado_nuevo');
    });

    test('resumen: el nombre afectado manda; si no, los primeros datos', () {
      expect(auditSummary(_entry('product.updated', metadata: {'name': '  Mate Mario ', 'x': 1})), 'Mate Mario');
      expect(
        auditSummary(_entry('manual_sale.created', metadata: {'total': 1500, 'customer': 'Feria'})),
        r'Total: $1.500 · Cliente: Feria',
      );
      expect(auditSummary(_entry('order.deleted')), isNull);
      expect(auditSummary(_entry('order.deleted', metadata: <String, dynamic>{})), isNull);
    });

    test('el resumen no muestra ids internos (uuid)', () {
      final e = _entry('team.member_invited', metadata: {'roleId': '9f1c2d3e-0000-4000-8000-000000000001'});
      expect(auditSummary(e), isNull);
      // pero el detalle sí los conserva
      expect(auditDetailRows(e).single.label, 'Rol');
    });

    test('claves anidadas no explotan', () {
      final e = _entry('x.y', metadata: {
        'items': [1, 2, 3],
        'zona': {'name': 'Centro', 'price': 1500},
      });
      final rows = {for (final r in auditDetailRows(e)) r.label: r.value};
      expect(rows['Items'], '1, 2, 3');
      expect(rows['Zona'], 'Name: Centro · Price: 1500');
    });
  });

  group('agrupado por día', () {
    final now = DateTime(2026, 10, 31, 10);
    AuditEntry at(int d, int h) => _entry('product.created', at: DateTime(2026, 10, d, h));

    test('"Hoy", "Ayer" y fecha larga; un título por día', () {
      final rows = groupAuditByDay([at(31, 9), at(31, 8), at(30, 20), at(27, 10)], now);
      expect(rows, hasLength(4 + 3));
      expect(auditDayLabel(DateTime(2026, 10, 31, 5), now), 'Hoy');
      expect(auditDayLabel(DateTime(2026, 10, 30), now), 'Ayer');
      expect(auditDayLabel(DateTime(2026, 10, 27), now), 'Martes 27 de octubre');
    });

    test('lista vacía → sin filas', () {
      expect(groupAuditByDay(const [], now), isEmpty);
    });
  });
}
