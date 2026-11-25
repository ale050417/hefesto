// Apoyo para los tests que dibujan el panel con su campana: notificaciones de
// mentira con la forma real de `/api/v1/admin/notifications`. Nunca toca la red.

import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/features/admin/notificaciones/notifications_api.dart';
import 'package:hefesto/features/admin/notificaciones/notifications_models.dart';

/// Un aviso con la forma real de la API.
Map<String, dynamic> notifJson(
  String id, {
  String kind = 'inquiry',
  String title = 'Consulta nueva',
  String? body = 'Antonella: Trofeo (x4) — Sabunim Itati',
  String? link = '/admin/consultas',
  bool unread = true,
  String createdAt = '2026-11-25T14:03:00.000Z',
}) =>
    {
      'id': id,
      'kind': kind,
      'title': title,
      'body': body,
      'link': link,
      'unread': unread,
      'createdAt': createdAt,
    };

Map<String, dynamic> kindJson(String key, String label, {String? description, bool enabled = true}) => {
      'key': key,
      'label': label,
      'description': description,
      'enabled': enabled,
    };

List<Map<String, dynamic>> kindsJson({Set<String> muted = const {}}) => [
      kindJson('inquiry', 'Consultas nuevas',
          description: 'Cuando atención al cliente carga una consulta para cotizar.',
          enabled: !muted.contains('inquiry')),
      kindJson('order', 'Pedidos de la tienda',
          description: 'Cuando entra un pedido por la web.', enabled: !muted.contains('order')),
      kindJson('low_stock', 'Filamento bajo',
          description: 'Cuando un filamento baja de su mínimo.', enabled: !muted.contains('low_stock')),
      kindJson('fix', 'Arreglos', description: 'Cuando alguien carga o responde un arreglo.', enabled: !muted.contains('fix')),
    ];

/// JSON con la forma real de `GET /api/v1/admin/notifications`.
Map<String, dynamic> notificationsJson({Set<String> muted = const {'low_stock'}}) => {
      'items': [
        notifJson('n1'),
        notifJson('n2',
            kind: 'order',
            title: 'Pedido nuevo HF-0042',
            body: 'Juan Pérez · \$57.500',
            link: '/admin/pedidos/0b8f6c1e-2a3d-4e5f-8a9b-1c2d3e4f5a6b',
            createdAt: '2026-11-25T12:00:00.000Z'),
        notifJson('n3',
            kind: 'fix',
            title: 'Arreglo resuelto',
            body: 'La calculadora ya redondea.',
            link: '/admin/arreglos',
            unread: false,
            createdAt: '2026-11-24T09:30:00.000Z'),
        notifJson('n4',
            kind: 'other', title: 'Aviso general', body: null, link: null, unread: false, createdAt: '2026-11-20T09:30:00.000Z'),
      ],
      'unread': 2,
      'kinds': kindsJson(muted: muted),
    };

final sampleNotifications = NotificationsData.fromJson(notificationsJson());

/// API de mentira: guarda lo que la app le manda y contesta como el servidor.
class FakeNotificationsApi extends NotificationsApi {
  FakeNotificationsApi([NotificationsData? data])
      : data = data ?? sampleNotifications,
        super(ApiClient());

  /// Lo que devuelve `list()` (cambia con cada llamada, como el servidor).
  NotificationsData data;
  int lists = 0;
  int reads = 0;

  /// Cada lista de silenciados que se mandó a guardar.
  final saved = <List<String>>[];

  /// Falla de `list()`, de `markRead()` y de `saveMuted()`.
  Object? failList;
  Object? failRead;
  Object? failSave;

  /// Orden de las llamadas ("list", "read", "prefs").
  final calls = <String>[];

  @override
  Future<NotificationsData> list() async {
    lists++;
    calls.add('list');
    if (failList != null) throw failList!;
    return data;
  }

  @override
  Future<void> markRead() async {
    calls.add('read');
    if (failRead != null) throw failRead!;
    reads++;
    data = data.allRead();
  }

  @override
  Future<List<NotificationKind>> saveMuted(List<String> muted) async {
    calls.add('prefs');
    if (failSave != null) throw failSave!;
    saved.add(List.of(muted));
    final kinds = [for (final k in data.kinds) k.withEnabled(!muted.contains(k.key))];
    // El servidor deja de mandar los avisos de los tipos silenciados.
    final items = data.items.where((n) => !muted.contains(n.kind)).toList();
    data = NotificationsData(items: items, unread: items.where((n) => n.unread).length, kinds: kinds);
    return kinds;
  }
}

/// Overrides para cualquier test que dibuje `AdminShell` (que mantiene las
/// notificaciones al día): sin [api], una lista vacía.
List<Override> notificationsKitOverrides({FakeNotificationsApi? api}) => [
      notificationsApiProvider.overrideWithValue(api ?? FakeNotificationsApi(const NotificationsData())),
    ];
