// Modelos del módulo Descuentos (`/api/v1/admin/descuentos`). El estado de cada
// cupón (activo / pausado / vencido) lo calcula el servidor con la misma regla
// que el panel web. Parseo defensivo: los numeric llegan como número o String.

import 'package:flutter/material.dart';
import 'package:intl/intl.dart' show DateFormat;

import '../../../core/format.dart';
import '../../../core/theme/app_theme.dart';
import '../crecimiento/form_kit.dart';

double _d(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
int _i(dynamic v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
String? _s(dynamic v) {
  final s = v?.toString().trim();
  return (s == null || s.isEmpty) ? null : s;
}

/// Fecha SIN pasar a hora local. El vencimiento se guarda como "YYYY-MM-DD" a
/// las 00:00 UTC (igual que la web): se muestra y se edita con ese mismo día.
DateTime? _utc(dynamic v) {
  if (v == null) return null;
  final d = DateTime.tryParse('$v');
  return d?.toUtc();
}

enum CouponStatus {
  active('active', 'Activo', 'Activos', Icons.check_circle_rounded, Brand.success),
  paused('paused', 'Pausado', 'Pausados', Icons.pause_circle_rounded, Brand.warning),
  expired('expired', 'Vencido', 'Vencidos', Icons.event_busy_rounded, Brand.danger);

  const CouponStatus(this.api, this.label, this.plural, this.icon, this.color);
  final String api;
  final String label;

  /// Para los filtros de la lista ("Pausados (1)").
  final String plural;
  final IconData icon;
  final Color color;

  static CouponStatus fromApi(String? v) =>
      CouponStatus.values.firstWhere((s) => s.api == v, orElse: () => CouponStatus.active);
}

/// A qué aplica el cupón.
enum CouponScope {
  all('all', 'Todo el carrito'),
  product('product', 'Un producto'),
  category('category', 'Una categoría');

  const CouponScope(this.api, this.label);
  final String api;
  final String label;

  static CouponScope fromApi(String? v) =>
      CouponScope.values.firstWhere((s) => s.api == v, orElse: () => CouponScope.all);
}

/// "30 nov 2026" a partir de un vencimiento (día UTC, ver [_utc]).
String formatExpiry(DateTime d) =>
    DateFormat('d MMM y', 'es_AR').format(DateTime.utc(d.year, d.month, d.day));

/// "2026-11-30" (lo que espera el servidor).
String isoDay(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

class Coupon {
  Coupon({
    required this.id,
    required this.code,
    required this.description,
    required this.isPercent,
    required this.value,
    required this.minPurchase,
    required this.scope,
    required this.targetId,
    required this.targetLabel,
    required this.birthdayOnly,
    required this.maxUses,
    required this.usedCount,
    required this.startsAt,
    required this.expiresAt,
    required this.isActive,
    required this.status,
  });

  final String id;
  final String code;
  final String? description;

  /// true = porcentaje; false = monto fijo en pesos.
  final bool isPercent;
  final double value;
  final double minPurchase;
  final CouponScope scope;
  final String? targetId;
  final String? targetLabel;
  final bool birthdayOnly;

  /// null = sin límite de usos.
  final int? maxUses;
  final int usedCount;
  final DateTime? startsAt;
  final DateTime? expiresAt;
  final bool isActive;
  final CouponStatus status;

  /// "15%" o "$2.000".
  String get valueLabel => isPercent ? '${_trim(value)}%' : formatPrice(value);

  /// Texto de a qué aplica: "Toda la compra", el producto o la categoría.
  String get scopeLabel => switch (scope) {
        CouponScope.all => 'Toda la compra',
        CouponScope.product => targetLabel ?? 'Un producto',
        CouponScope.category => targetLabel ?? 'Una categoría',
      };

  /// Cupón personal generado por un canje de puntos (código PREMIO-XXXXX).
  bool get isRewardCoupon => code.startsWith('PREMIO-');

  /// Fracción de usos consumidos (0 si no tiene tope).
  double get usage => (maxUses == null || maxUses! <= 0) ? 0 : (usedCount / maxUses!).clamp(0.0, 1.0);

  /// Todavía no empezó (la web no lo distingue, pero ayuda a no confundirse).
  bool get notStarted => startsAt != null && startsAt!.isAfter(DateTime.now());

  factory Coupon.fromJson(Map<String, dynamic> j) => Coupon(
        id: '${j['id']}',
        code: _s(j['code']) ?? '—',
        description: _s(j['description']),
        isPercent: j['type'] == 'percentage',
        value: _d(j['value']),
        minPurchase: _d(j['minPurchase']),
        scope: CouponScope.fromApi(j['scope'] as String?),
        targetId: _s(j['targetId']),
        targetLabel: _s(j['targetLabel']),
        birthdayOnly: j['birthdayOnly'] == true,
        maxUses: j['maxUses'] == null ? null : _i(j['maxUses']),
        usedCount: _i(j['usedCount']),
        startsAt: _utc(j['startsAt']),
        expiresAt: _utc(j['expiresAt']),
        isActive: j['isActive'] != false,
        status: CouponStatus.fromApi(j['status'] as String?),
      );

  /// Texto para buscar: código y descripción.
  bool matches(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return true;
    return code.toLowerCase().contains(q) ||
        (description ?? '').toLowerCase().contains(q) ||
        (targetLabel ?? '').toLowerCase().contains(q);
  }

  /// Link directo a la tienda con el cupón ya aplicado (igual que la web).
  String shareLink(String siteUrl) => '$siteUrl/catalogo?cupon=${Uri.encodeQueryComponent(code)}';
}

String _trim(double v) => v == v.roundToDouble() ? '${v.round()}' : v.toString().replaceAll('.', ',');

class CouponCounts {
  CouponCounts({this.total = 0, this.active = 0, this.paused = 0, this.expired = 0, this.uses = 0});
  final int total;
  final int active;
  final int paused;
  final int expired;
  final int uses;

  int of(CouponStatus? s) => switch (s) {
        null => total,
        CouponStatus.active => active,
        CouponStatus.paused => paused,
        CouponStatus.expired => expired,
      };

  factory CouponCounts.fromJson(Map<String, dynamic> j) => CouponCounts(
        total: _i(j['total']),
        active: _i(j['active']),
        paused: _i(j['paused']),
        expired: _i(j['expired']),
        uses: _i(j['uses']),
      );
}

class CouponsPage {
  CouponsPage({required this.items, required this.counts});
  final List<Coupon> items;
  final CouponCounts counts;

  factory CouponsPage.fromJson(Map<String, dynamic> j) {
    final items = ((j['items'] as List?) ?? [])
        .whereType<Map>()
        .map((e) => Coupon.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    return CouponsPage(
      items: items,
      counts: j['counts'] is Map
          ? CouponCounts.fromJson(Map<String, dynamic>.from(j['counts'] as Map))
          : CouponCounts(total: items.length),
    );
  }
}

/// Productos y categorías para elegir a qué aplica un cupón.
class CouponOptions {
  CouponOptions({required this.products, required this.categories});
  final List<IdName> products;
  final List<IdName> categories;

  factory CouponOptions.fromJson(Map<String, dynamic> j) {
    List<IdName> list(dynamic raw) => ((raw as List?) ?? [])
        .whereType<Map>()
        .map((e) => IdName.fromJson(Map<String, dynamic>.from(e)))
        .where((o) => o.id.isNotEmpty)
        .toList();
    return CouponOptions(products: list(j['products']), categories: list(j['categories']));
  }
}
