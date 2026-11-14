import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import 'recompensas_models.dart';

// Sin reintentos automáticos: si falla, la pantalla muestra el error al
// instante con su botón "Reintentar".
Duration? _noRetry(int count, Object error) => null;

/// Programa de puntos: reglas, estadísticas, catálogo y últimos canjes.
final adminRewardsProvider = FutureProvider.autoDispose<RewardsPage>(
  (ref) async => RewardsPage.fromJson(
    await ref.watch(apiClientProvider).getJson('/admin/recompensas'),
  ),
  retry: _noRetry,
);

/// Cuerpo de una recompensa para crear o editar. El servidor valida igual que
/// la web (y además exige valor en los descuentos y producto en los regalos).
Map<String, dynamic> rewardBody({
  required RewardType type,
  required String title,
  required String description,
  required int costPoints,
  required double? discountValue,
  required bool discountIsPercent,
  required String? productId,
  required bool isActive,
}) =>
    {
      'type': type.api,
      'title': title.trim(),
      'description': description.trim(),
      'costPoints': costPoints,
      'discountValue': type == RewardType.discount ? discountValue : null,
      'discountIsPercent': type == RewardType.discount ? discountIsPercent : false,
      'productId': type == RewardType.product ? productId : null,
      'isActive': isActive,
    };

/// Cuerpo para guardar una recompensa tal cual está, cambiando solo si está activa.
Map<String, dynamic> rewardBodyWithActive(Reward r, bool isActive) => rewardBody(
      type: r.type,
      title: r.title,
      description: r.description ?? '',
      costPoints: r.costPoints,
      discountValue: r.discountValue,
      discountIsPercent: r.discountIsPercent,
      productId: r.productId,
      isActive: isActive,
    );

Future<void> createReward(ApiClient api, Map<String, dynamic> body) async {
  await api.sendJson('POST', '/admin/recompensas', body: body);
}

Future<void> updateReward(ApiClient api, String id, Map<String, dynamic> body) async {
  await api.sendJson('PUT', '/admin/recompensas/$id', body: body);
}

Future<void> deleteReward(ApiClient api, String id) async {
  await api.sendJson('DELETE', '/admin/recompensas/$id');
}
