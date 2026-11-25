import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/widgets/common.dart';
import 'admin_providers.dart';
import 'notificaciones/notifications_bell.dart';

/// Contenedor del panel: valida SESIÓN y ROL antes de mostrar nada y arma la
/// barra de navegación (Inicio · Ventas · Cola · Más).
///
/// El rol sale de `/api/v1/me` (servidor). Esto es solo para no mostrar una
/// pantalla vacía: cada endpoint del panel vuelve a verificar el permiso.
class AdminShell extends ConsumerWidget {
  const AdminShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final me = ref.watch(meProvider);

    Widget gate(Widget child) => Scaffold(body: SafeArea(child: child));

    if (session.value == null && !session.isLoading) {
      return gate(EmptyView(
        icon: Icons.lock_outline_rounded,
        title: 'Ingresá para ver el panel',
        subtitle: 'Es solo para el equipo de Hefesto 3D.',
        action: GoldButton(
          label: 'Ingresar',
          expand: false,
          onPressed: () => context.go('/ingresar'),
        ),
      ));
    }

    // El perfil se vuelve a pedir solo cuando falla (hasta 10 veces, con espera
    // creciente: más de medio minuto) y mientras tanto queda "cargando" con el
    // error adentro: `when` mostraría solo el círculo girando, sin explicar
    // nada. Se muestra el error con "Reintentar" enseguida; si un reintento
    // sale bien, el panel entra solo.
    if (me.hasError && !me.hasValue) {
      return gate(ErrorView(
        message: '${me.error}',
        onRetry: () => ref.invalidate(meProvider),
      ));
    }

    return me.when(
      loading: () => gate(const LoadingView()),
      error: (e, _) => gate(ErrorView(
        message: '$e',
        onRetry: () => ref.invalidate(meProvider),
      )),
      data: (m) {
        if (m == null || !m.isStaff) {
          return gate(EmptyView(
            icon: Icons.shield_outlined,
            title: 'Esta cuenta no tiene acceso al panel',
            subtitle: 'El panel es solo para administradores y operadores.',
            action: GoldButton(
              label: 'Volver a la tienda',
              expand: false,
              onPressed: () => context.go('/cuenta'),
            ),
          ));
        }
        final pending = ref.watch(adminDashboardProvider).value?.pendingPayment ?? 0;
        // Mientras el panel está a la vista, las notificaciones se actualizan solas.
        return NotificationsPoller(
            child: PopScope(
          // Desde Ventas/Cola/Más, "atrás" vuelve al Inicio del panel y recién
          // desde ahí sale a la cuenta (no cierra la app de golpe).
          canPop: false,
          onPopInvokedWithResult: (didPop, _) {
            if (didPop) return;
            if (shell.currentIndex != 0) {
              shell.goBranch(0);
            } else {
              context.go('/cuenta');
            }
          },
          child: Scaffold(
            body: shell,
            bottomNavigationBar: NavigationBar(
              selectedIndex: shell.currentIndex,
              onDestinationSelected: (i) =>
                  shell.goBranch(i, initialLocation: i == shell.currentIndex),
              destinations: [
                const NavigationDestination(
                  icon: Icon(Icons.space_dashboard_outlined),
                  selectedIcon: Icon(Icons.space_dashboard_rounded),
                  label: 'Inicio',
                ),
                NavigationDestination(
                  icon: Badge(
                    isLabelVisible: pending > 0,
                    label: Text('$pending'),
                    child: const Icon(Icons.receipt_long_outlined),
                  ),
                  selectedIcon: const Icon(Icons.receipt_long_rounded),
                  label: 'Ventas',
                ),
                const NavigationDestination(
                  icon: Icon(Icons.print_outlined),
                  selectedIcon: Icon(Icons.print_rounded),
                  label: 'Cola',
                ),
                const NavigationDestination(
                  icon: Icon(Icons.apps_rounded),
                  selectedIcon: Icon(Icons.apps_rounded),
                  label: 'Más',
                ),
              ],
            ),
          ),
        ));
      },
    );
  }
}
