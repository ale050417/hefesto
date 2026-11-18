import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/api/models.dart';
import 'package:hefesto/core/theme/app_theme.dart' show HefestoThemeMode;
import 'package:hefesto/features/admin/admin_models.dart';
import 'package:hefesto/features/admin/admin_providers.dart';
import 'package:hefesto/features/admin/pendientes/pendientes_api.dart';
import 'package:hefesto/features/admin/pendientes/pendientes_models.dart';
import 'package:hefesto/features/admin/pendientes/pendientes_screen.dart';
import 'package:hefesto/features/admin/sales_screen.dart';

import 'support/produccion_fallas_filamentos_kit.dart';
import 'support/sales_kit.dart';

Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  setUpAll(setUpKit);

  final admin = meWith({'pedidos': allActions});
  // Operador: anota y tilda, pero solo borra lo suyo.
  final operador = meWith({'pedidos': ['ver', 'crear', 'editar']}, role: 'operator');
  // Solo mira.
  final lector = meWith({'pedidos': ['ver']}, role: 'operator');

  Future<FakePendientesApi> open(
    WidgetTester tester,
    String name, {
    MeInfo? who,
    PendientesData? data,
    HefestoThemeMode mode = HefestoThemeMode.dark,
    double width = 392,
  }) async {
    final api = FakePendientesApi(data);
    await showScreen(
      tester,
      name,
      const PendientesScreen(),
      width: width,
      mode: mode,
      me: who ?? admin,
      overrides: [pendientesApiProvider.overrideWithValue(api)],
    );
    return api;
  }

  Finder rowOf(String id) => find.byKey(ValueKey('pendiente-$id'));
  Finder inRow(String id, Finder f) => find.descendant(of: rowOf(id), matching: f);

  group('listado', () {
    testWidgets('muestra los abiertos con quién y cuándo; los hechos, plegados', (tester) async {
      await open(tester, 'pendientes');
      expect(find.text('Pendientes del equipo'), findsOneWidget);
      expect(find.text('3 pendientes'), findsOneWidget);
      expect(find.text('Cargar el pedido de Nico (2 llaveros)'), findsOneWidget);
      expect(find.text('Mandarle la cotización a Carla'), findsOneWidget);
      expect(inRow('t1', find.textContaining('Agustín · ')), findsOneWidget);
      expect(inRow('t2', find.textContaining('Antonella · ')), findsOneWidget);
      // Los hechos no se ven hasta abrir la sección.
      expect(find.text('Hechos (2)'), findsOneWidget);
      expect(find.text('Avisarle a Pedro que está listo'), findsNothing);
      expect(find.byType(Checkbox), findsNWidgets(3));
      expect(tester.widgetList<Checkbox>(find.byType(Checkbox)).every((c) => c.value == false), isTrue);
    });

    testWidgets('"Hechos (n)" se abre y muestra quién lo tildó', (tester) async {
      await open(tester, 'pendientes_hechos');
      await tester.tap(find.text('Hechos (2)'));
      await settle(tester);
      expect(find.text('Avisarle a Pedro que está listo'), findsOneWidget);
      expect(inRow('t4', find.textContaining('lo tildó Antonella el ')), findsOneWidget);
      expect(tester.widget<Checkbox>(inRow('t4', find.byType(Checkbox))).value, isTrue);
      // Y se vuelve a plegar.
      await tester.tap(find.text('Hechos (2)'));
      await settle(tester);
      expect(find.text('Avisarle a Pedro que está listo'), findsNothing);
    });

    testWidgets('sin pendientes explica para qué sirve', (tester) async {
      await open(tester, 'pendientes_vacio', data: const PendientesData(open: [], done: []));
      expect(find.text('Nada pendiente'), findsOneWidget);
      expect(find.textContaining('No hay pendientes. Acá se anota lo que falta'), findsOneWidget);
      expect(find.textContaining('Hechos'), findsNothing);
    });

    testWidgets('error del servidor con "Reintentar"', (tester) async {
      await showScreen(
        tester,
        'pendientes_error',
        const PendientesScreen(),
        me: admin,
        overrides: [
          pendientesProvider.overrideWith((ref) => throw ApiException('unavailable', 'No pudimos traer los pendientes.')),
        ],
      );
      expect(find.text('No pudimos traer los pendientes.'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);
    });

    testWidgets('sin permiso de ver pedidos no se muestra nada', (tester) async {
      await open(tester, 'pendientes_sin_acceso', who: meWith({'clientes': allActions}, role: 'operator'));
      expect(find.text('Sin acceso'), findsOneWidget);
      expect(find.byType(Checkbox), findsNothing);
    });
  });

  group('anotar', () {
    testWidgets('con "Enviar" del teclado: lo manda recortado, limpia el campo y aparece arriba', (tester) async {
      final api = await open(tester, 'pendientes_anotar');
      await tester.enterText(find.byType(TextField), '  Cotizar los mates de Juli  ');
      await tester.testTextInput.receiveAction(TextInputAction.send);
      await settle(tester);
      expect(api.created, ['Cotizar los mates de Juli']);
      expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, isEmpty);
      expect(find.text('Cotizar los mates de Juli'), findsOneWidget);
      expect(find.text('4 pendientes'), findsOneWidget);
    });

    testWidgets('con el botón; vacío no se puede', (tester) async {
      final api = await open(tester, 'pendientes_anotar_boton');
      final send = find.widgetWithIcon(IconButton, Icons.send_rounded);
      expect(tester.widget<IconButton>(send).onPressed, isNull);
      await tester.enterText(find.byType(TextField), '   ');
      await tester.pump();
      expect(tester.widget<IconButton>(send).onPressed, isNull);
      await tester.testTextInput.receiveAction(TextInputAction.send);
      await settle(tester);
      expect(api.created, isEmpty);

      await tester.enterText(find.byType(TextField), 'Comprar bolsas');
      await tester.pump();
      await tester.tap(send);
      await settle(tester);
      expect(api.created, ['Comprar bolsas']);
    });

    testWidgets('el campo corta en el largo máximo del servidor', (tester) async {
      await open(tester, 'pendientes_anotar_largo',
          data: PendientesData(open: samplePendientes.open, done: const [], maxLength: 20));
      await tester.enterText(find.byType(TextField), 'x' * 50);
      await tester.pump();
      expect(tester.widget<TextField>(find.byType(TextField)).controller!.text.length, 20);
    });

    testWidgets('un rechazo del servidor se ve y el texto no se pierde', (tester) async {
      final api = await open(tester, 'pendientes_anotar_error');
      api.failWith = ApiException('forbidden', 'No tenés permiso para esta acción.');
      await tester.enterText(find.byType(TextField), 'Llamar a Nico');
      await tester.testTextInput.receiveAction(TextInputAction.send);
      await settle(tester);
      expect(find.text('No tenés permiso para esta acción.'), findsOneWidget);
      expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, 'Llamar a Nico');
    });

    testWidgets('quien solo mira no tiene dónde anotar ni puede tildar', (tester) async {
      await open(tester, 'pendientes_solo_ver', who: lector);
      expect(find.byType(TextField), findsNothing);
      expect(tester.widgetList<Checkbox>(find.byType(Checkbox)).every((c) => c.onChanged == null), isTrue);
      // Lo suyo sí lo puede borrar (regla del servidor: quien lo anotó).
      expect(find.byTooltip('Borrar pendiente'), findsOneWidget);
      expect(inRow('t1', find.byTooltip('Borrar pendiente')), findsOneWidget);
    });
  });

  group('tildar', () {
    testWidgets('tildar lo pasa a hechos y avisa', (tester) async {
      final api = await open(tester, 'pendientes_tildar', who: operador);
      await tester.tap(inRow('t2', find.byType(Checkbox)));
      await settle(tester);
      expect(api.toggled.single, (id: 't2', done: true));
      expect(find.text('Pendiente hecho'), findsOneWidget);
      expect(find.text('2 pendientes'), findsOneWidget);
      expect(find.text('Hechos (3)'), findsOneWidget);
      expect(find.text('Mandarle la cotización a Carla'), findsNothing, reason: 'los hechos siguen plegados');
    });

    testWidgets('destildar un hecho lo devuelve a los abiertos', (tester) async {
      final api = await open(tester, 'pendientes_destildar', who: operador);
      await tester.tap(find.text('Hechos (2)'));
      await settle(tester);
      await tester.tap(inRow('t4', find.byType(Checkbox)));
      await settle(tester);
      expect(api.toggled.single, (id: 't4', done: false));
      expect(find.text('4 pendientes'), findsOneWidget);
      expect(find.text('Hechos (1)'), findsOneWidget);
      expect(tester.widget<Checkbox>(inRow('t4', find.byType(Checkbox))).value, isFalse);
    });

    testWidgets('si otro lo borró mientras tanto, se ve el aviso del servidor y la lista se actualiza', (tester) async {
      final api = await open(tester, 'pendientes_tildar_error', who: operador);
      api.failWith = ApiException('not_found', 'Ese pendiente ya no existe.');
      final before = api.lists;
      await tester.tap(inRow('t1', find.byType(Checkbox)));
      await settle(tester);
      expect(find.text('Ese pendiente ya no existe.'), findsOneWidget);
      expect(api.lists, greaterThan(before), reason: 'vuelve a pedir la lista');
    });
  });

  group('borrar', () {
    testWidgets('el operador solo puede borrar los suyos', (tester) async {
      await open(tester, 'pendientes_borrar_operador', who: operador);
      expect(inRow('t1', find.byTooltip('Borrar pendiente')), findsOneWidget);
      expect(inRow('t2', find.byTooltip('Borrar pendiente')), findsNothing);
      expect(inRow('t3', find.byTooltip('Borrar pendiente')), findsNothing);
    });

    testWidgets('quien puede eliminar pedidos borra cualquiera, con confirmación', (tester) async {
      final api = await open(tester, 'pendientes_borrar');
      expect(find.byTooltip('Borrar pendiente'), findsNWidgets(3));
      await tester.tap(inRow('t2', find.byTooltip('Borrar pendiente')));
      await settle(tester);
      expect(find.text('¿Borrar este pendiente?'), findsOneWidget);
      // El diálogo muestra el texto de lo que se va a borrar.
      expect(find.descendant(of: find.byType(AlertDialog), matching: find.text('Mandarle la cotización a Carla')), findsOneWidget);
      // Cancelar no borra.
      await tester.tap(find.widgetWithText(TextButton, 'Cancelar'));
      await settle(tester);
      expect(api.deleted, isEmpty);

      await tester.tap(inRow('t2', find.byTooltip('Borrar pendiente')));
      await settle(tester);
      await tester.tap(find.widgetWithText(TextButton, 'Borrar'));
      await settle(tester);
      expect(api.deleted, ['t2']);
      expect(find.text('Pendiente borrado'), findsOneWidget);
      expect(find.text('Mandarle la cotización a Carla'), findsNothing);
      expect(find.text('2 pendientes'), findsOneWidget);
    });

    testWidgets('un rechazo (403) se muestra tal cual', (tester) async {
      final api = await open(tester, 'pendientes_borrar_error');
      api.failWith = ApiException('forbidden', 'Solo puede borrarlo quien lo anotó.');
      await tester.tap(inRow('t1', find.byTooltip('Borrar pendiente')));
      await settle(tester);
      await tester.tap(find.widgetWithText(TextButton, 'Borrar'));
      await settle(tester);
      expect(find.text('Solo puede borrarlo quien lo anotó.'), findsOneWidget);
      expect(find.text('Cargar el pedido de Nico (2 llaveros)'), findsOneWidget);
    });
  });

  group('entrada en Ventas', () {
    final sales = SalesPage.fromJson({
      'total': 1,
      'items': [
        {'id': 'b', 'source': 'manual', 'date': '2026-10-29T10:00:00.000Z', 'customerName': 'Cliente de feria', 'label': '5 llaveros', 'ref': null, 'paymentMethod': 'cash', 'status': 'delivered', 'total': 10000},
      ],
    });

    testWidgets('arriba de la lista, con la cantidad; abre la pantalla y al tildar baja el número', (tester) async {
      final api = FakePendientesApi();
      await showScreen(
        tester,
        'ventas_pendientes_entrada',
        const AdminSalesScreen(),
        me: admin,
        overrides: [
          adminSalesProvider.overrideWith((ref, f) async => sales),
          ...salesKitOverrides(api: api),
        ],
      );
      final entry = find.text('Pendientes del equipo · 3');
      expect(entry, findsOneWidget);
      // Va antes que las ventas.
      expect(tester.getTopLeft(entry).dy < tester.getTopLeft(find.text('Cliente de feria')).dy, isTrue);
      await tester.tap(entry);
      await settle(tester);
      expect(find.byType(PendientesScreen), findsOneWidget);
      await tester.tap(inRow('t1', find.byType(Checkbox)));
      await settle(tester);
      Navigator.of(tester.element(find.byType(PendientesScreen))).pop();
      await settle(tester);
      expect(find.text('Pendientes del equipo · 2'), findsOneWidget);
    });

    testWidgets('si los pendientes no cargan, la entrada queda sin número y Ventas sigue andando', (tester) async {
      await showScreen(
        tester,
        'ventas_pendientes_entrada_error',
        const AdminSalesScreen(),
        me: admin,
        overrides: [
          adminSalesProvider.overrideWith((ref, f) async => sales),
          salesNowProvider.overrideWithValue(() => salesTestNow),
          pendientesProvider.overrideWith((ref) => throw ApiException('unavailable', 'Sin conexión.')),
        ],
      );
      expect(find.text('Pendientes del equipo'), findsOneWidget);
      expect(find.text('Cliente de feria'), findsOneWidget);
    });
  });

  group('temas', () {
    for (final mode in HefestoThemeMode.values) {
      testWidgets('pendientes en ${mode.name} (360 de ancho)', (tester) async {
        await open(tester, 'pendientes_${mode.name}_360', mode: mode, width: 360);
        await tester.tap(find.text('Hechos (2)'));
        await settle(tester);
        expect(tester.takeException(), isNull);
        expect(find.text('Reponer bolsas'), findsOneWidget);
      });
    }
  });
}
