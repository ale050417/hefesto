import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'features/account/account_screen.dart';
import 'features/admin/admin_shell.dart';
import 'features/admin/clientes/clientes_screen.dart';
import 'features/admin/produccion/produccion_screen.dart';
import 'features/admin/fallas/fallas_screen.dart';
import 'features/admin/arreglos/arreglos_screen.dart';
import 'features/admin/consultas/consultas_screen.dart';
import 'features/admin/productos/productos_screen.dart';
import 'features/admin/categorias/categorias_screen.dart';
import 'features/admin/descuentos/descuentos_screen.dart';
import 'features/admin/recompensas/recompensas_screen.dart';
import 'features/admin/reportes/reportes_screen.dart';
import 'features/admin/ganancias/ganancias_screen.dart';
import 'features/admin/calculadora/calculadora_screen.dart';
import 'features/admin/configuracion/configuracion_screen.dart';
import 'features/admin/auditoria/auditoria_screen.dart';
import 'features/admin/admin_more_screen.dart';
import 'features/admin/dashboard_screen.dart';
import 'features/admin/sale_detail_screen.dart';
import 'features/admin/sales_screen.dart';
import 'features/admin/stock_screen.dart';
import 'core/widgets/common.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/new_password_screen.dart';
import 'features/auth/register_screen.dart';
import 'features/catalog/catalog_screen.dart';
import 'features/favorites/favorites_controller.dart';
import 'features/favorites/favorites_screen.dart';
import 'features/home/home_screen.dart';
import 'features/product/product_screen.dart';

final _rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/',
    // Una dirección que no existe muestra un aviso de la app (con salida al
    // inicio) en vez de la pantalla de error en inglés de go_router.
    errorBuilder: (context, state) => const _NotFoundScreen(),
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => _Shell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/', builder: (_, _) => const HomeScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/catalogo',
              builder: (_, state) => CatalogScreen(
                key: ValueKey(state.uri.toString()),
                category: state.uri.queryParameters['category'],
                onSale: state.uri.queryParameters['onSale'] == 'true',
                sort: state.uri.queryParameters['sort'],
                focusSearch: state.uri.queryParameters['focus'] == 'search',
              ),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/favoritos', builder: (_, _) => const FavoritesScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/cuenta', builder: (_, _) => const AccountScreen()),
          ]),
        ],
      ),
      // --- Panel de administración (staff). Su propia barra inferior. ---
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => AdminShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/admin', builder: (_, _) => const AdminDashboardScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/admin/ventas',
              builder: (_, state) => AdminSalesScreen(
                key: ValueKey(state.uri.toString()),
                initialStatus: state.uri.queryParameters['status'],
              ),
            ),
          ]),
          // Tercera pestaña: la cola de impresión (2026-11-17, pedido del
          // operador: tenerla a mano para mover los pedidos más rápido). El
          // stock de filamentos pasó a ser un módulo de "Más".
          StatefulShellBranch(routes: [
            GoRoute(path: '/admin/cola', builder: (_, _) => const AdminProduccionScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/admin/mas', builder: (_, _) => const AdminMoreScreen()),
          ]),
        ],
      ),
      // Módulos del panel (se abren sobre la barra del panel).
      GoRoute(
        path: '/admin/m/clientes',
        parentNavigatorKey: _rootKey,
        builder: (_, _) => const AdminClientesScreen(),
      ),
      GoRoute(
        path: '/admin/m/filamentos',
        parentNavigatorKey: _rootKey,
        builder: (_, _) => const AdminStockScreen(),
      ),
      GoRoute(
        path: '/admin/m/fallas',
        parentNavigatorKey: _rootKey,
        builder: (_, _) => const AdminFallasScreen(),
      ),
      GoRoute(
        path: '/admin/m/arreglos',
        parentNavigatorKey: _rootKey,
        builder: (_, _) => const AdminArreglosScreen(),
      ),
      GoRoute(
        path: '/admin/m/consultas',
        parentNavigatorKey: _rootKey,
        builder: (_, _) => const AdminConsultasScreen(),
      ),
      GoRoute(
        path: '/admin/m/productos',
        parentNavigatorKey: _rootKey,
        builder: (_, _) => const AdminProductosScreen(),
      ),
      GoRoute(
        path: '/admin/m/categorias',
        parentNavigatorKey: _rootKey,
        builder: (_, _) => const AdminCategoriasScreen(),
      ),
      GoRoute(
        path: '/admin/m/descuentos',
        parentNavigatorKey: _rootKey,
        builder: (_, _) => const AdminDescuentosScreen(),
      ),
      GoRoute(
        path: '/admin/m/recompensas',
        parentNavigatorKey: _rootKey,
        builder: (_, _) => const AdminRecompensasScreen(),
      ),
      GoRoute(
        path: '/admin/m/reportes',
        parentNavigatorKey: _rootKey,
        builder: (_, _) => const AdminReportesScreen(),
      ),
      GoRoute(
        path: '/admin/m/ganancias',
        parentNavigatorKey: _rootKey,
        builder: (_, _) => const AdminGananciasScreen(),
      ),
      GoRoute(
        path: '/admin/m/calculadora',
        parentNavigatorKey: _rootKey,
        builder: (_, _) => const AdminCalculadoraScreen(),
      ),
      GoRoute(
        path: '/admin/m/configuracion',
        parentNavigatorKey: _rootKey,
        builder: (_, _) => const AdminConfiguracionScreen(),
      ),
      GoRoute(
        path: '/admin/m/auditoria',
        parentNavigatorKey: _rootKey,
        builder: (_, _) => const AdminAuditoriaScreen(),
      ),
      // El detalle se abre SOBRE la barra del panel (navegador raíz).
      GoRoute(
        path: '/admin/venta/:source/:id',
        parentNavigatorKey: _rootKey,
        builder: (_, state) => SaleDetailScreen(
          source: state.pathParameters['source']!,
          id: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/producto/:slug',
        builder: (_, state) => ProductScreen(
          slug: state.pathParameters['slug']!,
          // Etiqueta de la animación de la foto (la manda la tarjeta tocada).
          heroTag: state.extra is String ? state.extra as String : null,
        ),
      ),
      GoRoute(path: '/ingresar', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/registro', builder: (_, _) => const RegisterScreen()),
      // Se abre sola al tocar el link del correo de "recuperar contraseña".
      GoRoute(path: '/nueva-clave', builder: (_, _) => const NewPasswordScreen()),
    ],
  );
});

