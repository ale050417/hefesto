import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import 'descuentos_models.dart';

// Sin reintentos automáticos: si falla, la pantalla muestra el error al
// instante con su botón "Reintentar".
Duration? _noRetry(int count, Object error) => null;

/// Cupones con su estado y usos.
final adminCouponsProvider = FutureProvider.autoDispose<CouponsPage>(
  (ref) async => CouponsPage.fromJson(
    await ref.watch(apiClientProvider).getJson('/admin/descuentos'),
  ),
  retry: _noRetry,
);

/// Productos y categorías (se piden recién al elegir a qué aplica un cupón).
final adminCouponOptionsProvider = FutureProvider.autoDispose<CouponOptions>(
  (ref) async => CouponOptions.fromJson(
    await ref.watch(apiClientProvider).getJson('/admin/descuentos/opciones'),
  ),
  retry: _noRetry,
);

/// Cuerpo de un cupón para crear o editar. El servidor valida igual que la web.
Map<String, dynamic> couponBody({
  required String code,
  required String description,
  required bool isPercent,
  required double value,
  required double minPurchase,
  required int? maxUses,
  required DateTime? startsAt,
  required DateTime? expiresAt,
  required bool isActive,
  required CouponScope scope,
  required String? targetId,
  required String? targetLabel,
  required bool birthdayOnly,
}) =>
    {
      'code': code.trim().toUpperCase(),
      'description': description.trim(),
      'type': isPercent ? 'percentage' : 'fixed',
      'value': value,
      'minPurchase': minPurchase,
      'maxUses': maxUses,
      // Se conserva el inicio de vigencia que ya tenía (la app no lo edita).
      'startsAt': startsAt?.toUtc().toIso8601String(),
      // Igual que la web: solo el día ("YYYY-MM-DD"); vacío = sin vencimiento.
      'expiresAt': expiresAt == null ? '' : isoDay(expiresAt),
      'isActive': isActive,
      'scope': scope.api,
      'targetId': scope == CouponScope.all ? null : targetId,
      'targetLabel': scope == CouponScope.all ? null : targetLabel,
      'birthdayOnly': birthdayOnly,
    };

Future<void> createCoupon(ApiClient api, Map<String, dynamic> body) async {
  await api.sendJson('POST', '/admin/descuentos', body: body);
}

Future<void> updateCoupon(ApiClient api, String id, Map<String, dynamic> body) async {
  await api.sendJson('PUT', '/admin/descuentos/$id', body: body);
}

Future<void> setCouponActive(ApiClient api, String id, bool isActive) async {
  await api.sendJson('PATCH', '/admin/descuentos/$id/estado', body: {'isActive': isActive});
}

Future<void> deleteCoupon(ApiClient api, String id) async {
  await api.sendJson('DELETE', '/admin/descuentos/$id');
}
