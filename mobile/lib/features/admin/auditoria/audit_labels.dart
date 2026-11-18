import 'package:flutter/material.dart';

import '../../../core/format.dart';
import '../../../core/theme/app_theme.dart';
import '../sale_status.dart';
import 'audit_models.dart';

/// Traducción de los códigos de acción del registro a castellano. Es la misma
/// lista que la web (`src/core/audit/labels.ts`) pero redactada para la
/// pantalla del celular ("Cambió el estado de un pedido"). Un código que la app
/// no conoce cae al texto que arma el servidor y, en última instancia, a una
/// versión legible del propio código.
const Map<String, String> auditActionLabels = {
  'order.status_changed': 'Cambió el estado de un pedido',
  'order.meta_updated': 'Editó los datos de un pedido',
  'order.deleted': 'Borró un pedido',
  'order.bulk_deleted': 'Borró varios pedidos',
  'product.created': 'Creó un producto',
  'product.updated': 'Editó un producto',
  'product.deleted': 'Borró un producto',
  'product.published': 'Publicó un producto',
  'product.archived': 'Archivó un producto',
  'category.created': 'Creó una categoría',
  'category.updated': 'Editó una categoría',
  'category.deleted': 'Borró una categoría',
  'coupon.created': 'Creó un cupón',
  'coupon.updated': 'Editó un cupón',
  'coupon.deleted': 'Borró un cupón',
  'reward.created': 'Creó una recompensa',
  'reward.updated': 'Editó una recompensa',
  'reward.deleted': 'Borró una recompensa',
  'settings.updated': 'Cambió la configuración',
  'manual_sale.created': 'Cargó una venta manual',
  'manual_sale.updated': 'Editó una venta manual',
  'manual_sale.deleted': 'Borró una venta manual',
  'manual_sale.imported': 'Importó ventas manuales',
  'manual_sale.status_changed': 'Cambió el estado de una venta manual',
  'sales.bulk_deleted': 'Borró varias ventas',
  'inventory.failure_registered': 'Registró una impresión fallida',
  'inventory.failure_deleted': 'Borró una impresión fallida',
  'inventory.order_deduct_failed': 'Falló el descuento de stock de un pedido',
  'inventory.order_deduct_partial': 'Descontó stock solo en parte en un pedido',
  'inventory.order_restore_failed': 'Falló la reposición de stock de un pedido',
  'inventory.manual_sale_deduct_failed': 'Falló el descuento de stock de una venta manual',
  'inventory.manual_sale_no_deduct': 'Venta manual sin descuento de stock',
  'team.member_invited': 'Invitó a una persona al equipo',
  'team.member_promoted': 'Dio acceso al panel a un cliente',
  'inventory.filament_created': 'Cargó un filamento',
  'inventory.filament_updated': 'Editó un filamento',
  'inventory.filament_deleted': 'Borró un filamento',
  'inventory.stock_adjusted': 'Ajustó el stock de un filamento',
  'profit_shares.updated': 'Cambió el reparto entre socios',
  'cost_settings.updated': 'Cambió los costos de producción',
  'team.invite_resent': 'Reenvió una invitación al equipo',
  // La registra el servidor cuando un cliente da de baja su cuenta desde la
  // app (2026-11-14). No tiene actor: la cuenta ya no existe.
  'account.deleted': 'Un cliente eliminó su cuenta',
  // Consultas y arreglos (2026-11-17).
  'inquiry.created': 'Cargó una consulta',
  'inquiry.answered': 'Respondió una consulta',
  'inquiry.status_changed': 'Cambió el estado de una consulta',
  'inquiry.deleted': 'Borró una consulta',
  'fix.created': 'Cargó un arreglo',
  'fix.updated': 'Cambió el estado de un arreglo',
  'fix.deleted': 'Borró un arreglo',
  // Pendientes del equipo, en Ventas (2026-11-17).
  'team_task.created': 'Anotó un pendiente',
  'team_task.done': 'Tildó un pendiente como hecho',
  'team_task.reopened': 'Volvió a abrir un pendiente',
  'team_task.deleted': 'Borró un pendiente',
};

