import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/photo_picker.dart';
import 'config_models.dart';

/// Llamadas a `/api/v1/admin/configuracion/**`. Todas lanzan [ApiException]
/// con el mensaje del servidor en castellano (se muestra tal cual).
class ConfigApi {
  ConfigApi(this._c);
  final ApiClient _c;

  static const _base = '/admin/configuracion';

  Future<AdminConfig> load() async => AdminConfig.fromJson(await _c.getJson(_base));

  Future<TeamData> team() async => TeamData.fromJson(await _c.getJson('$_base/equipo'));

  /// Datos del negocio: parcial, `''` borra el dato.
  Future<void> saveNegocio(Map<String, dynamic> body) => _c.sendJson('PATCH', '$_base/negocio', body: body);

  Future<void> saveEnvios(Map<String, dynamic> body) => _c.sendJson('PUT', '$_base/envios', body: body);

  Future<void> savePagos(Map<String, dynamic> body) => _c.sendJson('PUT', '$_base/pagos', body: body);

  Future<void> connectMercadoPago(String token) =>
      _c.sendJson('PUT', '$_base/pagos/mercadopago', body: {'token': token});

  Future<void> disconnectMercadoPago() => _c.sendJson('DELETE', '$_base/pagos/mercadopago');

  Future<void> saveTienda(Map<String, dynamic> body) => _c.sendJson('PATCH', '$_base/tienda', body: body);

  Future<void> saveTextos(Map<String, dynamic> body) => _c.sendJson('PATCH', '$_base/textos', body: body);

  Future<void> saveCotizacion(Map<String, dynamic> body) => _c.sendJson('PUT', '$_base/cotizacion', body: body);

  /// Edición parcial de un banner: textos, alineación, visible y, desde
  /// 2026-11-17, también `imageUrl` (una subida con [uploadImage]) y `position`.
  Future<void> updateBanner(String id, Map<String, dynamic> body) =>
      _c.sendJson('PATCH', '$_base/banners/$id', body: body);

  /// Crea un banner (queda al final del carrusel). Devuelve su id.
  Future<String> createBanner(Map<String, dynamic> body) async {
    final json = await _c.sendJson('POST', '$_base/banners', body: body);
    return '${json['id'] ?? ''}';
  }

  /// Sube una imagen de la tienda y devuelve su dirección. [kind]:
  ///  - `logo` / `hero`: queda puesta apenas sube;
  ///  - `banner`: solo se sube; la dirección va después en el banner
  ///    ([createBanner] / [updateBanner] con `imageUrl`).
  Future<String> uploadImage(PickedPhoto photo, String kind) async {
    final json = await _c.uploadImage(
      '$_base/imagenes',
      bytes: photo.bytes,
      filename: photo.filename,
      fields: {'kind': kind},
    );
    return '${json['url'] ?? ''}';
  }

  /// Orden de los banners: [ids] con TODOS, en el orden en que se quieren ver.
  Future<void> reorderBanners(List<String> ids) =>
      _c.sendJson('PUT', '$_base/banners/orden', body: {'ids': ids});

  Future<void> deleteBanner(String id) => _c.sendJson('DELETE', '$_base/banners/$id');

  // Equipo y roles (solo administradores).

  /// Devuelve `{ ok, email, promoted }` (promoted = ya era cliente y pasó al equipo).
  Future<Map<String, dynamic>> invite({
    required String email,
    required String roleId,
    String fullName = '',
    String message = '',
  }) =>
      _c.sendJson('POST', '$_base/equipo', body: {
        'email': email,
        'roleId': roleId,
        'fullName': fullName,
        'message': message,
      });

  Future<Map<String, dynamic>> resendInvite(String userId) => _c.sendJson('POST', '$_base/equipo/$userId/reenviar');

  Future<void> assignRole(String userId, String roleId) =>
      _c.sendJson('PATCH', '$_base/equipo/$userId', body: {'roleId': roleId});

  Future<void> removeMember(String userId) => _c.sendJson('DELETE', '$_base/equipo/$userId');

  Future<void> createRole(String name, Map<String, List<String>> permissions) =>
      _c.sendJson('POST', '$_base/roles', body: {'name': name, 'permissions': permissions});

  Future<void> updateRole(String id, String name, Map<String, List<String>> permissions) =>
      _c.sendJson('PATCH', '$_base/roles/$id', body: {'name': name, 'permissions': permissions});

  Future<void> deleteRole(String id) => _c.sendJson('DELETE', '$_base/roles/$id');
}

final configApiProvider = Provider<ConfigApi>((ref) => ConfigApi(ref.watch(apiClientProvider)));

// Sin reintentos automáticos: si falla, la pantalla muestra el error con su
// botón "Reintentar" (mismo criterio que admin_providers.dart).
Duration? _noRetry(int count, Object error) => null;

final adminConfigProvider = FutureProvider.autoDispose<AdminConfig>(
  (ref) => ref.watch(configApiProvider).load(),
  retry: _noRetry,
);

final adminTeamProvider = FutureProvider.autoDispose<TeamData>(
  (ref) => ref.watch(configApiProvider).team(),
  retry: _noRetry,
);
