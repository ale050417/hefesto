import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/photo_picker.dart';
import '../filamentos/parse_util.dart';
import 'arreglos_models.dart';

/// Llamadas a `/api/v1/admin/arreglos/*`. Lanzan `ApiException` con el mensaje
/// en castellano del servidor.
class ArreglosApi {
  ArreglosApi(this._api);
  final ApiClient _api;

  Future<ArreglosData> list() async => ArreglosData.fromJson(await _api.getJson('/admin/arreglos'));

  /// Carga el arreglo (sin fotos: se suben después, de a una).
  Future<Arreglo> create(ArregloDraft d) async =>
      Arreglo.fromJson(await _api.sendJson('POST', '/admin/arreglos', body: d.toJson()));

  /// Suma UNA foto al arreglo y devuelve su dirección.
  Future<String> addImage(String id, PickedPhoto photo) async {
    final json = await _api.uploadImage(
      '/admin/arreglos/$id/images',
      bytes: photo.bytes,
      filename: photo.filename,
    );
    return strOf(json['url']);
  }

  /// Estado + respuesta del dueño.
  Future<void> update(String id, FixStatus status, String note) async {
    await _api.sendJson('PATCH', '/admin/arreglos/$id', body: arregloUpdateJson(status, note));
  }

  Future<void> delete(String id) async {
    await _api.sendJson('DELETE', '/admin/arreglos/$id');
  }
}

final arreglosApiProvider = Provider<ArreglosApi>((ref) => ArreglosApi(ref.watch(apiClientProvider)));

Duration? _noRetry(int count, Object error) => null;

final arreglosProvider = FutureProvider.autoDispose<ArreglosData>(
  (ref) => ref.watch(arreglosApiProvider).list(),
  retry: _noRetry,
);

/// Tras cargar, responder o borrar: se vuelve a pedir el listado.
/// (Con el contenedor y no con el `ref` de la pantalla, que puede haberse
/// cerrado mientras el servidor respondía: igual que `invalidateFallas`.)
void invalidateArreglos(ProviderContainer container) {
  container.invalidate(arreglosProvider);
}