final RegExp _uuid = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  caseSensitive: false,
);

String _capitalize(String s) => s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';

/// "order.x_y" → "Order: x y" (último recurso, igual que la web).
String humanizeActionCode(String code) {
  final parts = code.split('.');
  final head = parts.first.replaceAll('_', ' ');
  final verb = parts.skip(1).join(' ').replaceAll('_', ' ');
  return '${_capitalize(head)}${verb.isEmpty ? '' : ': $verb'}';
}

/// Texto en castellano de una acción.
String auditActionLabel(String code, {String? serverLabel}) =>
    auditActionLabels[code] ?? ((serverLabel?.trim().isNotEmpty ?? false) ? serverLabel!.trim() : humanizeActionCode(code));

/// Cómo se llama cada tipo de entidad.
const Map<String, String> auditEntityLabels = {
  'order': 'Pedido',
  'product': 'Producto',
  'category': 'Categoría',
  'coupon': 'Cupón',
  'reward': 'Recompensa',
  'manual_sale': 'Venta manual',
  'sales': 'Ventas',
  'filament': 'Filamento',
  'inventory': 'Stock',
  'team': 'Equipo',
  'settings': 'Configuración',
  // `account.deleted` (baja de cuenta desde la app) viene con este tipo.
  'customer': 'Cliente',
};

/// La baja de una cuenta no tiene autor en el registro (la cuenta ya no
/// existe), pero no la hizo "el sistema": la pidió el propio cliente.
bool _bySelf(String action) => action == 'account.deleted';

/// Cómo se nombra a quien hizo un evento SIN autor.
String auditNoActorName(String action) => _bySelf(action) ? 'El propio cliente' : 'Sistema';

/// Aclaración debajo del nombre, en el detalle de un evento sin autor.
String auditNoActorHint(String action) => _bySelf(action)
    ? 'Dio de baja su cuenta desde la app. La cuenta ya no existe.'
    : 'Lo hizo la tienda sola, sin una persona del equipo.';

/// Ícono de quien hizo un evento sin autor (robot = sistema).
IconData auditNoActorIcon(String action, {bool filled = false}) => _bySelf(action)
    ? (filled ? Icons.person_off_rounded : Icons.person_off_outlined)
    : Icons.smart_toy_outlined;

String auditEntityLabel(String? type) {
  if (type == null || type.isEmpty) return 'General';
  return auditEntityLabels[type] ?? _capitalize(type.replaceAll('_', ' '));
}

/// Qué tipo de cosa pasó: define el ícono y el color de la fila.
enum AuditKind {
  created(Icons.add_circle_rounded, 'Alta'),
  updated(Icons.edit_rounded, 'Cambio'),
  deleted(Icons.delete_rounded, 'Baja'),
  status(Icons.swap_horiz_rounded, 'Estado'),
  warning(Icons.warning_amber_rounded, 'Aviso'),
  team(Icons.group_rounded, 'Equipo'),
  settings(Icons.settings_rounded, 'Configuración'),
  other(Icons.history_rounded, 'Otro');

  const AuditKind(this.icon, this.label);
  final IconData icon;
  final String label;

  Color get color => switch (this) {
        AuditKind.created => Brand.success,
        AuditKind.updated => Brand.info,
        AuditKind.deleted => Brand.danger,
        AuditKind.status => Brand.gold,
        AuditKind.warning => Brand.warning,
        AuditKind.team => const Color(0xFF8B7CF6),
        AuditKind.settings => const Color(0xFF3FB8AF),
        AuditKind.other => const Color(0xFF8D8C99),
      };
}

