import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/providers.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:hefesto/core/widgets/common.dart';
import 'package:hefesto/features/admin/descuentos/cupon_form_screen.dart';
import 'package:hefesto/features/admin/descuentos/descuentos_models.dart';
import 'package:hefesto/features/admin/descuentos/descuentos_providers.dart';
import 'package:hefesto/features/admin/descuentos/descuentos_screen.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'admin_crecimiento_harness.dart';
import 'admin_crecimiento_samples.dart';

final _page = CouponsPage.fromJson(sampleCouponsJson());
final _options = CouponOptions.fromJson(sampleCouponOptionsJson());
final _full = staffMe(['descuentos']);

List<Override> _listOverrides([CouponsPage? page]) =>
    [adminCouponsProvider.overrideWith((ref) async => page ?? _page)];

List<Override> _formOverrides(FakeApi api) => [
      apiClientProvider.overrideWithValue(api),
      adminCouponOptionsProvider.overrideWith((ref) async => _options),
    ];

Future<void> _openMenu(WidgetTester tester, int card) async {
  await tester.tap(find.byTooltip('Acciones del cupón').at(card));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 300));
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('es_AR');
    await setUpFonts();
  });

  group('Lista de cupones', () {
    testWidgets('muestra códigos, estados, vencimientos, usos y totales', (tester) async {
      await showScreen(tester, 'descuentos_lista', const AdminDescuentosScreen(), height: 1500, me: _full, overrides: _listOverrides());
      expect(find.text('HEFESTO15'), findsOneWidget);
      expect(find.text('MATE2000'), findsOneWidget);
      expect(find.text('CUMPLE10'), findsOneWidget);
      expect(find.text('15%'), findsOneWidget);
      expect(find.text(r'$2.000'), findsNWidgets(2));
      expect(find.text('Activo'), findsNWidgets(2));
      expect(find.text('Pausado'), findsOneWidget);
      expect(find.text('Vencido'), findsOneWidget);
      expect(find.text('Vence el 31 dic 2026'), findsOneWidget);
      expect(find.text('Venció el 30 jun 2026'), findsOneWidget);
      expect(find.text('Sin vencimiento'), findsNWidgets(2));
      expect(find.textContaining('37/100 usos'), findsOneWidget);
      expect(find.textContaining('mín. \$15.000'), findsOneWidget);
      expect(find.text('Cumpleaños'), findsOneWidget);
      expect(find.text('Premio'), findsOneWidget);
      expect(find.text('Cupones activos'), findsOneWidget);
      expect(find.text('92'), findsOneWidget, reason: 'usos totales');
      expect(find.text('Todos (4)'), findsOneWidget);
      expect(find.text('Pausados (1)'), findsOneWidget);
      expect(find.text('Crear cupón'), findsOneWidget);
    });

    testWidgets('el filtro de estado y el buscador reducen la lista', (tester) async {
      await showScreen(tester, 'descuentos_filtro', const AdminDescuentosScreen(), height: 1500, me: _full, overrides: _listOverrides());
      await tester.tap(find.text('Pausados (1)'));
      await settle(tester, 2);
      expect(find.text('MATE2000'), findsOneWidget);
      expect(find.text('HEFESTO15'), findsNothing);
      await tester.tap(find.text('Pausados (1)'));
      await settle(tester, 2);
      expect(find.text('HEFESTO15'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'cumple');
      await settle(tester, 2);
      expect(find.text('CUMPLE10'), findsOneWidget);
      expect(find.text('HEFESTO15'), findsNothing);
      expect(find.text('Mostrando 1 de 4'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'nadaquever');
      await settle(tester, 2);
      expect(find.text('No hay cupones para mostrar'), findsOneWidget);
    });

    testWidgets('sin overflow a 360dp con letra grande y en los 3 temas', (tester) async {
      for (final t in HefestoThemeMode.values) {
        await showScreen(
          tester,
          'descuentos_lista_${t.name}_360',
          const AdminDescuentosScreen(),
          width: 360,
          height: 1900,
          textScale: t == HefestoThemeMode.dark ? 1.5 : 1,
          theme: t,
          me: _full,
          overrides: _listOverrides(),
        );
        expect(find.text('HEFESTO15'), findsOneWidget);
      }
    });

    testWidgets('lista vacía, error con "Reintentar" y sin acceso', (tester) async {
      await showScreen(
        tester,
        'descuentos_vacio',
        const AdminDescuentosScreen(),
        me: _full,
        overrides: _listOverrides(CouponsPage.fromJson({'items': <dynamic>[]})),
      );
      expect(find.text('Todavía no hay cupones'), findsOneWidget);

      await showScreen(
        tester,
        'descuentos_error',
        const AdminDescuentosScreen(),
        me: _full,
        overrides: [adminCouponsProvider.overrideWith((ref) async => throw ApiException('unavailable', 'No pudimos cargar los cupones.'))],
      );
      expect(find.text('No pudimos cargar los cupones.'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);

      await showScreen(
        tester,
        'descuentos_sin_acceso',
        const AdminDescuentosScreen(),
        me: staffMe(['descuentos'], actions: const []),
        overrides: _listOverrides(),
      );
      expect(find.text('Sin acceso'), findsOneWidget);
    });

    testWidgets('con solo "ver": sin botón de crear ni acciones de editar/eliminar', (tester) async {
      await showScreen(
        tester,
        'descuentos_solo_ver',
        const AdminDescuentosScreen(),
        height: 1500,
        me: staffMe(['descuentos'], actions: const ['ver']),
        overrides: _listOverrides(),
      );
      expect(find.text('Crear cupón'), findsNothing);
      await _openMenu(tester, 0);
      expect(find.text('Copiar código'), findsOneWidget);
      expect(find.text('Editar'), findsNothing);
      expect(find.text('Pausar'), findsNothing);
      expect(find.text('Eliminar'), findsNothing);
    });

    testWidgets('el menú pausa o activa con PATCH /estado', (tester) async {
      final api = FakeApi();
      await showScreen(
        tester,
        'descuentos_menu',
        const AdminDescuentosScreen(),
        height: 1500,
        me: _full,
        overrides: [..._listOverrides(), apiClientProvider.overrideWithValue(api)],
      );
      await _openMenu(tester, 0);
      expect(find.text('Pausar'), findsOneWidget);
      await tester.tap(find.text('Pausar'));
      await settle(tester, 3);
      expect(api.calls.last.method, 'PATCH');
      expect(api.calls.last.path, '/admin/descuentos/k1/estado');
      expect(api.calls.last.body, {'isActive': false});
      expect(find.text('Cupón pausado'), findsOneWidget);

      await _openMenu(tester, 1);
      expect(find.text('Activar'), findsOneWidget);
      await tester.tap(find.text('Activar'));
      await settle(tester, 3);
      expect(api.calls.last.path, '/admin/descuentos/k2/estado');
      expect(api.calls.last.body, {'isActive': true});
    });

    testWidgets('un cupón vencido no ofrece pausar/activar', (tester) async {
      await showScreen(tester, 'descuentos_menu_vencido', const AdminDescuentosScreen(), height: 1500, me: _full, overrides: _listOverrides());
      await _openMenu(tester, 2);
      expect(find.text('Editar'), findsOneWidget);
      expect(find.text('Pausar'), findsNothing);
      expect(find.text('Activar'), findsNothing);
    });

    testWidgets('eliminar pide confirmación y manda DELETE', (tester) async {
      final api = FakeApi();
      await showScreen(
        tester,
        'descuentos_eliminar',
        const AdminDescuentosScreen(),
        height: 1500,
        me: _full,
        overrides: [..._listOverrides(), apiClientProvider.overrideWithValue(api)],
      );
      await _openMenu(tester, 0);
      await tester.tap(find.text('Eliminar'));
      await settle(tester, 3);
      expect(find.text('¿Eliminar el cupón HEFESTO15?'), findsOneWidget);
      expect(api.calls, isEmpty, reason: 'todavía no se borró nada');

      // Cancelar no borra.
      await tester.tap(find.text('Cancelar'));
      await settle(tester, 3);
      expect(api.calls, isEmpty);

      await _openMenu(tester, 0);
      await tester.tap(find.text('Eliminar'));
      await settle(tester, 3);
      await tester.tap(find.widgetWithText(FilledButton, 'Eliminar'));
      await settle(tester, 3);
      expect(api.calls.single.method, 'DELETE');
      expect(api.calls.single.path, '/admin/descuentos/k1');
      expect(find.text('Cupón eliminado'), findsOneWidget);
    });

    testWidgets('un error del servidor al pausar se avisa con su mensaje', (tester) async {
      final api = FakeApi(onSend: (m, p, b) => throw ApiException('forbidden', 'No tenés permiso para hacer esto.', status: 403));
      await showScreen(
        tester,
        'descuentos_error_menu',
        const AdminDescuentosScreen(),
        height: 1500,
        me: _full,
        overrides: [..._listOverrides(), apiClientProvider.overrideWithValue(api)],
      );
      await _openMenu(tester, 0);
      await tester.tap(find.text('Pausar'));
      await settle(tester, 3);
      expect(find.text('No tenés permiso para hacer esto.'), findsOneWidget);
    });
  });

  group('Formulario de cupón', () {
    testWidgets('alta: Guardar apagado, valida y muestra la vista previa en vivo', (tester) async {
      final api = FakeApi();
      await showScreen(tester, 'cupon_alta', const CouponFormScreen(), height: 1900, me: _full, overrides: _formOverrides(api));
      final save = find.widgetWithText(GoldButton, 'Crear cupón');
      expect(tester.widget<GoldButton>(save).onPressed, isNull);
      expect(find.text('TU-CÓDIGO'), findsOneWidget);

      await tester.enterText(find.widgetWithText(TextField, 'Descripción (opcional)'), 'Algo');
      await tester.pump();
      await tester.tap(save);
      await tester.pump();
      expectFieldAndBarError('Ingresá un código.');
      expect(find.text('Ingresá un valor mayor a 0.'), findsOneWidget);
      expect(api.calls, isEmpty);

      await tester.enterText(find.widgetWithText(TextField, 'Código del cupón'), 'hefesto15');
      await tester.enterText(find.widgetWithText(TextField, 'Valor (%)'), '15');
      await tester.pump();
      expect(
        find.descendant(of: find.byType(CouponPreview), matching: find.text('HEFESTO15')),
        findsOneWidget,
        reason: 'la vista previa muestra el código en mayúsculas',
      );
      expect(find.text('15%'), findsOneWidget);
    });

    testWidgets('un porcentaje no puede pasar de 100', (tester) async {
      final api = FakeApi();
      await showScreen(tester, 'cupon_porcentaje', const CouponFormScreen(), height: 1900, me: _full, overrides: _formOverrides(api));
      await tester.enterText(find.widgetWithText(TextField, 'Código del cupón'), 'MUCHO');
      await tester.enterText(find.widgetWithText(TextField, 'Valor (%)'), '150');
      await tester.pump();
      await tester.tap(find.widgetWithText(GoldButton, 'Crear cupón'));
      await tester.pump();
      expectFieldAndBarError('El porcentaje no puede superar 100.');
      expect(api.calls, isEmpty);
    });

    testWidgets('alta de un cupón de porcentaje: POST con el cuerpo esperado', (tester) async {
      final api = FakeApi(onSend: (m, p, b) => {'id': 'nuevo'});
      await showScreen(tester, 'cupon_alta_ok', const CouponFormScreen(), height: 1900, me: _full, overrides: _formOverrides(api));
      await tester.enterText(find.widgetWithText(TextField, 'Código del cupón'), 'hefesto15');
      await tester.enterText(find.widgetWithText(TextField, 'Descripción (opcional)'), '15% en toda la tienda');
      await tester.enterText(find.widgetWithText(TextField, 'Valor (%)'), '15');
      await tester.enterText(find.widgetWithText(TextField, 'Usos máximos'), '100');
      await tester.pump();
      await tester.tap(find.widgetWithText(GoldButton, 'Crear cupón'));
      await settle(tester, 3);
      final call = api.calls.single;
      expect(call.method, 'POST');
      expect(call.path, '/admin/descuentos');
      final body = call.body as Map<String, dynamic>;
      expect(body['code'], 'HEFESTO15');
      expect(body['type'], 'percentage');
      expect(body['value'], 15);
      expect(body['maxUses'], 100);
      expect(body['minPurchase'], 0);
      expect(body['scope'], 'all');
      expect(body['expiresAt'], '');
      expect(body['isActive'], isTrue);
    });

    testWidgets('monto fijo con miles a la argentina y un producto elegido', (tester) async {
      final api = FakeApi(onSend: (m, p, b) => {'id': 'nuevo'});
      await showScreen(tester, 'cupon_producto', const CouponFormScreen(), height: 1900, me: _full, overrides: _formOverrides(api));
      await tester.enterText(find.widgetWithText(TextField, 'Código del cupón'), 'MATE10');
      await tester.tap(find.text('Monto fijo (\$)'));
      await tester.pump();
      await tester.enterText(find.widgetWithText(TextField, 'Valor (\$)'), '2.000');
      await tester.tap(find.text('Un producto'));
      await tester.pump();

      // Sin elegir el producto no deja guardar.
      await tester.tap(find.widgetWithText(GoldButton, 'Crear cupón'));
      await tester.pump();
      expectFieldAndBarError('Elegí el producto.');
      expect(api.calls, isEmpty);

      await tester.tap(find.text('Elegí un producto'));
      await settle(tester, 5);
      expect(find.text('Elegí el producto'), findsOneWidget, reason: 'título de la hoja');
      await tester.enterText(find.widgetWithText(TextField, 'Buscar producto…'), 'mate');
      await tester.pump();
      expect(find.text('Cartel Personalizado'), findsNothing);
      await tester.tap(find.text('Mate Mario'));
      await settle(tester, 5);

      await tester.tap(find.widgetWithText(GoldButton, 'Crear cupón'));
      await settle(tester, 3);
      final body = api.calls.single.body as Map<String, dynamic>;
      expect(body['type'], 'fixed');
      expect(body['value'], 2000);
      expect(body['scope'], 'product');
      expect(body['targetId'], 'p1');
      expect(body['targetLabel'], 'Mate Mario');
    });

    testWidgets('el vencimiento se elige con el calendario en castellano', (tester) async {
      final api = FakeApi(onSend: (m, p, b) => {'id': 'nuevo'});
      await showScreen(tester, 'cupon_vencimiento', const CouponFormScreen(), height: 1900, me: _full, overrides: _formOverrides(api));
      await tester.enterText(find.widgetWithText(TextField, 'Código del cupón'), 'FIN');
      await tester.enterText(find.widgetWithText(TextField, 'Valor (%)'), '10');
      await tester.tap(find.text('Sin vencimiento'));
      await settle(tester, 4);
      expect(find.text('Aceptar'), findsOneWidget);
      expect(find.text('Cancelar'), findsOneWidget);
      await tester.tap(find.descendant(of: find.byType(Dialog), matching: find.text('15')));
      await tester.pump();
      await tester.tap(find.text('Aceptar'));
      await settle(tester, 4);
      expect(find.text('Sin vencimiento'), findsNothing);

      await tester.tap(find.widgetWithText(GoldButton, 'Crear cupón'));
      await settle(tester, 3);
      expect((api.calls.single.body as Map)['expiresAt'], matches(RegExp(r'^\d{4}-\d{2}-15$')));
    });

    testWidgets('edición: parte con los datos, conserva lo que no se toca y manda PUT', (tester) async {
      final api = FakeApi();
      final coupon = _page.items[0];
      await showScreen(tester, 'cupon_edicion', CouponFormScreen(coupon: coupon), height: 1900, me: _full, overrides: _formOverrides(api));
      expect(find.text('Editar cupón'), findsOneWidget);
      final save = find.widgetWithText(GoldButton, 'Guardar cambios');
      expect(tester.widget<GoldButton>(save).onPressed, isNull, reason: 'sin cambios no se guarda');
      expect(find.text('31 dic 2026'), findsWidgets);

      await tester.enterText(find.widgetWithText(TextField, 'Valor (%)'), '20');
      await tester.pump();
      expect(tester.widget<GoldButton>(save).onPressed, isNotNull);
      await tester.tap(save);
      await settle(tester, 3);
      final call = api.calls.single;
      expect(call.method, 'PUT');
      expect(call.path, '/admin/descuentos/k1');
      final body = call.body as Map<String, dynamic>;
      expect(body['value'], 20);
      expect(body['code'], 'HEFESTO15');
      expect(body['maxUses'], 100);
      expect(body['expiresAt'], '2026-12-31', reason: 'el vencimiento no se corre de día');
    });

    testWidgets('edición de un cupón de categoría muestra el objetivo', (tester) async {
      await showScreen(
        tester,
        'cupon_edicion_categoria',
        CouponFormScreen(coupon: _page.items[1]),
        height: 1900,
        me: _full,
        overrides: _formOverrides(FakeApi()),
      );
      expect(find.text('Mates personalizados'), findsWidgets);
      expect(find.text('Categoría'), findsWidgets);
      expect(find.text('Cupón activo'), findsOneWidget);
    });

    testWidgets('un error del servidor se muestra en el formulario', (tester) async {
      final api = FakeApi(onSend: (m, p, b) => throw ApiException('invalid', 'El producto o categoría elegido no existe.', status: 422));
      await showScreen(tester, 'cupon_error', const CouponFormScreen(), height: 1900, me: _full, overrides: _formOverrides(api));
      await tester.enterText(find.widgetWithText(TextField, 'Código del cupón'), 'X1');
      await tester.enterText(find.widgetWithText(TextField, 'Valor (%)'), '10');
      await tester.pump();
      await tester.tap(find.widgetWithText(GoldButton, 'Crear cupón'));
      await settle(tester, 3);
      expect(find.text('El producto o categoría elegido no existe.'), findsOneWidget);
    });

    testWidgets('al volver con cambios sin guardar pregunta antes de descartar', (tester) async {
      await showScreen(tester, 'cupon_descartar', const CouponFormScreen(), height: 1900, me: _full, overrides: _formOverrides(FakeApi()));
      await tester.enterText(find.widgetWithText(TextField, 'Código del cupón'), 'ALGO');
      await tester.pump();
      await tester.binding.handlePopRoute();
      await settle(tester, 4);
      expect(find.text('¿Descartar los cambios?'), findsOneWidget);
    });

    testWidgets('360dp con letra grande y en claro / luz nocturna no se desborda', (tester) async {
      for (final t in HefestoThemeMode.values) {
        await showScreen(
          tester,
          'cupon_form_${t.name}_360',
          CouponFormScreen(coupon: _page.items[1]),
          width: 360,
          height: 2600,
          textScale: t == HefestoThemeMode.dark ? 1.5 : 1,
          theme: t,
          me: _full,
          overrides: _formOverrides(FakeApi()),
        );
        expect(find.text('Editar cupón'), findsOneWidget);
      }
    });
  });
}
