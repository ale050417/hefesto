import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/file_attach.dart';
import '../../../core/widgets/photo_picker.dart';
import '../filamentos/parse_util.dart';
import '../produccion/produccion_api.dart' show invalidateBoard;
import 'consultas_models.dart';

/// Cambios de estado que hace atención al cliente (`to` de la API).
enum InquiryMove {
  confirm('confirmed'),
  cancel('cancelled'),
  reopen('reopen');

  const InquiryMove(this.api);
  final String api;
}

/// Llamadas a `/api/v1/admin/consultas/*`. Lanzan `ApiException` con el
/// mensaje en castellano del servidor.
class ConsultasApi {
  ConsultasApi(this._api);
  final ApiClient _api;

  Future<ConsultasData> list() async =>
      ConsultasData.fromJson(await _api.getJson('/admin/consultas'));

  /// Carga la consulta (sin fotos: se suben después, de a una).
  Future<Consulta> create(ConsultaDraft d) async =>
      Consulta.fromJson(await _api.sendJson('POST', '/admin/consultas', body: d.toJson()));

  /// Suma UNA foto de referencia y devuelve su dirección.
  Future<String> addImage(String id, PickedPhoto photo) async {
    final json = await _api.uploadImage(
      '/admin/consultas/$id/images',
      bytes: photo.bytes,
      filename: photo.filename,
    );
    return strOf(json['url']);
  }

  /// Suma UN adjunto que no es foto (audio, video corto o PDF, hasta 4 MB).
  Future<ConsultaFile> addFile(String id, PickedAttachment file) async => ConsultaFile.fromJson(
        await _api.uploadFile(
          '/admin/consultas/$id/files',
          bytes: file.bytes,
          filename: file.filename,
          contentType: file.contentType,
        ),
      );

  /// Respuesta del operador. Devuelve la consulta ya con el mensaje armado.
  Future<Consulta> answer(String id, RespuestaDraft d) async => Consulta.fromJson(
        await _api.sendJson('POST', '/admin/consultas/$id/answer', body: d.toJson()),
      );

  /// Confirmar / no se hizo / reabrir. Confirmar crea el pedido (entra como
  /// confirmado a Ventas y a la cola): por eso lleva cómo paga el cliente.
  Future<Consulta> move(String id, InquiryMove to, {String? paymentMethod}) async => Consulta.fromJson(
        await _api.sendJson('POST', '/admin/consultas/$id/status', body: {
          'to': to.api,
          if (to == InquiryMove.confirm) 'paymentMethod': paymentMethod ?? 'transfer',
        }),
      );

  Future<void> delete(String id) async {
    await _api.sendJson('DELETE', '/admin/consultas/$id');
  }
}

final consultasApiProvider =
    Provider<ConsultasApi>((ref) => ConsultasApi(ref.watch(apiClientProvider)));

Duration? _noRetry(int count, Object error) => null;

final consultasProvider = FutureProvider.autoDispose<ConsultasData>(
  (ref) => ref.watch(consultasApiProvider).list(),
  retry: _noRetry,
);

/// Tras cargar, responder, cambiar el estado o borrar: se vuelve a pedir el
/// listado. (Con el contenedor y no con el `ref` de la pantalla, que puede
/// haberse cerrado mientras el servidor respondía: igual que `invalidateFallas`.)
void invalidateConsultas(ProviderContainer container) {
  container.invalidate(consultasProvider);
}

/// Tras CONFIRMAR una consulta: además del listado, todo lo que muestra
/// ventas, porque el servidor acaba de crear un pedido (inicio, Ventas, la
/// cola de impresión y el stock: lo mismo que refresca `invalidateBoard`).
void invalidateConsultaConfirmed(ProviderContainer container) {
  invalidateConsultas(container);
  invalidateBoard(container);
}
