import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/theme/app_theme.dart' show HefestoThemeMode;
import 'package:hefesto/core/widgets/common.dart' show GoldButton;
import 'package:hefesto/features/admin/fallas/falla_form_screen.dart';
import 'package:hefesto/features/admin/fallas/fallas_api.dart';
import 'package:hefesto/features/admin/fallas/fallas_models.dart';
import 'package:hefesto/features/admin/fallas/fallas_screen.dart';

import 'admin_fallas_models_test.dart' show fallasJson;
import 'support/produccion_fallas_filamentos_kit.dart';

/// API de mentira: guarda lo que la pantalla le manda y no toca la red.
class FakeFallasApi extends FallasApi {
  FakeFallasApi() : super(ApiClient());

  FallaDraft? created;
  FallaDraft? updated;
  String? deletedId;
  Object? failWith;
  FallaResult result = const FallaResult(deducted: true, lowStock: false);

  @override
  Future<FallaResult> create(FallaDraft d) async {
    if (failWith != null) throw failWith!;
    created = d;
    return result;
  }

  @override
  Future<void> update(String id, FallaDraft d) async {
    if (failWith != null) throw failWith!;
    updated = d;
  }

  @override
  Future<double> delete(String id) async {
    if (failWith != null) throw failWith!;
    deletedId = id;
    return 150;
  }
}

Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  setUpAll(setUpKit);

  final data = FallasData.fromJson(fallasJson());
  final me = meWith({'fallas': allActions});

  group('listado', () {
    testWidgets('dibuja el resumen y las fallas', (tester) async {
      await showScreen(
        tester,
        'fallas',
        const AdminFallasScreen(),
        height: 1300,
        me: me,
        overrides: [fallasProvider.overrideWith((ref) async => data)],
      );
      expect(find.text('Impresiones fallidas'), findsOneWidget);
      expect(find.text('Lámpara lunar'), findsOneWidget);
      expect(find.text('Boquilla tapada'), findsWidgets);
      expect(find.text('Causa más común'), findsOneWidget);
      expect(find.text('Registrar'), findsOneWidget);
      // La falla vieja sin nombre se muestra igual.
      expect(find.text('Sin nombre'), findsOneWidget);
    });

    testWidgets('sin overflow a 360 dp con fuente grande', (tester) async {
      await showScreen(
        tester,
        'fallas_fuente_grande',
        const AdminFallasScreen(),
        width: 360,
        height: 1500,
        textScale: 1.4,
        me: me,
        overrides: [fallasProvider.overrideWith((ref) async => data)],
      );
      expect(find.text('Lámpara lunar'), findsOneWidget);
    });

    testWidgets('sin fallas muestra el estado vacío', (tester) async {
      await showScreen(
        tester,
        'fallas_vacio',
        const AdminFallasScreen(),
        me: me,
        overrides: [
          fallasProvider.overrideWith((ref) async => FallasData.fromJson({'items': <dynamic>[]})),
        ],
      );
      expect(find.text('Sin fallas registradas'), findsOneWidget);
    });

    testWidgets('sin permiso de crear no hay botón Registrar', (tester) async {
      await showScreen(
        tester,
        'fallas_solo_ver',
        const AdminFallasScreen(),
        me: meWith({'fallas': ['ver']}, role: 'operator'),
        overrides: [fallasProvider.overrideWith((ref) async => data)],
      );
      expect(find.text('Lámpara lunar'), findsOneWidget);
      expect(find.text('Registrar'), findsNothing);
    });

    testWidgets('sin permiso de ver muestra "Sin acceso"', (tester) async {
      await showScreen(
        tester,
        'fallas_sin_acceso',
        const AdminFallasScreen(),
        me: meWith({'fallas': <String>[]}, role: 'operator'),
        overrides: [fallasProvider.overrideWith((ref) async => data)],
      );
      expect(find.text('Sin acceso'), findsOneWidget);
    });

    testWidgets('un error del servidor se muestra con "Reintentar"', (tester) async {
      await showScreen(
        tester,
        'fallas_error',
        const AdminFallasScreen(),
        me: me,
        overrides: [fallasProvider.overrideWith((ref) => throw Exception('boom'))],
      );
      expect(find.text('Reintentar'), findsOneWidget);
    });

    testWidgets('filtrar por causa deja solo esas fallas', (tester) async {
      await showScreen(
        tester,
        'fallas_filtro',
        const AdminFallasScreen(),
        height: 1300,
        me: me,
        overrides: [fallasProvider.overrideWith((ref) async => data)],
      );
      // La fila de chips se desplaza: se la trae a la vista antes de tocar.
      await tester.ensureVisible(find.text('Corte de luz (1)'));
      await tester.pump();
      await tester.tap(find.text('Corte de luz (1)'));
      await settle(tester);
      expect(find.text('Lámpara lunar'), findsNothing);
      expect(find.text('Sin nombre'), findsOneWidget);
    });
  });

  group('detalle de una falla', () {
    testWidgets('eliminar pide confirmación y avisa cuánto se devolvió al stock', (tester) async {
      final api = FakeFallasApi();
      await showScreen(
        tester,
        'falla_detalle',
        const AdminFallasScreen(),
        height: 1300,
        me: me,
        overrides: [
          fallasProvider.overrideWith((ref) async => data),
          fallasApiProvider.overrideWithValue(api),
        ],
      );
      await tester.tap(find.text('Lámpara lunar'));
      await settle(tester);
      expect(find.text('Editar'), findsOneWidget);
      expect(find.text('Costo estimado'), findsOneWidget);

      await tester.tap(find.text('Eliminar'));
      await settle(tester);
      expect(find.textContaining('Se devuelven 150 g de PLA · Rojo al stock'), findsOneWidget);
      await tester.tap(find.widgetWithText(TextButton, 'Eliminar').last);
      await settle(tester);

      expect(api.deletedId, 'a1');
      expect(find.textContaining('150 g devueltos al stock'), findsOneWidget);
    });

    testWidgets('una falla que no descontó stock lo aclara al eliminar', (tester) async {
      final api = FakeFallasApi();
      await showScreen(
        tester,
        'falla_detalle_sin_descuento',
        const AdminFallasScreen(),
        height: 1300,
        me: me,
        overrides: [
          fallasProvider.overrideWith((ref) async => data),
          fallasApiProvider.overrideWithValue(api),
        ],
      );
      await tester.tap(find.text('Sin nombre'));
      await settle(tester);
      expect(find.text('No se descontó'), findsOneWidget);
      await tester.tap(find.text('Eliminar'));
      await settle(tester);
      expect(find.textContaining('no descontó stock'), findsOneWidget);
    });
  });

  group('alta de una falla', () {
    testWidgets('dibuja el formulario multicolor', (tester) async {
      await showScreen(
        tester,
        'falla_form_alta',
        FallaFormScreen(data: data),
        height: 1400,
        me: me,
      );
      expect(find.text('Registrar falla'), findsWidgets);
      expect(find.text('Elegí un carrete'), findsOneWidget);
      expect(find.text('Agregar color'), findsOneWidget);
      expect(find.text('Total perdido: 0 g'), findsOneWidget);
    });

    testWidgets('sin datos válidos muestra los errores y no llama al servidor', (tester) async {
      final api = FakeFallasApi();
      await showScreen(
        tester,
        'falla_form_errores',
        FallaFormScreen(data: data),
        height: 1400,
        me: me,
        overrides: [fallasApiProvider.overrideWithValue(api)],
      );
      await tester.tap(find.widgetWithText(GoldButton, 'Registrar falla'));
      await settle(tester);
      expect(find.text('Ingresá la pieza o producto.'), findsOneWidget);
      expect(find.text('Elegí al menos un carrete y los gramos perdidos.'), findsOneWidget);
      expect(api.created, isNull);
    });

    testWidgets('registra la falla con una línea por carrete', (tester) async {
      final api = FakeFallasApi();
      await showScreen(
        tester,
        'falla_form_completo',
        // Se abre desde el listado, como en la app.
        const AdminFallasScreen(),
        height: 1500,
        me: me,
        overrides: [
          fallasProvider.overrideWith((ref) async => data),
          fallasApiProvider.overrideWithValue(api),
        ],
      );
      await tester.tap(find.text('Registrar'));
      await settle(tester);

      await tester.enterText(find.widgetWithText(TextField, 'Pieza / producto'), 'Cartel');
      await tester.tap(find.text('Elegí un carrete'));
      await settle(tester);
      await tester.tap(find.text('PLA · Rojo · Grilon3'));
      await settle(tester);
      await tester.enterText(find.widgetWithText(TextField, 'Gramos perdidos'), '40');
      await tester.pump();
      expect(find.text('Total perdido: 40 g'), findsOneWidget);

      await tester.tap(find.widgetWithText(GoldButton, 'Registrar falla'));
      await settle(tester);

      final sent = api.created!;
      expect(sent.pieceName, 'Cartel');
      expect(sent.material, 'PLA');
      expect(sent.color, 'Rojo');
      expect(sent.gramsLost, 40);
      expect(sent.lines.single.filamentId, 'f1');
      expect(sent.toCreateJson()['deducted'], isTrue);
      // De vuelta en el listado, avisa que se descontó el stock.
      expect(find.text('Falla registrada · stock descontado.'), findsOneWidget);
    });

    testWidgets('un error del servidor se muestra en línea y no cierra el formulario', (tester) async {
      final api = FakeFallasApi()..failWith = ApiException('invalid', 'Los gramos deben ser mayores a 0.');
      await showScreen(
        tester,
        'falla_form_error_servidor',
        FallaFormScreen(data: data),
        height: 1500,
        me: me,
        overrides: [fallasApiProvider.overrideWithValue(api)],
      );
      await tester.enterText(find.widgetWithText(TextField, 'Pieza / producto'), 'Cartel');
      await tester.tap(find.text('Elegí un carrete'));
      await settle(tester);
      await tester.tap(find.text('PETG · Negro'));
      await settle(tester);
      await tester.enterText(find.widgetWithText(TextField, 'Gramos perdidos'), '10');
      await tester.tap(find.widgetWithText(GoldButton, 'Registrar falla'));
      await settle(tester);
      expect(find.text('Los gramos deben ser mayores a 0.'), findsOneWidget);
      expect(find.byType(FallaFormScreen), findsOneWidget);
    });

    testWidgets('avisa cuando el carrete no alcanza', (tester) async {
      await showScreen(
        tester,
        'falla_form_sin_stock',
        FallaFormScreen(data: data),
        height: 1500,
        me: me,
      );
      await tester.tap(find.text('Elegí un carrete'));
      await settle(tester);
      await tester.tap(find.text('PLA · Rojo · Grilon3'));
      await settle(tester);
      await tester.enterText(find.widgetWithText(TextField, 'Gramos perdidos'), '900');
      await tester.pump();
      expect(find.textContaining('Solo hay 840 g'), findsOneWidget);
    });
  });

  group('corrección de una falla', () {
    testWidgets('Guardar está deshabilitado hasta que algo cambia', (tester) async {
      final api = FakeFallasApi();
      await showScreen(
        tester,
        'falla_form_edicion',
        FallaFormScreen(data: data, falla: data.items.first),
        height: 1500,
        me: me,
        overrides: [fallasApiProvider.overrideWithValue(api)],
      );
      expect(find.text('Editar falla'), findsOneWidget);
      expect(find.textContaining('no cambia el stock'), findsOneWidget);

      expect(find.text('Guardar cambios'), findsOneWidget);
      await tester.tap(find.text('Guardar cambios'));
      await settle(tester);
      expect(api.updated, isNull, reason: 'sin cambios no guarda');

      await tester.enterText(find.widgetWithText(TextField, 'Gramos perdidos'), '175');
      await tester.pump();
      await tester.tap(find.text('Guardar cambios'));
      await settle(tester);
      expect(api.updated!.gramsLost, 175);
      expect(api.updated!.toUpdateJson().containsKey('colorLines'), isFalse);
    });
  });

  // Los tres temas de la app (oscuro, claro y luz nocturna), en un celular chico.
  group('temas', () {
    for (final mode in HefestoThemeMode.values) {
      testWidgets('listado y formulario en ${mode.name}', (tester) async {
        await showScreen(
          tester,
          'fallas_${mode.name}_360',
          const AdminFallasScreen(),
          width: 360,
          height: 1000,
          mode: mode,
          me: me,
          overrides: [fallasProvider.overrideWith((ref) async => data)],
        );
        expect(find.text('Lámpara lunar'), findsOneWidget);
        await showScreen(
          tester,
          'falla_form_${mode.name}_360',
          FallaFormScreen(data: data),
          width: 360,
          height: 900,
          mode: mode,
          me: me,
        );
        expect(find.text('Registrar falla'), findsWidgets);
      });
    }
  });
}
