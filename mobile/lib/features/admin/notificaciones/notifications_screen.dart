import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import '../admin_widgets.dart';
import 'notifications_api.dart';
import 'notifications_models.dart';

IconData _kindIcon(String kind) => switch (kind) {
      'inquiry' || 'inquiry_answered' || 'inquiry_confirmed' => Icons.forum_rounded,
      'order' => Icons.receipt_long_rounded,
      'message' || 'inquiry_message' => Icons.chat_bubble_rounded,
      'low_stock' => Icons.warning_amber_rounded,
      'fix' => Icons.build_rounded,
      'calc_preset' => Icons.calculate_rounded,
      _ => Icons.notifications_rounded,
    };

/// Tarjeta de Inicio: "Tenés 3 novedades" + el título de la última. Solo
/// aparece si hay algo sin ver; al tocarla abre las notificaciones.
class NotificationsBanner extends ConsumerWidget {
  const NotificationsBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(notificationsProvider).data;
    if (data == null || data.unread <= 0) return const SizedBox.shrink();
    final c = context.hc;
    final latest = data.latest;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: AdminCard(
        accent: Brand.gold,
        padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
        onTap: () => context.push(notificationsRoute),
        child: Row(
          children: [
            const Icon(Icons.notifications_active_rounded, color: Brand.gold, size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    notificationsCountLabel(data.unread),
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5),
                  ),
                  if (latest != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      latest.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12.5, color: c.textDim),
                    ),
                  ],
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: c.textFaint),
          ],
        ),
      ),
    );
  }
}

/// Notificaciones del panel: la lista de avisos y, con el engranaje, qué
/// tipos recibir. Al abrirla todo queda como visto (el globito de la campana
/// vuelve a cero), pero lo nuevo sigue marcado mientras dure la visita.
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  /// Lo que estaba sin ver al entrar (o al actualizar): conserva su punto
  /// aunque el servidor ya lo tenga como visto.
  final _fresh = <String>{};

  @override
  void initState() {
    super.initState();
    // Un provider no se puede tocar mientras se está dibujando.
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  /// Trae la lista y RECIÉN después avisa que se vio.
  Future<void> _load() async {
    final controller = ref.read(notificationsProvider.notifier);
    await controller.refresh();
    if (!mounted) return;
    final data = ref.read(notificationsProvider).data;
    if (data == null) return;
    setState(() => _fresh.addAll([
          for (final n in data.items)
            if (n.unread) n.id,
        ]));
    await controller.markRead();
  }

  void _open(AppNotification n) {
    final target = notificationTarget(n.link);
    if (target == null) return;
    final me = ref.read(meProvider).value;
    // Misma regla que "Más": sin el permiso `ver`, el módulo no se abre.
    if (me != null && !me.can(target.permission, 'ver')) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Tu cuenta no tiene acceso a esa sección.')));
      return;
    }
    if (target.tab) {
      context.go(target.route);
    } else {
      context.push(target.route);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(notificationsProvider);
    final data = s.data;
    // Se mira (no solo se lee al tocar): así los permisos ya están cargados
    // cuando se toca un aviso.
    final me = ref.watch(meProvider).value;
    if (me != null && !me.isStaff) {
      return Scaffold(
        appBar: AppBar(title: const Text('Notificaciones')),
        body: const AccessDenied(what: 'las notificaciones del panel'),
      );
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificaciones'),
        actions: [
          IconButton(
            tooltip: 'Qué avisos recibir',
            icon: const Icon(Icons.settings_rounded),
            onPressed: data == null
                ? null
                : () => showAppSheet<void>(context, builder: (_) => const NotificationPrefsSheet()),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: SafeArea(
        top: false,
        child: data != null
            ? _list(data)
            : s.error != null
                ? ErrorView(message: '${s.error}', onRetry: _load)
                : const ListSkeleton(rows: 5, height: 72),
      ),
    );
  }

  Widget _list(NotificationsData data) {
    final now = DateTime.now();
    return RefreshIndicator(
      color: Brand.gold,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          if (data.items.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 40),
              child: EmptyView(
                icon: Icons.notifications_none_rounded,
                title: 'Sin novedades. ¡Todo al día!',
                subtitle: 'Con el engranaje de arriba elegís qué avisos recibir.',
              ),
            )
          else
            for (final n in data.items) ...[
              _NotificationTile(
                n: n,
                fresh: n.unread || _fresh.contains(n.id),
                now: now,
                onTap: notificationTarget(n.link) == null ? null : () => _open(n),
              ),
              const SizedBox(height: 10),
            ],
        ],
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.n, required this.fresh, required this.now, this.onTap});
  final AppNotification n;

  /// Sin ver (lleva el punto dorado).
  final bool fresh;
  final DateTime now;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return AdminCard(
      key: ValueKey('notif-${n.id}'),
      accent: fresh ? Brand.gold : null,
      padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 1),
            child: Icon(_kindIcon(n.kind), size: 20, color: fresh ? Brand.gold : c.textDim),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  n.title,
                  style: TextStyle(fontWeight: fresh ? FontWeight.w800 : FontWeight.w600, fontSize: 14, height: 1.3),
                ),
                if (n.body != null) ...[
                  const SizedBox(height: 2),
                  Text(n.body!, style: TextStyle(fontSize: 13, color: c.textDim, height: 1.35)),
                ],
                if (n.createdAt != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    notificationAgo(n.createdAt!, now: now),
                    style: TextStyle(fontSize: 11.5, color: c.textFaint),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (fresh)
            Padding(
              padding: const EdgeInsets.only(top: 5),
              child: Semantics(
                label: 'Sin ver',
                child: Container(
                  key: ValueKey('notif-dot-${n.id}'),
                  width: 9,
                  height: 9,
                  decoration: const BoxDecoration(color: Brand.gold, shape: BoxShape.circle),
                ),
              ),
            )
          else if (onTap != null)
            Icon(Icons.chevron_right_rounded, size: 20, color: c.textFaint),
        ],
      ),
    );
  }
}

