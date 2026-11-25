// Notificaciones del panel (pedido del operador, 2026-11-25: "siempre pasó
// desapercibido el símbolo de notificaciones"). Mismos datos que la campanita
// de la web: `GET /api/v1/admin/notifications`.

import '../filamentos/parse_util.dart';

/// Un aviso del panel ("Consulta nueva", "Filamento bajo"…).
class AppNotification {
  const AppNotification({
    required this.id,
    required this.kind,
    required this.title,
    this.body,
    this.link,
    this.unread = false,
    this.createdAt,
  });

  final String id;

  /// Tipo del aviso (`inquiry`, `order`, `low_stock`…). El servidor puede
  /// mandar tipos que esta versión de la app no conoce: se muestran igual.
  final String kind;
  final String title;
  final String? body;

  /// Dirección de la web a la que apunta (`/admin/consultas`); null si no
  /// lleva a ningún lado.
  final String? link;
  final bool unread;
  final DateTime? createdAt;

  AppNotification asRead() => AppNotification(
        id: id,
        kind: kind,
        title: title,
        body: body,
        link: link,
        createdAt: createdAt,
      );

  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
        id: strOf(j['id']),
        kind: strOf(j['kind'], 'other'),
        title: strOf(j['title'], 'Novedad'),
        body: strOrNull(j['body']),
        link: strOrNull(j['link']),
        unread: boolOf(j['unread']),
        createdAt: dateOf(j['createdAt']),
      );
}

/// Un tipo de aviso que este usuario puede recibir, con su interruptor.
class NotificationKind {
  const NotificationKind({
    required this.key,
    required this.label,
    this.description,
    this.enabled = true,
  });

  final String key;
  final String label;
  final String? description;

  /// false = silenciado (el servidor deja de mandarlo en la lista).
  final bool enabled;

  NotificationKind withEnabled(bool value) =>
      NotificationKind(key: key, label: label, description: description, enabled: value);

  factory NotificationKind.fromJson(Map<String, dynamic> j) {
    final key = strOf(j['key']);
    return NotificationKind(
      key: key,
      // Sin nombre (tipo nuevo, servidor viejo): se muestra la clave.
      label: strOf(j['label'], key),
      description: strOrNull(j['description']),
      enabled: boolOf(j['enabled'], true),
    );
  }
}

/// Lee `kinds` (de la lista o de la respuesta de las preferencias).
List<NotificationKind> notificationKindsOf(Object? raw) => [
      for (final m in mapsOf(raw))
        if (strOf(m['key']).isNotEmpty) NotificationKind.fromJson(m),
    ];

/// Todo lo que devuelve `GET /admin/notifications`.
class NotificationsData {
  const NotificationsData({this.items = const [], this.unread = 0, this.kinds = const []});

  /// Los más nuevos primero (el servidor manda hasta 30, ya filtrados por
  /// permisos y por los tipos silenciados).
  final List<AppNotification> items;

  /// Cuántos no se vieron todavía.
  final int unread;
  final List<NotificationKind> kinds;

  /// Claves silenciadas: es lo que se manda entero a `PUT …/prefs`.
  List<String> get mutedKeys => [
        for (final k in kinds)
          if (!k.enabled) k.key,
      ];

  /// El aviso que se muestra en la tarjeta de Inicio: el más nuevo sin ver (o
  /// el más nuevo, si el servidor no marcó ninguno).
  AppNotification? get latest {
    for (final n in items) {
      if (n.unread) return n;
    }
    return items.isEmpty ? null : items.first;
  }

  NotificationsData copyWith({List<AppNotification>? items, int? unread, List<NotificationKind>? kinds}) =>
      NotificationsData(
        items: items ?? this.items,
        unread: unread ?? this.unread,
        kinds: kinds ?? this.kinds,
      );

  /// Todo visto (después de `POST …/read`).
  NotificationsData allRead() => copyWith(items: [for (final n in items) n.asRead()], unread: 0);

