import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import 'notifications_api.dart';
import 'notifications_models.dart';

/// Campana de la barra del panel, con el globito de lo que falta ver. Va en
/// `AdminAppBar`: se ve desde Inicio, Ventas, Cola y Más.
class NotificationsBell extends ConsumerWidget {
  const NotificationsBell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(notificationsProvider.select((s) => s.unread));
    final has = unread > 0;
    return IconButton(
      tooltip: has ? 'Notificaciones: $unread sin ver' : 'Notificaciones',
      onPressed: () => context.push(notificationsRoute),
      icon: Badge(
        isLabelVisible: has,
        label: Text(notificationsBadgeLabel(unread)),
        child: Icon(
          has ? Icons.notifications_active_rounded : Icons.notifications_none_rounded,
          color: has ? Brand.gold : null,
        ),
      ),
    );
  }
}

/// Mantiene al día las notificaciones mientras el panel está a la vista: al
/// entrar, cada minuto y cuando la app vuelve al frente. Con la app en segundo
/// plano no pide nada. Envuelve el contenido de `AdminShell`.
class NotificationsPoller extends ConsumerStatefulWidget {
  const NotificationsPoller({super.key, required this.child, this.every = const Duration(seconds: 60)});
  final Widget child;
  final Duration every;

  @override
  ConsumerState<NotificationsPoller> createState() => _NotificationsPollerState();
}

class _NotificationsPollerState extends ConsumerState<NotificationsPoller> with WidgetsBindingObserver {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final life = WidgetsBinding.instance.lifecycleState;
    if (life == null || life == AppLifecycleState.resumed) _start();
    // Un provider no se puede tocar mientras se está dibujando.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(notificationsProvider.notifier).attach(ref.read(meProvider).value?.id);
      _tick();
    });
  }

  void _start() {
    _timer?.cancel();
    _timer = Timer.periodic(widget.every, (_) => _tick());
  }

  void _stop() {
    _timer?.cancel();
    _timer = null;
  }

  void _tick() {
    if (!mounted) return;
    ref.read(notificationsProvider.notifier).refresh();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _tick();
      _start();
    } else {
      _stop();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
