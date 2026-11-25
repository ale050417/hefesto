import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/api/models.dart';
import 'package:hefesto/core/providers.dart';
import 'package:hefesto/core/theme/app_theme.dart' show HefestoThemeMode;
import 'package:hefesto/features/admin/admin_models.dart';
import 'package:hefesto/features/admin/admin_more_screen.dart';
import 'package:hefesto/features/admin/admin_providers.dart';
import 'package:hefesto/features/admin/admin_shell.dart';
import 'package:hefesto/features/admin/dashboard_screen.dart';
import 'package:hefesto/features/admin/notificaciones/notifications_api.dart';
import 'package:hefesto/features/admin/notificaciones/notifications_bell.dart';
import 'package:hefesto/features/admin/notificaciones/notifications_models.dart';
import 'package:hefesto/features/admin/notificaciones/notifications_screen.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show Session, User;

import 'support/device_kit.dart' show Phone, pumpPhone, setUpDeviceKit, staffWith;
import 'support/notifications_kit.dart';
import 'support/produccion_fallas_filamentos_kit.dart';

Future<void> settle(WidgetTester tester, [int frames = 8]) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

final _session = Session(
  accessToken: 'token-de-prueba',
  tokenType: 'bearer',
  user: const User(
    id: 'u1',
    appMetadata: {},
    userMetadata: {},
    aud: 'authenticated',
    createdAt: '2026-01-01T00:00:00.000Z',
  ),
);

class _Stub extends StatelessWidget {
  const _Stub(this.title);
  final String title;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(title)),
        body: Center(child: Text('pantalla: $title')),
      );
}

/// El panel con las mismas rutas y navegadores que `lib/router.dart`.
GoRouter _panel({String at = '/admin'}) {
  final rootKey = GlobalKey<NavigatorState>(debugLabel: 'raíz');
  final router = GoRouter(
    navigatorKey: rootKey,
    initialLocation: at,
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => AdminShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/admin', builder: (_, _) => const AdminDashboardScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/admin/ventas', builder: (_, _) => const _Stub('Ventas')),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/admin/cola', builder: (_, _) => const _Stub('Cola')),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/admin/mas', builder: (_, _) => const AdminMoreScreen()),
          ]),
        ],
      ),
      GoRoute(
        path: notificationsRoute,
        parentNavigatorKey: rootKey,
        builder: (_, _) => const NotificationsScreen(),
      ),
      GoRoute(
        path: '/admin/m/:modulo',
        parentNavigatorKey: rootKey,
        builder: (_, state) => _Stub('Módulo ${state.pathParameters['modulo']}'),
      ),
      GoRoute(
        path: '/admin/venta/:source/:id',
        parentNavigatorKey: rootKey,
        builder: (_, state) => _Stub('Venta ${state.pathParameters['source']} ${state.pathParameters['id']}'),
      ),
      GoRoute(path: '/cuenta', builder: (_, _) => const _Stub('Cuenta')),
    ],
  );
  addTearDown(router.dispose);
  return router;
}

const _allModules = ['pedidos', 'consultas', 'filamentos', 'arreglos', 'calculadora', 'produccion'];