  /// Con el tipo [key] prendido o apagado.
  NotificationsData withKindEnabled(String key, bool enabled) => copyWith(
        kinds: [for (final k in kinds) k.key == key ? k.withEnabled(enabled) : k],
      );

  factory NotificationsData.fromJson(Map<String, dynamic> j) {
    final items = [
      for (final m in mapsOf(j['items']))
        if (strOf(m['id']).isNotEmpty) AppNotification.fromJson(m),
    ];
    // Sin el total (servidor viejo o respuesta rara): se cuentan los de la lista.
    final counted = items.where((n) => n.unread).length;
    final unread = j['unread'] == null ? counted : intOf(j['unread'], counted);
    return NotificationsData(
      items: items,
      unread: unread < 0 ? 0 : unread,
      kinds: notificationKindsOf(j['kinds']),
    );
  }
}

/// "Tenés 1 novedad" / "Tenés 3 novedades" (tarjeta de Inicio).
String notificationsCountLabel(int unread) => unread == 1 ? 'Tenés 1 novedad' : 'Tenés $unread novedades';

/// Número del globito de la campana ("99+" si son muchísimas).
String notificationsBadgeLabel(int unread) => unread > 99 ? '99+' : '$unread';

/// "recién" · "hace 5 min" · "hace 3 h" · "ayer" · "hace 4 d" · "12/10/2026".
String notificationAgo(DateTime at, {DateTime? now}) {
  final diff = (now ?? DateTime.now()).difference(at);
  if (diff.inMinutes < 1) return 'recién';
  if (diff.inMinutes < 60) return 'hace ${diff.inMinutes} min';
  if (diff.inHours < 24) return 'hace ${diff.inHours} h';
  if (diff.inHours < 48) return 'ayer';
  if (diff.inDays < 7) return 'hace ${diff.inDays} d';
  final local = at.toLocal();
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(local.day)}/${two(local.month)}/${local.year}';
}

/// A dónde lleva un aviso dentro de la app.
typedef NotificationTarget = ({
  /// Ruta de la app (`lib/router.dart`).
  String route,

  /// Módulo de permisos que hay que poder `ver` para abrirla.
  String permission,

  /// true = es una pestaña del panel (se va con `go`); false = una pantalla
  /// que se abre encima (`push`).
  bool tab,
});

final _uuid = RegExp(r'^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$');

/// Traduce la dirección de la web de un aviso (`/admin/consultas`,
/// `/admin/pedidos/<id>`…) a la pantalla de la app que muestra lo mismo.
/// Null si la app no tiene esa sección: el aviso no lleva a ningún lado.
NotificationTarget? notificationTarget(String? link) {
  if (link == null) return null;
  final uri = Uri.tryParse(link.trim());
  if (uri == null) return null;
  final parts = uri.pathSegments.where((s) => s.isNotEmpty).toList();
  if (parts.length < 2 || parts[0] != 'admin') return null;
  switch (parts[1]) {
    case 'consultas':
      return (route: '/admin/m/consultas', permission: 'consultas', tab: false);
    case 'pedidos':
      // `/admin/pedidos/<id>` es un pedido de la tienda: se abre su detalle.
      if (parts.length >= 3 && _uuid.hasMatch(parts[2])) {
        return (route: '/admin/venta/online/${parts[2]}', permission: 'pedidos', tab: false);
      }
      return (route: '/admin/ventas', permission: 'pedidos', tab: true);
    case 'filamentos':
      return (route: '/admin/m/filamentos', permission: 'filamentos', tab: false);
    case 'arreglos':
      return (route: '/admin/m/arreglos', permission: 'arreglos', tab: false);
    case 'calculadora':
      return (route: '/admin/m/calculadora', permission: 'calculadora', tab: false);
    case 'produccion':
      return (route: '/admin/cola', permission: 'produccion', tab: true);
  }
  return null;
}