class _NotFoundScreen extends StatelessWidget {
  const _NotFoundScreen();

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: EmptyView(
            icon: Icons.explore_off_rounded,
            title: 'No encontramos esa pantalla',
            subtitle: 'Puede que el enlace esté viejo o incompleto.',
            action: GoldButton(
              label: 'Ir al inicio',
              expand: false,
              onPressed: () => context.go('/'),
            ),
          ),
        ),
      );
}

/// Barra de navegación inferior (Inicio · Catálogo · Favoritos · Cuenta).
class _Shell extends ConsumerWidget {
  const _Shell({required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favCount = ref.watch(favoritesProvider).length;
    return PopScope(
      // "Atrás" desde Catálogo / Favoritos / Cuenta vuelve al Inicio; recién
      // desde el Inicio sale de la app (antes la cerraba de golpe desde
      // cualquier pestaña), 2026-11-14.
      canPop: shell.currentIndex == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) shell.goBranch(0);
      },
      child: _shellScaffold(favCount),
    );
  }

  Widget _shellScaffold(int favCount) {
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (i) =>
            shell.goBranch(i, initialLocation: i == shell.currentIndex),
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Inicio',
          ),
          const NavigationDestination(
            icon: Icon(Icons.grid_view_outlined),
            selectedIcon: Icon(Icons.grid_view_rounded),
            label: 'Catálogo',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: favCount > 0,
              label: Text('$favCount'),
              child: const Icon(Icons.favorite_border_rounded),
            ),
            selectedIcon: const Icon(Icons.favorite_rounded),
            label: 'Favoritos',
          ),
          const NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'Cuenta',
          ),
        ],
      ),
    );
  }
}
