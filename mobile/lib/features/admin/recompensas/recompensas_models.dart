// Modelos del módulo Recompensas (`/api/v1/admin/recompensas`): reglas del
// programa de puntos, estadísticas, catálogo de premios y últimos canjes.
// Parseo defensivo: los numeric llegan como número o String, y puede haber nulls.

import 'package:flutter/material.dart';

import '../../../core/format.dart';
import '../../../core/theme/app_theme.dart';
import '../crecimiento/form_kit.dart';

double _d(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
int _i(dynamic v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
DateTime _t(dynamic v) => DateTime.tryParse('$v')?.toLocal() ?? DateTime.now();
String? _s(dynamic v) {
  final s = v?.toString().trim();
  return (s == null || s.isEmpty) ? null : s;
}

/// Tipo de premio. Los colores salen de la paleta de marca.
enum RewardType {
  shipping('shipping', 'Envío gratis', Icons.local_shipping_rounded, Brand.info),
  discount('discount', 'Descuento', Icons.sell_rounded, Brand.gold),
  product('product', 'Producto gratis', Icons.card_giftcard_rounded, Brand.success);

  const RewardType(this.api, this.label, this.icon, this.color);
  final String api;
  final String label;
  final IconData icon;
  final Color color;

  static RewardType fromApi(String? v) =>
      RewardType.values.firstWhere((t) => t.api == v, orElse: () => RewardType.discount);
}

class Reward {
  Reward({
    required this.id,
    required this.type,
    required this.title,
    required this.description,
    required this.costPoints,
    required this.discountValue,
    required this.discountIsPercent,
    required this.productId,
    required this.productName,
    required this.isActive,
  });

  final String id;
  final RewardType type;
  final String title;
  final String? description;
  final int costPoints;
  final double? discountValue;
  final bool discountIsPercent;
  final String? productId;
  final String? productName;

  /// Pausada = el cliente no la ve en "Canjear puntos".
  final bool isActive;

  /// Qué recibe el cliente, en una línea ("$2.000 de descuento", "15% de descuento"…).
  String get benefitLabel => switch (type) {
        RewardType.shipping => 'Envío gratis en su próximo pedido',
        RewardType.discount => discountValue == null
            ? 'Descuento'
            : discountIsPercent
                ? '${plainNumber(discountValue!)}% de descuento'
                : '${formatPrice(discountValue!)} de descuento',
        RewardType.product => productName ?? 'Producto de regalo',
      };

  factory Reward.fromJson(Map<String, dynamic> j) => Reward(
        id: '${j['id']}',
        type: RewardType.fromApi(j['type'] as String?),
        title: _s(j['title']) ?? 'Recompensa',
        description: _s(j['description']),
        costPoints: _i(j['costPoints']),
        discountValue: j['discountValue'] == null ? null : _d(j['discountValue']),
        discountIsPercent: j['discountIsPercent'] == true,
        productId: _s(j['productId']),
        productName: _s(j['productName']),
        isActive: j['isActive'] != false,
      );
}

/// Estadísticas globales de puntos.
class RewardsStats {
  RewardsStats({this.inCirculation = 0, this.redemptions = 0, this.pointsRedeemed = 0});
  final int inCirculation;
  final int redemptions;
  final int pointsRedeemed;

  factory RewardsStats.fromJson(Map<String, dynamic> j) => RewardsStats(
        inCirculation: _i(j['inCirculation']),
        redemptions: _i(j['redemptions']),
        pointsRedeemed: _i(j['pointsRedeemed']),
      );
}

/// Reglas del programa de puntos (fijas en el servidor).
class ProgramRules {
  ProgramRules({this.pointsPerAmount = 100, this.moneyPerPoint = 1});

  /// Pesos de compra que dan 1 punto.
  final int pointsPerAmount;

  /// Pesos que vale 1 punto al canjear.
  final int moneyPerPoint;

  factory ProgramRules.fromJson(Map<String, dynamic> j) => ProgramRules(
        pointsPerAmount: _i(j['pointsPerAmount']) > 0 ? _i(j['pointsPerAmount']) : 100,
        moneyPerPoint: _i(j['moneyPerPoint']) > 0 ? _i(j['moneyPerPoint']) : 1,
      );
}

/// Un canje de puntos hecho por un cliente.
class Redemption {
  Redemption({
    required this.id,
    required this.customerId,
    required this.customerName,
    required this.reason,
    required this.points,
    required this.createdAt,
  });
  final String id;
  final String customerId;
  final String? customerName;
  final String reason;
  final int points;
  final DateTime createdAt;

  factory Redemption.fromJson(Map<String, dynamic> j) => Redemption(
        id: '${j['id']}',
        customerId: '${j['customerId']}',
        customerName: _s(j['customerName']),
        reason: _s(j['reason']) ?? 'Canje',
        points: _i(j['points']),
        createdAt: _t(j['createdAt']),
      );
}

class RewardsPage {
  RewardsPage({
    required this.program,
    required this.stats,
    required this.rewards,
    required this.products,
    required this.recentRedemptions,
  });
  final ProgramRules program;
  final RewardsStats stats;
  final List<Reward> rewards;

  /// Productos publicados, para elegir el regalo.
  final List<IdName> products;
  final List<Redemption> recentRedemptions;

  factory RewardsPage.fromJson(Map<String, dynamic> j) {
    List<T> list<T>(dynamic raw, T Function(Map<String, dynamic>) f) =>
        ((raw as List?) ?? []).whereType<Map>().map((e) => f(Map<String, dynamic>.from(e))).toList();
    return RewardsPage(
      program: j['program'] is Map
          ? ProgramRules.fromJson(Map<String, dynamic>.from(j['program'] as Map))
          : ProgramRules(),
      stats: j['stats'] is Map
          ? RewardsStats.fromJson(Map<String, dynamic>.from(j['stats'] as Map))
          : RewardsStats(),
      rewards: list(j['rewards'], Reward.fromJson),
      products: list(j['products'], IdName.fromJson).where((p) => p.id.isNotEmpty).toList(),
      recentRedemptions: list(j['recentRedemptions'], Redemption.fromJson),
    );
  }
}
