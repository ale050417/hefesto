import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import 'pendientes_models.dart';

/// Llamadas a `/api/v1/admin/pendientes*` (permisos del módulo `pedidos`).
/// Lanzan `ApiException` con el mensaje en castellano del servidor.
class PendientesApi {
  PendientesApi(this._api);
  final ApiClient _api;

  Future<PendientesData> list() async => PendientesData.fromJson(await _api.getJson('/admin/pendientes'));

  /// Anota un pendiente (pedidos/crear).
  Future<TeamTask> create(String body) async =>
      TeamTask.fromJson(await _api.sendJson('POST', '/admin/pendientes', body: {'body': body.trim()}));

  /// Tilda o destilda (pedidos/crear; cualquiera del equipo).
  Future<TeamTask> setDone(String id, bool done) async =>
      TeamTask.fromJson(await _api.sendJson('PATCH', '/admin/pendientes/$id', body: {'done': done}));

  /// Borra: quien lo anotó o quien tiene pedidos/eliminar (si no, 403).
  Future<void> delete(String id) async {
    await _api.sendJson('DELETE', '/admin/pendientes/$id');
  }
}

final pendientesApiProvider = Provider<PendientesApi>((ref) => PendientesApi(ref.watch(apiClientProvider)));

Duration? _noRetry(int count, Object error) => null;

final pendientesProvider = FutureProvider.autoDispose<PendientesData>(
  (ref) => ref.watch(pendientesApiProvider).list(),
  retry: _noRetry,
);

/// Tras anotar, tildar o borrar: se vuelve a pedir la lista. (Con el
/// contenedor y no con el `ref` de la pantalla, que puede haberse cerrado
/// mientras el servidor respondía.)
void invalidatePendientes(ProviderContainer container) {
  container.invalidate(pendientesProvider);
}