/// "Qué avisos recibir": un interruptor por tipo. Cada cambio se guarda al
/// instante; si el servidor lo rechaza, el interruptor vuelve a como estaba
/// y el motivo se muestra acá mismo (un aviso flotante quedaría tapado por la
/// hoja).
class NotificationPrefsSheet extends ConsumerStatefulWidget {
  const NotificationPrefsSheet({super.key});

  @override
  ConsumerState<NotificationPrefsSheet> createState() => _NotificationPrefsSheetState();
}

class _NotificationPrefsSheetState extends ConsumerState<NotificationPrefsSheet> {
  String? _error;

  /// Un cambio en viaje: los interruptores esperan (se manda la lista entera
  /// de silenciados, y dos cambios cruzados se pisarían).
  bool _saving = false;

  Future<void> _toggle(NotificationKind k, bool enabled) async {
    if (_saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    String? error;
    try {
      await ref.read(notificationsProvider.notifier).setKindEnabled(k.key, enabled);
    } on ApiException catch (e) {
      error = e.message;
    } catch (_) {
      error = 'No pudimos guardar el cambio. Probá de nuevo.';
    }
    if (!mounted) return;
    setState(() {
      _saving = false;
      _error = error;
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final kinds = ref.watch(notificationsProvider).data?.kinds ?? const <NotificationKind>[];
    return SheetBody(
      title: 'Qué avisos recibir',
      subtitle: 'Apagá los que no te sirven: dejan de aparecer en la campana. Se guarda al instante.',
      padding: const EdgeInsets.symmetric(horizontal: 12),
      children: [
        if (_error != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.error_outline_rounded, size: 18, color: Brand.danger),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(_error!, style: const TextStyle(fontSize: 13, color: Brand.danger, height: 1.35)),
                ),
              ],
            ),
          ),
        if (kinds.isEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
            child: Text(
              'Tu cuenta todavía no tiene tipos de avisos para elegir.',
              style: TextStyle(fontSize: 13.5, color: c.textDim, height: 1.4),
            ),
          )
        else
          for (final k in kinds)
            SwitchListTile(
              key: ValueKey('notif-kind-${k.key}'),
              contentPadding: const EdgeInsets.symmetric(horizontal: 8),
              title: Text(k.label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
              subtitle: k.description == null
                  ? null
                  : Text(k.description!, style: TextStyle(fontSize: 12.5, color: c.textDim, height: 1.35)),
              value: k.enabled,
              onChanged: _saving ? null : (v) => _toggle(k, v),
            ),
      ],
    );
  }
}
