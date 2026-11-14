// Modelos del módulo Clientes (`/api/v1/admin/clientes`). El servidor decide y
// calcula todo (nivel, gastado, pedidos); la app solo lo muestra. Parseo
// defensivo: numeric de Postgres puede llegar como String, y puede haber nulls.

import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../sale_status.dart';

double _d(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
int _i(dynamic v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
DateTime _t(dynamic v) => DateTime.tryParse('$v')?.toLocal() ?? DateTime.now();
String? _s(dynamic v) {
  final s = v?.toString().trim();
  return (s == null || s.isEmpty) ? null : s;
}

/// Nivel del cliente (gold = VIP, silver = Frecuente, bronze = Nuevo). Lo
/// calcula el servidor con el gasto y la cantidad de pedidos.
enum CustomerTier {
  gold('gold', 'VIP', Icons.workspace_premium_rounded, Brand.gold),
  silver('silver', 'Frecuente', Icons.favorite_rounded, Brand.info),
  bronze('bronze', 'Nuevo', Icons.fiber_new_rounded, Brand.warning);

  const CustomerTier(this.api, this.label, this.icon, this.color);
  final String api;
  final String label;
  final IconData icon;
  final Color color;

  static CustomerTier fromApi(String? v) =>
      CustomerTier.values.firstWhere((t) => t.api == v, orElse: () => CustomerTier.bronze);
}

/// Un cliente: registrado (tiene cuenta) o manual (cargado a mano).
class Customer {
  Customer({
    required this.id,
    required this.source,
    required this.name,
    required this.email,
    required this.phone,
    required this.city,
    required this.note,
    required this.since,
    required this.orders,
    required this.spent,
    required this.tier,
  });

  final String id;

  /// `registered` o `manual`.
  final String source;
  final String name;
  final String? email;
  final String? phone;
  final String? city;
  final String? note;
  final DateTime since;
  final int orders;
  final double spent;
  final CustomerTier tier;

  bool get isManual => source == 'manual';

  /// Dato de contacto para mostrar bajo el nombre (igual que la grilla web).
  String get contactLine => phone ?? email ?? city ?? 'Sin contacto';

  factory Customer.fromJson(Map<String, dynamic> j) => Customer(
        id: '${j['id']}',
        source: j['source'] == 'manual' ? 'manual' : 'registered',
        name: _s(j['name']) ?? 'Sin nombre',
        email: _s(j['email']),
        phone: _s(j['phone']),
        city: _s(j['city']),
        note: _s(j['note']),
        since: _t(j['since']),
        orders: _i(j['orders']),
        spent: _d(j['spent']),
        tier: CustomerTier.fromApi(j['tier'] as String?),
      );

  /// ¿Coincide con lo que se tipeó en el buscador? Mismo criterio que el
  /// servidor (nombre, email, ciudad y teléfono ignorando espacios y guiones).
  bool matches(String query) {
    final needle = query.trim().toLowerCase();
    if (needle.isEmpty) return true;
    if (name.toLowerCase().contains(needle)) return true;
    if ((email ?? '').toLowerCase().contains(needle)) return true;
    if ((city ?? '').toLowerCase().contains(needle)) return true;
    final p = phone ?? '';
    if (p.toLowerCase().contains(needle)) return true;
    final digits = needle.replaceAll(RegExp(r'\D'), '');
    return digits.length >= 3 && p.replaceAll(RegExp(r'\D'), '').contains(digits);
  }
}

/// Qué hace falta para llegar a un nivel (viene de `tier.ts` del servidor).
class TierRule {
  TierRule({required this.label, required this.minSpent, required this.minOrders});
  final String label;
  final double minSpent;
  final int minOrders;

  factory TierRule.fromJson(Map<String, dynamic> j) => TierRule(
        label: _s(j['label']) ?? '',
        minSpent: _d(j['minSpent']),
        minOrders: _i(j['minOrders']),
      );
}

class CustomerCounts {
  CustomerCounts({this.all = 0, this.gold = 0, this.silver = 0, this.bronze = 0});
  final int all;
  final int gold;
  final int silver;
  final int bronze;

  int of(CustomerTier? t) => switch (t) {
        null => all,
        CustomerTier.gold => gold,
        CustomerTier.silver => silver,
        CustomerTier.bronze => bronze,
      };

  factory CustomerCounts.fromJson(Map<String, dynamic> j) => CustomerCounts(
        all: _i(j['all']),
        gold: _i(j['gold']),
        silver: _i(j['silver']),
        bronze: _i(j['bronze']),
      );
}

/// Lista completa de clientes (la búsqueda y el filtro se hacen en el celu).
class CustomersPage {
  CustomersPage({
    required this.items,
    required this.counts,
    required this.totalSpent,
    required this.tiers,
  });
  final List<Customer> items;
  final CustomerCounts counts;
  final double totalSpent;
  final Map<CustomerTier, TierRule> tiers;

  factory CustomersPage.fromJson(Map<String, dynamic> j) {
    final items = ((j['items'] as List?) ?? [])
        .whereType<Map>()
        .map((e) => Customer.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    final rawTiers = (j['tiers'] as Map?) ?? const {};
    return CustomersPage(
      items: items,
      counts: j['counts'] is Map
          ? CustomerCounts.fromJson(Map<String, dynamic>.from(j['counts'] as Map))
          : CustomerCounts(all: items.length),
      totalSpent: _d(j['totalSpent']),
      tiers: {
        for (final t in CustomerTier.values)
          if (rawTiers[t.api] is Map)
            t: TierRule.fromJson(Map<String, dynamic>.from(rawTiers[t.api] as Map)),
      },
    );
  }
}

/// Un pedido del historial del cliente.
class CustomerOrder {
  CustomerOrder({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.total,
    required this.createdAt,
  });
  final String id;
  final String orderNumber;
  final SaleStatus status;
  final double total;
  final DateTime createdAt;

  factory CustomerOrder.fromJson(Map<String, dynamic> j) => CustomerOrder(
        id: '${j['id']}',
        orderNumber: _s(j['orderNumber']) ?? '—',
        status: SaleStatus.fromApi(j['status'] as String?),
        total: _d(j['total']),
        createdAt: _t(j['createdAt']),
      );
}

class PointsRedemption {
  PointsRedemption({
    required this.id,
    required this.reason,
    required this.points,
    required this.createdAt,
  });
  final String id;
  final String reason;
  final int points;
  final DateTime createdAt;

  factory PointsRedemption.fromJson(Map<String, dynamic> j) => PointsRedemption(
        id: '${j['id']}',
        reason: _s(j['reason']) ?? 'Canje',
        points: _i(j['points']),
        createdAt: _t(j['createdAt']),
      );
}

/// Puntos de fidelidad del cliente (los manuales no tienen cuenta ni puntos).
class PointsSummary {
  PointsSummary({
    this.balance = 0,
    this.earned = 0,
    this.redeemed = 0,
    this.redemptions = const [],
  });
  final int balance;
  final int earned;
  final int redeemed;
  final List<PointsRedemption> redemptions;

  factory PointsSummary.fromJson(Map<String, dynamic> j) => PointsSummary(
        balance: _i(j['balance']),
        earned: _i(j['earned']),
        redeemed: _i(j['redeemed']),
        redemptions: ((j['redemptions'] as List?) ?? [])
            .whereType<Map>()
            .map((e) => PointsRedemption.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
      );
}

class CustomerDetail {
  CustomerDetail({required this.customer, required this.orders, required this.points});
  final Customer customer;
  final List<CustomerOrder> orders;
  final PointsSummary points;

  factory CustomerDetail.fromJson(Map<String, dynamic> j) => CustomerDetail(
        customer: Customer.fromJson(Map<String, dynamic>.from(j['customer'] as Map)),
        orders: ((j['orders'] as List?) ?? [])
            .whereType<Map>()
            .map((e) => CustomerOrder.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
        points: j['points'] is Map
            ? PointsSummary.fromJson(Map<String, dynamic>.from(j['points'] as Map))
            : PointsSummary(),
      );
}

/// "+54 3757 62-4148" → "543757624148" para wa.me (mismo criterio que el
/// detalle de ventas: número argentino sin 0 inicial y con prefijo 549 si no
/// trae el código de país).
String customerWaNumber(String phone) {
  var d = phone.replaceAll(RegExp(r'\D'), '');
  if (d.startsWith('00')) d = d.substring(2);
  if (d.startsWith('54')) return d;
  if (d.startsWith('0')) d = d.substring(1);
  return '549$d';
}