/// Clasifica un código de acción (`scope.verbo`) por lo que significa.
AuditKind auditKindOf(String code) {
  final parts = code.split('.');
  final scope = parts.first;
  final verb = parts.length > 1 ? parts.sublist(1).join('.') : '';
  if (verb.contains('failed') || verb.contains('partial') || verb.contains('no_deduct')) {
    return AuditKind.warning;
  }
  if (scope == 'team') return AuditKind.team;
  if (scope == 'settings') return AuditKind.settings;
  // Tildar / destildar un pendiente es un cambio de estado.
  if (verb.contains('status') || verb == 'done' || verb == 'reopened') return AuditKind.status;
  if (verb.contains('deleted') || verb.contains('archived')) return AuditKind.deleted;
  if (verb.contains('created') || verb.contains('imported') || verb.contains('registered') || verb.contains('published')) {
    return AuditKind.created;
  }
  // Responder una consulta es completar sus datos: mismo ícono que una edición.
  if (verb.contains('updated') || verb.contains('adjusted') || verb.contains('answered')) {
    return AuditKind.updated;
  }
  return AuditKind.other;
}

/// Etiquetas de las claves habituales del detalle.
const Map<String, String> _keyLabels = {
  'total': 'Total',
  'customer': 'Cliente',
  'status': 'Estado',
  'name': 'Nombre',
  'count': 'Cantidad',
  'reason': 'Motivo',
  'grams': 'Gramos',
  'orderNumber': 'Pedido',
  'email': 'Email',
  'roleId': 'Rol',
  'note': 'Nota',
  // Baja de cuenta: si tenía compras, se conservan sin sus datos personales.
  'ordersKept': 'Se conservaron sus pedidos',
};

/// "camelCase" / "snake_case" → "Camel case" para claves que no conocemos.
String humanizeKey(String key) {
  final spaced = key
      .replaceAllMapped(RegExp(r'([a-z0-9])([A-Z])'), (m) => '${m[1]} ${m[2]}')
      .replaceAll('_', ' ')
      .toLowerCase();
  return _capitalize(spaced);
}

String _formatValue(String key, Object? v) {
  if (v is bool) return v ? 'Sí' : 'No';
  if (key == 'total' && num.tryParse('$v') != null) return formatPrice(num.parse('$v'));
  if (key == 'status' && v is String) {
    for (final s in SaleStatus.values) {
      if (s.api == v) return s.label;
    }
  }
  if (v is Map || v is List) {
    if (v is List && v.every((e) => e is! Map && e is! List)) return v.join(', ');
    if (v is Map && v.values.every((e) => e is! Map && e is! List)) {
      return v.entries.map((e) => '${humanizeKey('${e.key}')}: ${e.value}').join(' · ');
    }
    return '$v';
  }
  return '$v';
}

/// Filas "Etiqueta → valor" del detalle, en castellano. Salta lo vacío.
List<({String label, String value})> auditDetailRows(AuditEntry e) {
  final meta = e.metadata;
  if (meta is Map) {
    return [
      for (final entry in meta.entries)
        if (entry.value != null && '${entry.value}'.trim().isNotEmpty)
          (
            label: _keyLabels['${entry.key}'] ?? humanizeKey('${entry.key}'),
            value: _formatValue('${entry.key}', entry.value),
          ),
    ];
  }
  if (meta != null && '$meta'.trim().isNotEmpty) {
    return [(label: 'Detalle', value: '$meta')];
  }
  return const [];
}

/// Resumen corto para la lista: el nombre afectado si hay, si no los primeros
/// datos (igual que la columna "Detalle" de la web). Null si no hay nada.
String? auditSummary(AuditEntry e, {int maxParts = 3}) {
  final meta = e.metadata;
  if (meta is Map) {
    final name = meta['name'];
    if (name is String && name.trim().isNotEmpty) return name.trim();
  }
  // Un id interno (uuid) no le dice nada al dueño: va solo en el detalle.
  final rows = auditDetailRows(e).where((r) => !_uuid.hasMatch(r.value)).toList();
  if (rows.isEmpty) return null;
  return rows.take(maxParts).map((r) => '${r.label}: ${r.value}').join(' · ');
}
