import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/providers.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:hefesto/core/widgets/common.dart';
import 'package:hefesto/features/admin/clientes/cliente_detail_screen.dart';
import 'package:hefesto/features/admin/clientes/cliente_form_screen.dart';
import 'package:hefesto/features/admin/clientes/clientes_models.dart';
import 'package:hefesto/features/admin/clientes/clientes_providers.dart';
import 'package:hefesto/features/admin/clientes/clientes_screen.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:hefesto/features/admin/crecimiento/form_kit.dart';

import 'admin_crecimiento_harness.dart';
import 'admin_crecimiento_samples.dart';

final _page = CustomersPage.fromJson(sampleCustomersJson());
final _registered = CustomerDetail.fromJson(sampleCustomerDetailJson());
final _manual = CustomerDetail.fromJson(sampleManualDetailJson());

final _full = staffMe(['clientes', 'pedidos']);

List<Override> _listOverrides([CustomersPage? page]) =>
    [adminCustomersProvider.overrideWith((ref) async => page ?? _page)];

List<Override> _detailOverrides(CustomerDetail d) =>
    [adminCustomerProvider.overrideWith((ref, id) async => d)];

void main() {
  setUpAll(() async {
    await initializeDateFormatting('es_AR');
    await setUpFonts();
  });

  group('Lista de clientes', () {
    testWidgets('muestra clientes, niveles, totales y el botón de alta', (tester) async {
      await showScreen(tester, 'clientes_lista', const AdminClientesScreen(), me: _full, overrides: _listOverrides());
      expect(find.text('Juan Pérez'), findsOneWidget);
      expect(find.text('Ana Gómez'), findsOneWidget);
      expect(find.textContaining('Cliente de feria'), findsOneWidget);
      expect(find.text('Todos (3)'), findsOneWidget);
      expect(find.text('VIP (1)'), findsOneWidget);
      expect(find.text('Frecuente (1)'), findsOneWidget);
      expect(find.text('Nuevo (1)'), findsOneWidget);
      expect(find.text('Compras totales'), findsOneWidget);
      expect(find.text('Nuevo cliente'), findsOneWidget);
      expect(find.text('Manual'), findsOneWidget, reason: 'el cliente cargado a mano se distingue');
      expect(find.text('4 pedidos'), findsOneWidget);
    });

    testWidgets('el buscador filtra por nombre, teléfono o ciudad', (tester) async {
      await showScreen(tester, 'clientes_buscar', const AdminClientesScreen(), me: _full, overrides: _listOverrides());
      await tester.enterText(find.byType(TextField), 'oberá');
      await settle(tester, 2);
      expect(find.text('Ana Gómez'), findsOneWidget);
      expect(find.text('Juan Pérez'), findsNothing);
      expect(find.text('1 cliente'), findsNothing, reason: 'con filtro dice "Mostrando 1 de 3"');
      expect(find.text('Mostrando 1 de 3'), findsOneWidget);

      await tester.enterText(find.byType(TextField), '3757624148');
      await settle(tester, 2);
      expect(find.text('Juan Pérez'), findsOneWidget);
      expect(find.text('Ana Gómez'), findsNothing);

      await tester.enterText(find.byType(TextField), 'zzzz');
      await settle(tester, 2);
      expect(find.text('No se encontraron clientes'), findsOneWidget);
    });

    testWidgets('el filtro por nivel deja solo ese nivel (y se puede quitar)', (tester) async {
      await showScreen(tester, 'clientes_nivel', const AdminClientesScreen(), me: _full, overrides: _listOverrides());
      await tester.tap(find.text('VIP (1)'));
      await settle(tester, 2);
      expect(find.text('Ana Gómez'), findsOneWidget);
      expect(find.text('Juan Pérez'), findsNothing);
      await tester.tap(find.text('VIP (1)'));
      await settle(tester, 2);
      expect(find.text('Juan Pérez'), findsOneWidget);
    });

    testWidgets('sin overflow a 360dp con letra grande y en los 3 temas', (tester) async {
      for (final t in HefestoThemeMode.values) {
        await showScreen(
          tester,
          'clientes_lista_${t.name}_360',
          const AdminClientesScreen(),
          width: 360,
          textScale: t == HefestoThemeMode.dark ? 1.6 : 1,
          theme: t,
          me: _full,
          overrides: _listOverrides(),
        );
        expect(find.text('Juan Pérez'), findsOneWidget);
      }
    });

    testWidgets('lista vacía y error con "Reintentar"', (tester) async {
      await showScreen(
        tester,
        'clientes_vacio',
        const AdminClientesScreen(),
        me: _full,
        overrides: _listOverrides(CustomersPage.fromJson({'items': <dynamic>[]})),
      );
      expect(find.text('Todavía no hay clientes'), findsOneWidget);

      await showScreen(
        tester,
        'clientes_error',
        const AdminClientesScreen(),
        me: _full,
        overrides: [
          adminCustomersProvider.overrideWith((ref) async => throw ApiException('unavailable', 'No pudimos cargar los clientes.')),
        ],
      );
      expect(find.text('No pudimos cargar los clientes.'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);
    });

    testWidgets('sin permiso de ver: "Sin acceso"; sin permiso de crear: no hay botón de alta', (tester) async {
      await showScreen(
        tester,
        'clientes_sin_acceso',
        const AdminClientesScreen(),
        me: staffMe(['clientes'], actions: const []),
        overrides: _listOverrides(),
      );
      expect(find.text('Sin acceso'), findsOneWidget);

      await showScreen(
        tester,
        'clientes_solo_ver',
        const AdminClientesScreen(),
        me: staffMe(['clientes'], actions: const ['ver']),
        overrides: _listOverrides(),
      );
      expect(find.text('Juan Pérez'), findsOneWidget);
      expect(find.text('Nuevo cliente'), findsNothing);
    });

    testWidgets('el ícono de información explica los niveles con los umbrales reales', (tester) async {
      await showScreen(tester, 'clientes_niveles', const AdminClientesScreen(), me: _full, overrides: _listOverrides());
      await tester.tap(find.byTooltip('Cómo se calculan los niveles'));
      await settle(tester, 4);
      expect(find.text('Niveles de cliente'), findsOneWidget);
      expect(find.textContaining('10 pedidos'), findsOneWidget);
      expect(find.textContaining('\$150.000'), findsOneWidget);
    });
  });

  group('Ficha del cliente', () {
    testWidgets('registrado: contacto, WhatsApp, pedidos, puntos y nota', (tester) async {
      await showScreen(
        tester,
        'cliente_detalle',
        const CustomerDetailScreen(customerId: idJuan),
        height: 2000,
        me: _full,
        overrides: _detailOverrides(_registered),
      );
      expect(find.text('Juan Pérez'), findsWidgets);
      expect(find.text('WhatsApp'), findsOneWidget);
      expect(find.text('Llamar'), findsOneWidget);
      expect(find.text('HF-0042'), findsOneWidget);
      expect(find.text('HF-0031'), findsOneWidget);
      expect(find.text('120'), findsOneWidget, reason: 'saldo de puntos');
      expect(find.textContaining('PREMIO-AB12C'), findsOneWidget);
      expect(find.text('Guardar nota'), findsOneWidget);
      expect(find.byTooltip('Editar cliente'), findsNothing, reason: 'los registrados editan sus datos desde la tienda');
      expect(find.text('Le gusta el rojo oscuro'), findsOneWidget);
    });

    testWidgets('manual: se puede editar, sin puntos ni pedidos', (tester) async {
      await showScreen(
        tester,
        'cliente_detalle_manual',
        const CustomerDetailScreen(customerId: idFeria),
        height: 1400,
        me: _full,
        overrides: _detailOverrides(_manual),
      );
      expect(find.byTooltip('Editar cliente'), findsOneWidget);
      expect(find.textContaining('no tienen pedidos del sistema'), findsOneWidget);
      expect(find.text('Puntos Hefesto'.toUpperCase()), findsNothing);
      expect(find.text('Saldo'), findsNothing);
    });

    testWidgets('sin permiso de editar: no hay botón de guardar la nota ni de editar', (tester) async {
      await showScreen(
        tester,
        'cliente_detalle_solo_ver',
        const CustomerDetailScreen(customerId: idFeria),
        height: 1400,
        me: staffMe(['clientes'], actions: const ['ver']),
        overrides: _detailOverrides(_manual),
      );
      expect(find.byTooltip('Editar cliente'), findsNothing);
      expect(find.text('Guardar nota'), findsNothing);
    });

    testWidgets('360dp con letra grande no se desborda', (tester) async {
      await showScreen(
        tester,
        'cliente_detalle_360',
        const CustomerDetailScreen(customerId: idJuan),
        width: 360,
        height: 2400,
        textScale: 1.5,
        me: _full,
        overrides: _detailOverrides(_registered),
      );
      expect(find.text('WhatsApp'), findsOneWidget);
    });

    testWidgets('guardar la nota manda PUT con el origen y avisa', (tester) async {
      final api = FakeApi();
      await showScreen(
        tester,
        'cliente_nota',
        const CustomerDetailScreen(customerId: idJuan),
        height: 2000,
        me: _full,
        overrides: [
          ..._detailOverrides(_registered),
          apiClientProvider.overrideWithValue(api),
        ],
      );
      // Guardar está apagado hasta que cambia la nota.
      expect(tester.widget<GoldButton>(find.widgetWithText(GoldButton, 'Guardar nota')).onPressed, isNull);
      final note = find.widgetWithText(TextField, 'Le gusta el rojo oscuro');
      await tester.ensureVisible(note);
      await tester.enterText(note, '  Prefiere retirar en el local ');
      await tester.pump();
      final save = find.widgetWithText(GoldButton, 'Guardar nota');
      expect(tester.widget<GoldButton>(save).onPressed, isNotNull);
      await tester.ensureVisible(save);
      await tester.tap(save);
      await settle(tester, 3);

      final call = api.calls.single;
      expect(call.method, 'PUT');
      expect(call.path, '/admin/clientes/$idJuan/nota');
      expect(call.body, {'source': 'registered', 'note': 'Prefiere retirar en el local'});
      expect(find.text('Nota guardada'), findsOneWidget);
    });
  });

  group('Alta y edición de clientes manuales', () {
    testWidgets('alta: Guardar apagado hasta cargar algo; valida nombre y email', (tester) async {
      final api = FakeApi();
      await showScreen(
        tester,
        'cliente_alta',
        const CustomerFormScreen(),
        me: _full,
        overrides: [apiClientProvider.overrideWithValue(api)],
      );
      final save = find.widgetWithText(GoldButton, 'Crear cliente');
      expect(tester.widget<GoldButton>(save).onPressed, isNull);

      // Solo un email inválido: no deja guardar y marca los dos campos.
      await tester.enterText(find.widgetWithText(TextField, 'Email (opcional)'), 'no-es-email');
      await tester.pump();
      await tester.tap(save);
      await tester.pump();
      expectFieldAndBarError('Ingresá el nombre del cliente.');
      expect(find.text('El email no es válido.'), findsOneWidget);
      expect(api.calls, isEmpty);
    });

    testWidgets('alta: manda POST con los datos limpios', (tester) async {
      final api = FakeApi(onSend: (m, p, b) => {'id': idFeria});
      await showScreen(
        tester,
        'cliente_alta_ok',
        const CustomerFormScreen(),
        me: _full,
        overrides: [apiClientProvider.overrideWithValue(api)],
      );
      await tester.enterText(find.widgetWithText(TextField, 'Nombre y apellido'), '  Marta Ruiz ');
      await tester.enterText(find.widgetWithText(TextField, 'Teléfono / WhatsApp'), '3757 111222');
      await tester.enterText(find.widgetWithText(TextField, 'Ciudad'), 'Oberá');
      await tester.pump();
      await tester.tap(find.widgetWithText(GoldButton, 'Crear cliente'));
      await settle(tester, 3);
      final call = api.calls.single;
      expect(call.method, 'POST');
      expect(call.path, '/admin/clientes');
      expect(call.body, {'name': 'Marta Ruiz', 'email': '', 'phone': '3757 111222', 'city': 'Oberá', 'note': ''});
      expect(tester.takeException(), isNull);
    });

    testWidgets('un error del servidor se muestra en el formulario', (tester) async {
      final api = FakeApi(onSend: (m, p, b) => throw ApiException('invalid', 'Ingresá el nombre del cliente.', status: 422));
      await showScreen(
        tester,
        'cliente_alta_error',
        const CustomerFormScreen(),
        me: _full,
        overrides: [apiClientProvider.overrideWithValue(api)],
      );
      await tester.enterText(find.widgetWithText(TextField, 'Nombre y apellido'), 'Marta Ruiz');
      await tester.pump();
      await tester.tap(find.widgetWithText(GoldButton, 'Crear cliente'));
      await settle(tester, 3);
      // Un error que viene del SERVIDOR no tiene campo propio: se ve solo arriba de Guardar.
      expect(find.descendant(of: find.byType(SaveBar), matching: find.text('Ingresá el nombre del cliente.')), findsOneWidget);
      expect(tester.widget<GoldButton>(find.widgetWithText(GoldButton, 'Crear cliente')).onPressed, isNotNull,
          reason: 'sigue habilitado para corregir y reintentar');
    });

    testWidgets('edición: parte con los datos y manda PATCH solo si hay cambios', (tester) async {
      final api = FakeApi();
      await showScreen(
        tester,
        'cliente_edicion',
        CustomerFormScreen(customer: _manual.customer),
        me: _full,
        overrides: [apiClientProvider.overrideWithValue(api)],
      );
      expect(find.text('Editar cliente'), findsOneWidget);
      final save = find.widgetWithText(GoldButton, 'Guardar cambios');
      expect(tester.widget<GoldButton>(save).onPressed, isNull, reason: 'sin cambios no se guarda');
      await tester.enterText(find.widgetWithText(TextField, 'Ciudad'), 'Posadas');
      await tester.pump();
      expect(tester.widget<GoldButton>(save).onPressed, isNotNull);
      await tester.tap(save);
      await settle(tester, 3);
      final call = api.calls.single;
      expect(call.method, 'PATCH');
      expect(call.path, '/admin/clientes/$idFeria');
      expect((call.body as Map)['city'], 'Posadas');
    });
  });
}
