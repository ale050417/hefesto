import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import '../admin_providers.dart';
import '../filamentos/filamentos_api.dart' show invalidateFilamentos;
import 'fallas_models.dart';

/// Llamadas a `/api/v1/admin/fallas/*`. Lanzan `ApiException` con el mensaje en
/// castellano del servidor.
class FallasApi {
  FallasApi(this._api);
  final ApiClient _api;

  Future<FallasData> list() async => FallasData.fromJson(await _api.getJson('/admin/fallas'));

  Future<FallaResult> create(FallaDraft d) async =>
      FallaResult.fromJson(await _api.sendJson('POST', '/admin/fallas', body: d.toCreateJson()));

  Future<void> update(String id, FallaDraft d) async {
    await _api.sendJson('PATCH', '/admin/fallas/$id', body: d.toUpdateJson());
  }

  /// Elimina la falla; el servidor devuelve al stock lo que había descontado
  /// y responde cuántos gramos repuso.
  Future<double> delete(String id) async {
    final json = await _api.sendJson('DELETE', '/admin/fallas/$id');
    final v = json['restored'];
    return v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
  }
}

final fallasApiProvider = Provider<FallasApi>((ref) => FallasApi(ref.watch(apiClientProvider)));

Duration? _noRetry(int count, Object error) => null;

final fallasProvider = FutureProvider.autoDispose<FallasData>(
  (ref) => ref.watch(fallasApiProvider).list(),
  retry: _noRetry,
);

/// Registrar o borrar una falla mueve stock: además del listado de fallas hay
/// que refrescar el stock, el inicio y el historial de filamentos.
/// (Con el contenedor y no con el `ref` de la pantalla: ver `invalidateFilamentos`.)
void invalidateFallas(ProviderContainer container) {
  container.invalidate(fallasProvider);
  invalidateFilamentos(container);
  container.invalidate(adminDashboardProvider);
}
