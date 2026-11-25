import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import 'notifications_models.dart';

/// Ruta de la pantalla de notificaciones (`lib/router.dart`).
const notificationsRoute = '/admin/m/notificaciones';

/// Llamadas a `/api/v1/admin/notifications*` (cualquiera del equipo; el
/// servidor filtra los tipos por permiso). Lanzan `ApiException` con el
/// mensaje en castellano del servidor.
class NotificationsApi {
  NotificationsApi(this._api);
  final ApiClient _api;

  Future<NotificationsData> list() async =>
      NotificationsData.fromJson(await _api.getJson('/admin/notifications'));

  /// Marca todo como visto para ESTE usuario.
  Future<void> markRead() async {
    await _api.sendJson('POST', '/admin/notifications/read');
  }

  /// Guarda la lista COMPLETA de tipos silenciados y devuelve cómo quedaron.
  Future<List<NotificationKind>> saveMuted(List<String> muted) async {
    final json = await _api.sendJson('PUT', '/admin/notifications/prefs', body: {'muted': muted});
    return notificationKindsOf(json['kinds']);
  }
}

final notificationsApiProvider =
    Provider<NotificationsApi>((ref) => NotificationsApi(ref.watch(apiClientProvider)));

/// Lo que muestran la campana, la tarjeta de Inicio y la pantalla.
class NotificationsState {
  const NotificationsState({this.data, this.error, this.loading = false, this.userId});

  /// Lo último que se pudo traer (null hasta la primera respuesta).
  final NotificationsData? data;

  /// Por qué falló la primera carga (con datos en pantalla, una falla de la
  /// actualización automática no se muestra: se reintenta sola).
  final Object? error;
  final bool loading;

  /// De quién son los datos (para no mostrarle a uno los avisos de otro).
  final String? userId;

  int get unread => data?.unread ?? 0;
}

/// Estado de las notificaciones. No pide nada por su cuenta: lo actualizan
/// `NotificationsPoller` (al entrar al panel, cada minuto y al volver a la
/// app) y la pantalla de notificaciones. Así la campana se puede dibujar en
/// cualquier barra sin disparar pedidos al servidor.
class NotificationsController extends Notifier<NotificationsState> {
  /// Sube con cada pedido o cambio local: una respuesta vieja que llega tarde
  /// no pisa lo más nuevo.
  int _seq = 0;

  @override
  NotificationsState build() => const NotificationsState();

  NotificationsApi get _api => ref.read(notificationsApiProvider);

  /// Entró [userId] al panel: si los datos eran de otra persona, se tiran.
  void attach(String? userId) {
    if (state.userId == userId) return;
    _seq++;
    state = NotificationsState(userId: userId);
  }

  /// Vuelve a pedir la lista. Nunca lanza: si falla sin datos previos, el
  /// error queda en el estado; con datos, se conserva lo que había.
  Future<void> refresh() async {
    final seq = ++_seq;
    final before = state;
    if (before.data == null) {
      state = NotificationsState(loading: true, userId: before.userId);
    }
    try {
      final data = await _api.list();
      if (!ref.mounted || seq != _seq) return;
      state = NotificationsState(data: data, userId: state.userId);
    } catch (e) {
      if (!ref.mounted || seq != _seq) return;
      state = NotificationsState(
        data: state.data,
        error: state.data == null ? e : null,
        userId: state.userId,
      );
    }
  }

  /// Marca todo como visto (se llama al abrir la pantalla). Si falla no se
  /// avisa: el globito queda y se vuelve a intentar la próxima vez.
  Future<void> markRead() async {
    if (state.unread == 0) return;
    try {
      await _api.markRead();
    } catch (_) {
      return;
    }
    if (!ref.mounted) return;
    final data = state.data;
    if (data == null) return;
    _seq++; // una lista pedida antes de marcar traería el número viejo
    state = NotificationsState(data: data.allRead(), userId: state.userId);
  }

  /// Prende o apaga un tipo de aviso: se ve al instante y se guarda en el
  /// servidor. Si el servidor lo rechaza, vuelve a como estaba y relanza el
  /// error para que la pantalla lo muestre.
  Future<void> setKindEnabled(String key, bool enabled) async {
    final data = state.data;
    if (data == null) return;
    final optimistic = data.withKindEnabled(key, enabled);
    _seq++;
    state = NotificationsState(data: optimistic, userId: state.userId);
    try {
      final kinds = await _api.saveMuted(optimistic.mutedKeys);
      if (!ref.mounted) return;
      final now = state.data ?? optimistic;
      // Con respuesta vacía (servidor raro) se confía en lo que se mandó.
      if (kinds.isNotEmpty) {
        state = NotificationsState(data: now.copyWith(kinds: kinds), userId: state.userId);
      }
    } catch (_) {
      if (ref.mounted) {
        final now = state.data;
        if (now != null) {
          _seq++;
          state = NotificationsState(data: now.withKindEnabled(key, !enabled), userId: state.userId);
        }
      }
      rethrow;
    }
    // La lista cambia con lo silenciado (el servidor ya no manda esos avisos).
    await refresh();
  }
}

final notificationsProvider =
    NotifierProvider<NotificationsController, NotificationsState>(NotificationsController.new);
