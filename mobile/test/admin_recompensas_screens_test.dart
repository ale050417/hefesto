import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/providers.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:hefesto/core/widgets/common.dart';
import 'package:hefesto/features/admin/recompensas/recompensa_form_screen.dart';
import 'package:hefesto/features/admin/recompensas/recompensas_models.dart';
import 'package:hefesto/features/admin/recompensas/recompensas_providers.dart';
import 'package:hefesto/features/admin/recompensas/recompensas_screen.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'admin_crecimiento_harness.dart';
import 'admin_crecimiento_samples.dart';

final _page = RewardsPage.fromJson(sampleRewardsJson());
final _full = staffMe(['recompensas', 'clientes']);

List<Override> _listOverrides([RewardsPage? page]) =>
    [adminRewardsProvider.overrideWith((ref) async => page ?? _page)];

Future<void> _openMenu(WidgetTester tester, int card) async {
  await tester.tap(find.byTooltip('Acciones de la recompensa').at(card));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 300));
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('es_AR');
    await setUpFonts();
  });

  group('Pantalla de recompensas', () {
    testWidgets('muestra estadísticas, reglas, catálogo y últimos canjes', (tester) async {
      await showScreen(tester, 'recompensas_lista', const AdminRecompensasScreen(), height: 2600, me: _full, overrides: _listOverrides());
      expect(find.text('Recompensas'), findsWidgets);
      expect(find.text('En circulación'), findsOneWidget);
      expect(find.text('18450'), findsOneWidget);
      expect(find.text('Canjes realizados'), findsOneWidget);
      expect(find.text('23'), findsOneWidget);
      expect(find.text('9800'), findsOneWidget);
      expect(find.textContaining('1 punto por cada \$100'), findsOneWidget);
      expect(find.textContaining('1 punto vale \$1'), findsOneWidget);
      expect(find.text('Envío gratis'), findsNWidgets(2), reason: 'título y tipo');
      expect(find.text(r'$2.000 de descuento'), findsNWidgets(2), reason: 'título y beneficio');
      expect(find.text('Llavero de regalo'), findsOneWidget);
      expect(find.text('15% de descuento'), findsOneWidget);
      expect(find.text('Pausada'), findsOneWidget);
      expect(find.text('Descuento'), findsNWidgets(2));
      expect(find.text('Producto gratis'), findsOneWidget);
      expect(find.text('Juan Pérez'), findsOneWidget);
      expect(find.text('Cliente sin nombre'), findsOneWidget);
      expect(find.text('Nueva recompensa'), findsOneWidget);
    });

    testWidgets('sin overflow a 360dp con letra grande y en los 3 temas', (tester) async {
      for (final t in HefestoThemeMode.values) {
        await showScreen(
          tester,
          'recompensas_lista_${t.name}_360',
          const AdminRecompensasScreen(),
          width: 360,
          height: 3400,
          textScale: t == HefestoThemeMode.dark ? 1.5 : 1,
          theme: t,
          me: _full,
          overrides: _listOverrides(),
        );
        expect(find.text('Llavero de regalo'), findsOneWidget);
      }
    });

    testWidgets('catálogo vacío, error con "Reintentar" y sin acceso', (tester) async {
      await showScreen(
        tester,
        'recompensas_vacio',
        const AdminRecompensasScreen(),
        height: 1600,
        me: _full,
        overrides: _listOverrides(RewardsPage.fromJson({'rewards': <dynamic>[]})),
      );
      expect(find.text('Todavía no creaste recompensas.'), findsOneWidget);
      expect(find.text('Todavía nadie canjeó puntos.'), findsOneWidget);

      await showScreen(
        tester,
        'recompensas_error',
        const AdminRecompensasScreen(),
        me: _full,
        overrides: [adminRewardsProvider.overrideWith((ref) async => throw ApiException('unavailable', 'No pudimos cargar las recompensas.'))],
      );
      expect(find.text('No pudimos cargar las recompensas.'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);

      await showScreen(
        tester,
        'recompensas_sin_acceso',
        const AdminRecompensasScreen(),
        me: staffMe(['recompensas'], actions: const []),
        overrides: _listOverrides(),
      );
      expect(find.text('Sin acceso'), findsOneWidget);
    });

    testWidgets('con solo "ver": sin botón de crear ni menú de acciones', (tester) async {
      await showScreen(
        tester,
        'recompensas_solo_ver',
        const AdminRecompensasScreen(),
        height: 2600,
        me: staffMe(['recompensas'], actions: const ['ver']),
        overrides: _listOverrides(),
      );
      expect(find.text('Nueva recompensa'), findsNothing);
      expect(find.byTooltip('Acciones de la recompensa'), findsNothing);
      expect(find.text('Llavero de regalo'), findsOneWidget);
    });

    testWidgets('el menú pausa o activa con PUT y la recompensa completa', (tester) async {
      final api = FakeApi();
      await showScreen(
        tester,
        'recompensas_menu',
        const AdminRecompensasScreen(),
        height: 2600,
        me: _full,
        overrides: [..._listOverrides(), apiClientProvider.overrideWithValue(api)],
      );
      await _openMenu(tester, 0);
      expect(find.text('Pausar'), findsOneWidget);
      await tester.tap(find.text('Pausar'));
      await settle(tester, 3);
      var call = api.calls.last;
      expect(call.method, 'PUT');
      expect(call.path, '/admin/recompensas/r1');
      expect((call.body as Map)['isActive'], isFalse);
      expect((call.body as Map)['type'], 'shipping');
      expect(find.text('Recompensa pausada'), findsOneWidget);

      await _openMenu(tester, 2);
      expect(find.text('Activar'), findsOneWidget);
      await tester.tap(find.text('Activar'));
      await settle(tester, 3);
      call = api.calls.last;
      expect(call.path, '/admin/recompensas/r3');
      final body = call.body as Map;
      expect(body['isActive'], isTrue);
      expect(body['discountValue'], 15);
      expect(body['discountIsPercent'], isTrue);
    });

    testWidgets('eliminar pide confirmación y manda DELETE', (tester) async {
      final api = FakeApi();
      await showScreen(
        tester,
        'recompensas_eliminar',
        const AdminRecompensasScreen(),
        height: 2600,
        me: _full,
        overrides: [..._listOverrides(), apiClientProvider.overrideWithValue(api)],
      );
      await _openMenu(tester, 3);
      await tester.tap(find.text('Eliminar'));
      await settle(tester, 3);
      expect(find.text('¿Eliminar "Llavero de regalo"?'), findsOneWidget);
      expect(api.calls, isEmpty);
      await tester.tap(find.widgetWithText(FilledButton, 'Eliminar'));
      await settle(tester, 3);
      expect(api.calls.single.method, 'DELETE');
      expect(api.calls.single.path, '/admin/recompensas/r4');
      expect(find.text('Recompensa eliminada'), findsOneWidget);
    });

    testWidgets('un error del servidor al eliminar se avisa con su mensaje', (tester) async {
      final api = FakeApi(onSend: (m, p, b) => throw ApiException('not_found', 'No encontramos la recompensa.', status: 404));
      await showScreen(
        tester,
        'recompensas_error_menu',
        const AdminRecompensasScreen(),
        height: 2600,
        me: _full,
        overrides: [..._listOverrides(), apiClientProvider.overrideWithValue(api)],
      );
      await _openMenu(tester, 0);
      await tester.tap(find.text('Eliminar'));
      await settle(tester, 3);
      await tester.tap(find.widgetWithText(FilledButton, 'Eliminar'));
      await settle(tester, 3);
      expect(find.text('No encontramos la recompensa.'), findsOneWidget);
    });

    testWidgets('tocar una recompensa abre su formulario de edición', (tester) async {
      await showScreen(tester, 'recompensas_abrir', const AdminRecompensasScreen(), height: 2600, me: _full, overrides: _listOverrides());
      await tester.tap(find.text('Llavero de regalo'));
      await settle(tester, 5);
      expect(find.text('Editar recompensa'), findsOneWidget);
    });
  });

  group('Formulario de recompensa', () {
    List<Override> overrides(FakeApi api) => [apiClientProvider.overrideWithValue(api)];

    testWidgets('alta: Guardar apagado, valida título, costo y valor', (tester) async {
      final api = FakeApi();
      await showScreen(tester, 'recompensa_alta', RewardFormScreen(products: _page.products), height: 1700, me: _full, overrides: overrides(api));
      final save = find.widgetWithText(GoldButton, 'Crear recompensa');
      expect(tester.widget<GoldButton>(save).onPressed, isNull);
      expect(find.text('Título de la recompensa'), findsOneWidget, reason: 'vista previa');

      await tester.enterText(find.widgetWithText(TextField, 'Descripción (opcional)'), 'Algo');
      await tester.pump();
      await tester.tap(save);
      await tester.pump();
      expect(find.text('Ingresá un título.'), findsOneWidget);
      expect(find.text('Ingresá el costo en puntos.'), findsOneWidget);
      expect(find.text('Ingresá el valor del descuento.'), findsOneWidget);
      expect(api.calls, isEmpty);
    });

    testWidgets('alta de un descuento fijo: POST con el cuerpo esperado', (tester) async {
      final api = FakeApi(onSend: (m, p, b) => {'id': 'nueva'});
      await showScreen(tester, 'recompensa_alta_ok', RewardFormScreen(products: _page.products), height: 1700, me: _full, overrides: overrides(api));
      await tester.enterText(find.widgetWithText(TextField, 'Título'), r'$2.000 de descuento');
      await tester.enterText(find.widgetWithText(TextField, 'Costo en puntos'), '500');
      await tester.enterText(find.widgetWithText(TextField, 'Monto'), '2.000');
      await tester.pump();
      expect(find.text('500'), findsWidgets);
      await tester.tap(find.widgetWithText(GoldButton, 'Crear recompensa'));
      await settle(tester, 3);
      final call = api.calls.single;
      expect(call.method, 'POST');
      expect(call.path, '/admin/recompensas');
      final body = call.body as Map<String, dynamic>;
      expect(body['type'], 'discount');
      expect(body['costPoints'], 500);
      expect(body['discountValue'], 2000);
      expect(body['discountIsPercent'], isFalse);
      expect(body['productId'], isNull);
      expect(body['isActive'], isTrue);
    });

    testWidgets('un porcentaje no puede pasar de 100', (tester) async {
      final api = FakeApi();
      await showScreen(tester, 'recompensa_porcentaje', RewardFormScreen(products: _page.products), height: 1700, me: _full, overrides: overrides(api));
      await tester.tap(find.text('Porcentaje (%)'));
      await tester.pump();
      await tester.enterText(find.widgetWithText(TextField, 'Título'), 'Mucho');
      await tester.enterText(find.widgetWithText(TextField, 'Costo en puntos'), '100');
      await tester.enterText(find.widgetWithText(TextField, 'Porcentaje'), '120');
      await tester.pump();
      await tester.tap(find.widgetWithText(GoldButton, 'Crear recompensa'));
      await tester.pump();
      expect(find.text('El porcentaje no puede superar 100.'), findsOneWidget);
      expect(api.calls, isEmpty);
    });

    testWidgets('regalo de producto: exige elegirlo y lo manda', (tester) async {
      final api = FakeApi(onSend: (m, p, b) => {'id': 'nueva'});
      await showScreen(tester, 'recompensa_producto', RewardFormScreen(products: _page.products), height: 1700, me: _full, overrides: overrides(api));
      await tester.tap(find.text('Producto gratis'));
      await tester.pump();
      await tester.enterText(find.widgetWithText(TextField, 'Título'), 'Mate de regalo');
      await tester.enterText(find.widgetWithText(TextField, 'Costo en puntos'), '3000');
      await tester.pump();
      await tester.tap(find.widgetWithText(GoldButton, 'Crear recompensa'));
      await tester.pump();
      expect(find.text('Elegí el producto de regalo.'), findsOneWidget);
      expect(api.calls, isEmpty);

      await tester.tap(find.text('Elegí un producto'));
      await settle(tester, 5);
      await tester.tap(find.text('Mate Mario'));
      await settle(tester, 5);
      await tester.tap(find.widgetWithText(GoldButton, 'Crear recompensa'));
      await settle(tester, 3);
      final body = api.calls.single.body as Map<String, dynamic>;
      expect(body['type'], 'product');
      expect(body['productId'], 'p1');
      expect(body['discountValue'], isNull);
    });

    testWidgets('envío gratis no pide más datos', (tester) async {
      final api = FakeApi(onSend: (m, p, b) => {'id': 'nueva'});
      await showScreen(tester, 'recompensa_envio', RewardFormScreen(products: _page.products), height: 1700, me: _full, overrides: overrides(api));
      await tester.tap(find.text('Envío gratis'));
      await tester.pump();
      await tester.enterText(find.widgetWithText(TextField, 'Título'), 'Envío gratis');
      await tester.enterText(find.widgetWithText(TextField, 'Costo en puntos'), '300');
      await tester.pump();
      await tester.tap(find.widgetWithText(GoldButton, 'Crear recompensa'));
      await settle(tester, 3);
      expect((api.calls.single.body as Map)['type'], 'shipping');
    });

    testWidgets('edición: pausar con el interruptor manda PUT con isActive en false', (tester) async {
      final api = FakeApi();
      await showScreen(tester, 'recompensa_edicion', RewardFormScreen(reward: _page.rewards[1], products: _page.products), height: 1700, me: _full, overrides: overrides(api));
      expect(find.text('Editar recompensa'), findsOneWidget);
      final save = find.widgetWithText(GoldButton, 'Guardar cambios');
      expect(tester.widget<GoldButton>(save).onPressed, isNull, reason: 'sin cambios no se guarda');
      await tester.tap(find.text('Recompensa activa'));
      await tester.pump();
      expect(find.textContaining('Pausada: los clientes no la ven'), findsOneWidget);
      expect(tester.widget<GoldButton>(save).onPressed, isNotNull);
      await tester.tap(save);
      await settle(tester, 3);
      final call = api.calls.single;
      expect(call.method, 'PUT');
      expect(call.path, '/admin/recompensas/r2');
      final body = call.body as Map<String, dynamic>;
      expect(body['isActive'], isFalse);
      expect(body['discountValue'], 2000);
      expect(body['title'], r'$2.000 de descuento');
    });

    testWidgets('un error del servidor se muestra en el formulario', (tester) async {
      final api = FakeApi(onSend: (m, p, b) => throw ApiException('invalid', 'El costo en puntos debe ser mayor a 0.', status: 422));
      await showScreen(tester, 'recompensa_error', RewardFormScreen(products: _page.products), height: 1700, me: _full, overrides: overrides(api));
      await tester.tap(find.text('Envío gratis'));
      await tester.pump();
      await tester.enterText(find.widgetWithText(TextField, 'Título'), 'Envío gratis');
      await tester.enterText(find.widgetWithText(TextField, 'Costo en puntos'), '300');
      await tester.pump();
      await tester.tap(find.widgetWithText(GoldButton, 'Crear recompensa'));
      await settle(tester, 3);
      expect(find.text('El costo en puntos debe ser mayor a 0.'), findsOneWidget);
    });

    testWidgets('360dp con letra grande y en claro / luz nocturna no se desborda', (tester) async {
      for (final t in HefestoThemeMode.values) {
        await showScreen(
          tester,
          'recompensa_form_${t.name}_360',
          RewardFormScreen(reward: _page.rewards[2], products: _page.products),
          width: 360,
          height: 2400,
          textScale: t == HefestoThemeMode.dark ? 1.5 : 1,
          theme: t,
          me: _full,
          overrides: overrides(FakeApi()),
        );
        expect(find.text('Editar recompensa'), findsOneWidget);
      }
    });
  });
}