void main() {
  setUpAll(() async {
    await setUpKit();
    await setUpDeviceKit();
  });

  final admin = meWith({for (final m in _allModules) m: allActions});

  /// La pantalla sola (sin el panel alrededor).
  Future<FakeNotificationsApi> open(
    WidgetTester tester,
    String name, {
    NotificationsData? data,
    FakeNotificationsApi? api,
    MeInfo? who,
    HefestoThemeMode mode = HefestoThemeMode.dark,
    double width = 392,
    double textScale = 1,
  }) async {
    final fake = api ?? FakeNotificationsApi(data);
    await showScreen(
      tester,
      name,
      const NotificationsScreen(),
      width: width,
      mode: mode,
      textScale: textScale,
      me: who ?? admin,
      overrides: [notificationsApiProvider.overrideWithValue(fake)],
    );
    return fake;
  }

  /// El panel completo (barra inferior, campana, Inicio) en un teléfono.
  Future<FakeNotificationsApi> openPanel(
    WidgetTester tester, {
    FakeNotificationsApi? api,
    MeInfo? who,
    String at = '/admin',
    Phone phone = Phone.android,
    double textScale = 1,
    List<Override> extra = const [],
  }) async {
    final fake = api ?? FakeNotificationsApi();
    await pumpPhone(
      tester,
      const SizedBox.shrink(),
      phone: phone,
      textScale: textScale,
      me: who ?? staffWith(_allModules),
      router: _panel(at: at),
      overrides: [
        sessionProvider.overrideWith((ref) => Stream<Session?>.value(_session)),
        adminDashboardProvider.overrideWith((ref) async => AdminDashboard.fromJson({})),
        notificationsApiProvider.overrideWithValue(fake),
        ...extra,
      ],
    );
    return fake;
  }

  NotificationsState stateOf(WidgetTester tester, Type screen) =>
      ProviderScope.containerOf(tester.element(find.byType(screen))).read(notificationsProvider);

  Finder dot(String id) => find.byKey(ValueKey('notif-dot-$id'));
  Finder kindSwitch(String key) => find.byKey(ValueKey('notif-kind-$key'));
  bool isOn(WidgetTester tester, String key) => tester.widget<SwitchListTile>(kindSwitch(key)).value;

  group('lista', () {
    testWidgets('muestra título, texto y hace cuánto; lo nuevo lleva su punto', (tester) async {
      final now = DateTime.now();
      final data = NotificationsData.fromJson({
        'items': [
          notifJson('n1', createdAt: now.subtract(const Duration(minutes: 5)).toUtc().toIso8601String()),
          notifJson('n2',
              kind: 'order',
              title: 'Pedido nuevo HF-0042',
              body: 'Juan Pérez',
              link: '/admin/pedidos',
              unread: false,
              createdAt: now.subtract(const Duration(hours: 3)).toUtc().toIso8601String()),
          notifJson('n3', kind: 'other', title: 'Aviso general', body: null, link: null, unread: false),
        ],
        'unread': 1,
        'kinds': kindsJson(),
      });
      await open(tester, 'notificaciones', data: data);
      expect(find.text('Notificaciones'), findsOneWidget);
      expect(find.text('Consulta nueva'), findsOneWidget);
      expect(find.text('Antonella: Trofeo (x4) — Sabunim Itati'), findsOneWidget);
      expect(find.text('hace 5 min'), findsOneWidget);
      expect(find.text('Pedido nuevo HF-0042'), findsOneWidget);
      expect(find.text('hace 3 h'), findsOneWidget);
      expect(find.text('Aviso general'), findsOneWidget);
      expect(dot('n1'), findsOneWidget);
      expect(dot('n2'), findsNothing);
      expect(dot('n3'), findsNothing);
    });

    testWidgets('abrirla marca todo como visto DESPUÉS de cargar, y los puntos siguen en esta visita', (tester) async {
      final api = await open(tester, 'notificaciones_vistas');
      expect(api.calls, ['list', 'read']);
      expect(api.reads, 1);
      expect(stateOf(tester, NotificationsScreen).unread, 0);
      // Lo que estaba sin ver al entrar conserva su punto.
      expect(dot('n1'), findsOneWidget);
      expect(dot('n2'), findsOneWidget);
      expect(dot('n3'), findsNothing);
    });

    testWidgets('sin nada sin ver no se llama a "marcar como visto"', (tester) async {
      final api = await open(tester, 'notificaciones_todo_visto', data: sampleNotifications.allRead());
      expect(api.calls, ['list']);
      expect(find.byKey(const ValueKey('notif-dot-n1')), findsNothing);
    });

    testWidgets('sin avisos: "Sin novedades. ¡Todo al día!"', (tester) async {
      await open(tester, 'notificaciones_vacio', data: const NotificationsData());
      expect(find.text('Sin novedades. ¡Todo al día!'), findsOneWidget);
    });

    testWidgets('deslizar hacia abajo vuelve a pedir la lista', (tester) async {
      final api = await open(tester, 'notificaciones_actualizar');
      final before = api.lists;
      await tester.drag(find.text('Consulta nueva'), const Offset(0, 320));
      await settle(tester, 20);
      expect(api.lists, greaterThan(before));
    });

    testWidgets('error del servidor con "Reintentar", y al reintentar aparece la lista', (tester) async {
      final api = FakeNotificationsApi()..failList = ApiException('unavailable', 'No pudimos traer las notificaciones.');
      await open(tester, 'notificaciones_error', api: api);
      expect(find.text('No pudimos traer las notificaciones.'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);
      expect(api.calls, ['list'], reason: 'sin lista no se marca nada como visto');
      // Sin datos, el engranaje no abre nada.
      expect(tester.widget<IconButton>(find.widgetWithIcon(IconButton, Icons.settings_rounded)).onPressed, isNull);

      api.failList = null;
      await tester.tap(find.text('Reintentar'));
      await settle(tester);
      expect(find.text('Consulta nueva'), findsOneWidget);
      expect(api.reads, 1);
    });

    testWidgets('si "marcar como visto" falla, la pantalla sigue andando y el globito queda', (tester) async {
      final api = FakeNotificationsApi()..failRead = ApiException('unavailable', 'Sin conexión.');
      await open(tester, 'notificaciones_error_visto', api: api);
      expect(find.text('Consulta nueva'), findsOneWidget);
      expect(find.text('Sin conexión.'), findsNothing);
      expect(stateOf(tester, NotificationsScreen).unread, 2);
    });
  });

  group('qué avisos recibir', () {
    testWidgets('el engranaje lista los tipos con su nombre, explicación e interruptor', (tester) async {
      await open(tester, 'notificaciones_tipos');
      await tester.tap(find.byTooltip('Qué avisos recibir'));
      await settle(tester);
      expect(find.text('Qué avisos recibir'), findsOneWidget);
      expect(find.text('Consultas nuevas'), findsOneWidget);
      expect(find.text('Cuando atención al cliente carga una consulta para cotizar.'), findsOneWidget);
      expect(find.byType(SwitchListTile), findsNWidgets(4));
      expect(isOn(tester, 'inquiry'), isTrue);
      expect(isOn(tester, 'low_stock'), isFalse);
    });

    testWidgets('apagar un tipo guarda al instante la lista completa de silenciados y actualiza la lista', (tester) async {
      final api = await open(tester, 'notificaciones_apagar');
      await tester.tap(find.byTooltip('Qué avisos recibir'));
      await settle(tester);
      final lists = api.lists;
      await tester.tap(kindSwitch('order'));
      await settle(tester);
      expect(api.saved, [
        ['order', 'low_stock'],
      ]);
      expect(isOn(tester, 'order'), isFalse);
      expect(api.lists, greaterThan(lists), reason: 'vuelve a pedir la lista');
      // El servidor ya no manda los pedidos.
      expect(find.text('Pedido nuevo HF-0042'), findsNothing);

      // Prender uno que estaba apagado lo saca de la lista.
      await tester.tap(kindSwitch('low_stock'));
      await settle(tester);
      expect(api.saved.last, ['order']);
      expect(isOn(tester, 'low_stock'), isTrue);
    });

    testWidgets('si el servidor rechaza el cambio, el interruptor vuelve y se ve el motivo', (tester) async {
      final api = await open(tester, 'notificaciones_apagar_error');
      api.failSave = ApiException('forbidden', 'No pudimos guardar tus avisos.');
      await tester.tap(find.byTooltip('Qué avisos recibir'));
      await settle(tester);
      await tester.tap(kindSwitch('inquiry'));
      await settle(tester);
      expect(api.saved, isEmpty);
      expect(isOn(tester, 'inquiry'), isTrue);
      expect(find.text('No pudimos guardar tus avisos.'), findsOneWidget);
      expect(stateOf(tester, NotificationsScreen).data!.mutedKeys, ['low_stock']);
      expect(find.text('Consulta nueva'), findsOneWidget);

      // El próximo intento que sale bien borra el aviso de error.
      api.failSave = null;
      await tester.tap(kindSwitch('inquiry'));
      await settle(tester);
      expect(api.saved.single, ['inquiry', 'low_stock']);
      expect(find.text('No pudimos guardar tus avisos.'), findsNothing);
    });

    testWidgets('un tipo que la app no conoce se muestra con lo que mande el servidor', (tester) async {
      final data = NotificationsData.fromJson({
        'items': <Object>[],
        'kinds': [
          {'key': 'algo_nuevo', 'enabled': true},
          {'key': 'review', 'label': 'Reseñas', 'description': 'Cuando alguien deja una reseña.', 'enabled': false},
        ],
      });
      final api = await open(tester, 'notificaciones_tipo_nuevo', data: data);
      await tester.tap(find.byTooltip('Qué avisos recibir'));
      await settle(tester);
      expect(find.text('algo_nuevo'), findsOneWidget);
      expect(find.text('Reseñas'), findsOneWidget);
      await tester.tap(kindSwitch('algo_nuevo'));
      await settle(tester);
      expect(api.saved.single, ['algo_nuevo', 'review']);
    });
  });

  group('campana y tarjeta de Inicio', () {
    testWidgets('el panel muestra el globito con lo que falta ver y "Tenés N novedades"', (tester) async {
      final api = await openPanel(tester);
      expect(api.calls, ['list'], reason: 'entrar al panel trae la lista pero no marca nada como visto');
      final bell = find.byType(NotificationsBell);
      expect(bell, findsOneWidget);
      expect(find.descendant(of: bell, matching: find.text('2')), findsOneWidget);
      expect(find.byTooltip('Notificaciones: 2 sin ver'), findsOneWidget);
      expect(find.text('Tenés 2 novedades'), findsOneWidget);
      expect(find.descendant(of: find.byType(NotificationsBanner), matching: find.text('Consulta nueva')), findsOneWidget);
    });

    testWidgets('sin nada sin ver no hay globito ni tarjeta', (tester) async {
      await openPanel(tester, api: FakeNotificationsApi(sampleNotifications.allRead()));
      expect(find.byTooltip('Notificaciones'), findsOneWidget);
      expect(find.descendant(of: find.byType(NotificationsBell), matching: find.byType(Text)), findsNothing);
      expect(find.textContaining('Tenés'), findsNothing);
    });

    testWidgets('si las notificaciones no cargan, el panel se ve igual (sin globito)', (tester) async {
      await openPanel(tester, api: FakeNotificationsApi()..failList = ApiException('unavailable', 'Sin conexión.'));
      expect(find.byType(NotificationsBell), findsOneWidget);
      expect(find.text('Sin conexión.'), findsNothing);
      expect(find.textContaining('Tenés'), findsNothing);
    });

    testWidgets('la campana abre la pantalla, que marca como visto: al volver no queda globito', (tester) async {
      final api = await openPanel(tester);
      await tester.tap(find.byType(NotificationsBell));
      await settle(tester);
      expect(find.byType(NotificationsScreen), findsOneWidget);
      expect(api.reads, 1);
      await tester.tap(find.byTooltip('Atrás'));
      await settle(tester);
      expect(find.byType(NotificationsScreen), findsNothing);
      expect(find.byTooltip('Notificaciones'), findsOneWidget);
      expect(find.textContaining('Tenés'), findsNothing);
    });

    testWidgets('la tarjeta de Inicio también abre la pantalla', (tester) async {
      await openPanel(tester);
      await tester.tap(find.text('Tenés 2 novedades'));
      await settle(tester);
      expect(find.byType(NotificationsScreen), findsOneWidget);
    });

    testWidgets('"Más" tiene la entrada Notificaciones con lo que falta ver', (tester) async {
      await openPanel(tester, at: '/admin/mas');
      final entry = find.widgetWithText(ListTile, 'Notificaciones');
      await tester.scrollUntilVisible(entry, 200, scrollable: find.byType(Scrollable).first);
      expect(find.descendant(of: entry, matching: find.text('2 sin ver')), findsOneWidget);
      await tester.tap(entry);
      await settle(tester);
      expect(find.byType(NotificationsScreen), findsOneWidget);
    });

    testWidgets('con el panel a la vista se actualiza cada minuto; en segundo plano no, y al volver sí', (tester) async {
      final api = await openPanel(tester);
      expect(api.lists, 1);
      await tester.pump(const Duration(seconds: 61));
      await tester.pump();
      expect(api.lists, 2);
      // Entra un aviso nuevo: el globito sube solo.
      api.data = NotificationsData.fromJson({
        'items': [notifJson('n0', title: 'Otra consulta'), ...(notificationsJson()['items'] as List)],
        'unread': 3,
        'kinds': kindsJson(),
      });
      await tester.pump(const Duration(seconds: 61));
      await tester.pump();
      expect(api.lists, 3);
      expect(find.text('Tenés 3 novedades'), findsOneWidget);
      expect(find.descendant(of: find.byType(NotificationsBanner), matching: find.text('Otra consulta')), findsOneWidget);

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump(const Duration(minutes: 5));
      expect(api.lists, 3, reason: 'con la app en segundo plano no se pide nada');

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      expect(api.lists, 4, reason: 'al volver a la app se actualiza enseguida');
      await tester.pump(const Duration(seconds: 61));
      await tester.pump();
      expect(api.lists, 5);
    });
  });

  group('tocar un aviso', () {
    testWidgets('una consulta abre Consultas', (tester) async {
      await openPanel(tester, at: notificationsRoute);
      await tester.tap(find.text('Consulta nueva'));
      await settle(tester);
      expect(find.text('pantalla: Módulo consultas'), findsOneWidget);
    });

    testWidgets('un pedido con id abre el detalle de esa venta', (tester) async {
      await openPanel(tester, at: notificationsRoute);
      await tester.tap(find.text('Pedido nuevo HF-0042'));
      await settle(tester);
      expect(find.text('pantalla: Venta online 0b8f6c1e-2a3d-4e5f-8a9b-1c2d3e4f5a6b'), findsOneWidget);
    });

    testWidgets('producción lleva a la pestaña Cola (cierra las notificaciones)', (tester) async {
      final data = NotificationsData.fromJson({
        'items': [notifJson('p1', kind: 'other', title: 'Hay trabajos demorados', link: '/admin/produccion')],
        'unread': 1,
      });
      await openPanel(tester, at: notificationsRoute, api: FakeNotificationsApi(data));
      await tester.tap(find.text('Hay trabajos demorados'));
      await settle(tester);
      expect(find.byType(NotificationsScreen), findsNothing);
      expect(find.text('pantalla: Cola'), findsOneWidget);
    });

    testWidgets('sin permiso sobre el módulo no se abre y se avisa', (tester) async {
      await openPanel(tester, at: notificationsRoute, who: staffWith(['pedidos']));
      await tester.tap(find.text('Consulta nueva'));
      await settle(tester);
      expect(find.text('pantalla: Módulo consultas'), findsNothing);
      expect(find.text('Tu cuenta no tiene acceso a esa sección.'), findsOneWidget);
    });

    testWidgets('un aviso sin destino no hace nada', (tester) async {
      await openPanel(tester, at: notificationsRoute);
      await tester.tap(find.text('Aviso general'));
      await settle(tester);
      expect(find.byType(NotificationsScreen), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('teléfono chico, letra grande y temas', () {
    for (final mode in HefestoThemeMode.values) {
      testWidgets('lista y tipos en ${mode.name} (360 de ancho, letra 1,3×)', (tester) async {
        await open(tester, 'notificaciones_${mode.name}_360', mode: mode, width: 360, textScale: 1.3);
        expect(tester.takeException(), isNull);
        await tester.tap(find.byTooltip('Qué avisos recibir'));
        await settle(tester);
        expect(tester.takeException(), isNull);
        expect(find.text('Filamento bajo'), findsOneWidget);
      });
    }

    for (final phone in Phone.both) {
      testWidgets('el panel con campana y tarjeta entra en ${phone.name} con letra 1,3×', (tester) async {
        await openPanel(tester, phone: phone, textScale: 1.3);
        expect(find.text('Tenés 2 novedades'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }
  });
}
