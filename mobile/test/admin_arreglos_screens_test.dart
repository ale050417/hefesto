import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/theme/app_theme.dart' show HefestoThemeMode;
import 'package:hefesto/core/widgets/common.dart' show GoldButton, NetImage;
import 'package:hefesto/core/widgets/photo_gallery.dart';
import 'package:hefesto/core/widgets/photo_picker.dart';
import 'package:hefesto/features/admin/arreglos/arreglo_form_screen.dart';
import 'package:hefesto/features/admin/arreglos/arreglos_api.dart';
import 'package:hefesto/features/admin/arreglos/arreglos_models.dart';
import 'package:hefesto/features/admin/arreglos/arreglos_screen.dart';

import 'admin_arreglos_models_test.dart' show arreglosJson, fixJson;
import 'support/photo_kit.dart';
import 'support/produccion_fallas_filamentos_kit.dart';

/// API de mentira: guarda lo que la pantalla le manda y no toca la red.
class FakeArreglosApi extends ArreglosApi {
  FakeArreglosApi() : super(ApiClient());

  ArregloDraft? created;
  final uploads = <({String id, String filename})>[];

  /// Fotos (por nombre) cuya subida falla.
  final failUploads = <String>{};

  /// Si está, cada subida espera a que se complete (para ver el avance).
  Completer<void>? uploadGate;
  ({String id, FixStatus status, String note})? updated;
  String? deletedId;
  Object? failWith;

  @override
  Future<Arreglo> create(ArregloDraft d) async {
    if (failWith != null) throw failWith!;
    created = d;
    return Arreglo.fromJson(fixJson('nuevo', title: d.title, description: d.description, urgent: d.urgent, mine: true));
  }

  @override
  Future<String> addImage(String id, PickedPhoto photo) async {
    if (uploadGate != null) await uploadGate!.future;
    if (failUploads.contains(photo.filename)) {
      throw ApiException('invalid', 'La imagen no se pudo procesar.');
    }
    uploads.add((id: id, filename: photo.filename));
    return 'https://cdn.test/arreglos/$id/${photo.filename}';
  }

  @override
  Future<void> update(String id, FixStatus status, String note) async {
    if (failWith != null) throw failWith!;
    updated = (id: id, status: status, note: note);
  }

  @override
  Future<void> delete(String id) async {
    if (failWith != null) throw failWith!;
    deletedId = id;
  }
}

Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  setUpAll(() async {
    await setUpKit();
    mockImageCachePlugins();
  });

  final data = ArreglosData.fromJson(arreglosJson());
  final me = meWith({'arreglos': allActions});

  group('listado', () {
    testWidgets('dibuja lo que falta resolver, con fotos, urgente y respuesta', (tester) async {
      await showScreen(
        tester,
        'arreglos',
        const AdminArreglosScreen(),
        height: 1400,
        me: me,
        overrides: [arreglosProvider.overrideWith((ref) async => data)],
      );
      expect(find.text('Arreglos'), findsOneWidget);
      // Chips con su cuenta; "Por resolver" es el filtro inicial.
      expect(find.text('Por resolver (2)'), findsOneWidget);
      expect(find.text('Pendientes (1)'), findsOneWidget);
      expect(find.text('En curso (1)'), findsOneWidget);
      expect(find.text('Resueltos (1)'), findsOneWidget);
      expect(find.text('Todos (3)'), findsOneWidget);
      expect(tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Por resolver (2)')).selected, isTrue);

      expect(find.text('El buscador no encuentra por color'), findsOneWidget);
      expect(find.text('Agregar botón de imprimir etiqueta'), findsOneWidget);
      expect(find.text('La app se cerraba al abrir Reportes'), findsNothing, reason: 'lo resuelto no se ve de entrada');
      expect(find.text('Urgente'), findsOneWidget);
      expect(find.text('Pendiente'), findsOneWidget);
      expect(find.textContaining('Antonella · '), findsOneWidget);
      expect(find.text('Si buscás "rojo" no aparece ningún producto.'), findsOneWidget);
      expect(find.byType(NetImage), findsNWidgets(2));
      // La respuesta del dueño.
      expect(find.text('Lo estoy armando, sale esta semana.'), findsOneWidget);
      expect(find.text('Nuevo arreglo'), findsOneWidget);
      expect(find.text('Responder / cambiar estado'), findsNWidgets(2));
    });

    testWidgets('los filtros cambian lo que se ve; lo resuelto no marca "Urgente"', (tester) async {
      await showScreen(
        tester,
        'arreglos_filtros',
        const AdminArreglosScreen(),
        height: 1400,
        me: me,
        overrides: [arreglosProvider.overrideWith((ref) async => data)],
      );
      await tester.ensureVisible(find.text('Resueltos (1)'));
      await tester.pump();
      await tester.tap(find.text('Resueltos (1)'));
      await settle(tester);
      expect(find.text('La app se cerraba al abrir Reportes'), findsOneWidget);
      expect(find.text('El buscador no encuentra por color'), findsNothing);
      expect(find.text('Urgente'), findsNothing, reason: 'era urgente, pero ya está resuelto');
      expect(find.text('Resuelto'), findsOneWidget);

      await tester.ensureVisible(find.text('Todos (3)'));
      await tester.pump();
      await tester.tap(find.text('Todos (3)'));
      await settle(tester);
      expect(find.text('Responder / cambiar estado'), findsNWidgets(3));
    });

    testWidgets('sin overflow a 360 dp con fuente grande', (tester) async {
      await showScreen(
        tester,
        'arreglos_fuente_grande',
        const AdminArreglosScreen(),
        width: 360,
        height: 1800,
        textScale: 1.4,
        me: me,
        overrides: [arreglosProvider.overrideWith((ref) async => data)],
      );
      expect(find.text('El buscador no encuentra por color'), findsOneWidget);
    });

    testWidgets('sin arreglos y con todo resuelto muestra el aviso', (tester) async {
      await showScreen(
        tester,
        'arreglos_vacio',
        const AdminArreglosScreen(),
        me: me,
        overrides: [
          arreglosProvider.overrideWith((ref) async => ArreglosData.fromJson({'items': <dynamic>[]})),
        ],
      );
      expect(find.text('Todavía no hay arreglos'), findsOneWidget);

      await showScreen(
        tester,
        'arreglos_todo_resuelto',
        const AdminArreglosScreen(),
        me: me,
        overrides: [
          arreglosProvider.overrideWith((ref) async => ArreglosData.fromJson({
                'items': [fixJson('d', status: 'done')],
              })),
        ],
      );
      expect(find.text('¡Todo resuelto!'), findsOneWidget);
    });

    testWidgets('permisos: sin crear no hay alta; sin editar no se responde; se borra solo lo propio pendiente',
        (tester) async {
      await showScreen(
        tester,
        'arreglos_solo_ver',
        const AdminArreglosScreen(),
        height: 1400,
        me: meWith({'arreglos': ['ver']}, role: 'operator'),
        overrides: [arreglosProvider.overrideWith((ref) async => data)],
      );
      expect(find.text('El buscador no encuentra por color'), findsOneWidget);
      expect(find.text('Nuevo arreglo'), findsNothing);
      expect(find.text('Responder / cambiar estado'), findsNothing);
      // x1 lo cargó quien mira y sigue pendiente: lo puede borrar aunque no
      // tenga arreglos/eliminar. x2 es de otro: no.
      expect(find.text('Eliminar'), findsOneWidget);
    });

    testWidgets('sin permiso de ver muestra "Sin acceso"', (tester) async {
      await showScreen(
        tester,
        'arreglos_sin_acceso',
        const AdminArreglosScreen(),
        me: meWith({'arreglos': <String>[]}, role: 'operator'),
        overrides: [arreglosProvider.overrideWith((ref) async => data)],
      );
      expect(find.text('Sin acceso'), findsOneWidget);
      expect(find.text('Nuevo arreglo'), findsNothing);
    });

    testWidgets('un error del servidor se muestra con "Reintentar"', (tester) async {
      await showScreen(
        tester,
        'arreglos_error',
        const AdminArreglosScreen(),
        me: me,
        overrides: [arreglosProvider.overrideWith((ref) => throw Exception('boom'))],
      );
      expect(find.text('Reintentar'), findsOneWidget);
      expect(find.text('Nuevo arreglo'), findsNothing);
    });

    testWidgets('tocar una foto la abre a pantalla completa, con zoom', (tester) async {
      await showScreen(
        tester,
        'arreglos_foto',
        const AdminArreglosScreen(),
        height: 1400,
        me: me,
        overrides: [arreglosProvider.overrideWith((ref) async => data)],
      );
      await tester.tap(find.byType(NetImage).at(1));
      await settle(tester);
      expect(find.byType(PhotoViewerScreen), findsOneWidget);
      expect(find.text('Foto 2 de 2'), findsOneWidget);
      final viewer = tester.widget<InteractiveViewer>(find.byType(InteractiveViewer));
      expect(viewer.maxScale, greaterThan(1));
      expect(viewer.scaleEnabled, isTrue);
    });
  });

  group('responder / cambiar estado', () {
    testWidgets('guarda el estado elegido y la respuesta', (tester) async {
      final api = FakeArreglosApi();
      await showScreen(
        tester,
        'arreglo_responder',
        const AdminArreglosScreen(),
        height: 1400,
        me: me,
        overrides: [
          arreglosProvider.overrideWith((ref) async => data),
          arreglosApiProvider.overrideWithValue(api),
        ],
      );
      await tester.tap(find.text('Responder / cambiar estado').first);
      await settle(tester);
      expect(find.byType(ArregloReplySheet), findsOneWidget);
      // Arranca en el estado actual.
      expect(tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Pendiente')).selected, isTrue);

      await tester.tap(find.widgetWithText(ChoiceChip, 'Resuelto'));
      await tester.pump();
      await tester.enterText(find.widgetWithText(TextField, 'Respuesta (opcional)'), 'Listo, ya busca por color.');
      await tester.tap(find.widgetWithText(GoldButton, 'Guardar'));
      await settle(tester);

      expect(api.updated, (id: 'x1', status: FixStatus.done, note: 'Listo, ya busca por color.'));
      expect(find.byType(ArregloReplySheet), findsNothing);
      expect(find.text('Arreglo actualizado'), findsOneWidget);
    });

    testWidgets('un rechazo del servidor queda en la hoja', (tester) async {
      final api = FakeArreglosApi()..failWith = ApiException('not_found', 'El arreglo ya no existe.');
      await showScreen(
        tester,
        'arreglo_responder_error',
        const AdminArreglosScreen(),
        height: 1400,
        me: me,
        overrides: [
          arreglosProvider.overrideWith((ref) async => data),
          arreglosApiProvider.overrideWithValue(api),
        ],
      );
      await tester.tap(find.text('Responder / cambiar estado').first);
      await settle(tester);
      await tester.tap(find.widgetWithText(GoldButton, 'Guardar'));
      await settle(tester);
      expect(find.text('El arreglo ya no existe.'), findsOneWidget);
      expect(find.byType(ArregloReplySheet), findsOneWidget);
    });
  });

  group('eliminar', () {
    testWidgets('pide confirmación y avisa', (tester) async {
      final api = FakeArreglosApi();
      await showScreen(
        tester,
        'arreglo_eliminar',
        const AdminArreglosScreen(),
        height: 1400,
        me: me,
        overrides: [
          arreglosProvider.overrideWith((ref) async => data),
          arreglosApiProvider.overrideWithValue(api),
        ],
      );
      await tester.tap(find.text('Eliminar').first);
      await settle(tester);
      expect(find.text('¿Eliminar "El buscador no encuentra por color"?'), findsOneWidget);
      expect(find.textContaining('y sus fotos'), findsOneWidget);
      // Cancelar no borra nada.
      await tester.tap(find.text('Cancelar'));
      await settle(tester);
      expect(api.deletedId, isNull);

      await tester.tap(find.text('Eliminar').first);
      await settle(tester);
      await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Eliminar')));
      await settle(tester);
      expect(api.deletedId, 'x1');
      expect(find.text('Arreglo eliminado'), findsOneWidget);
    });

    testWidgets('el rechazo del servidor se avisa', (tester) async {
      final api = FakeArreglosApi()..failWith = ApiException('unauthorized', 'No tenés permiso para eso.');
      await showScreen(
        tester,
        'arreglo_eliminar_error',
        const AdminArreglosScreen(),
        height: 1400,
        me: me,
        overrides: [
          arreglosProvider.overrideWith((ref) async => data),
          arreglosApiProvider.overrideWithValue(api),
        ],
      );
      await tester.tap(find.text('Eliminar').first);
      await settle(tester);
      await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Eliminar')));
      await settle(tester);
      expect(find.text('No tenés permiso para eso.'), findsOneWidget);
    });
  });

  group('nuevo arreglo', () {
    testWidgets('sin datos válidos muestra los errores y no llama al servidor', (tester) async {
      final api = FakeArreglosApi();
      await showScreen(
        tester,
        'arreglo_form_errores',
        const ArregloFormScreen(maxImages: 6),
        height: 1200,
        me: me,
        overrides: [arreglosApiProvider.overrideWithValue(api)],
      );
      expect(find.text('Nuevo arreglo'), findsOneWidget);
      expect(find.text('Es urgente'), findsOneWidget);
      expect(find.text('Sumar fotos'), findsOneWidget);
      expect(find.text('Sacar foto'), findsOneWidget);
      await tester.tap(find.widgetWithText(GoldButton, 'Cargar arreglo'));
      await settle(tester);
      expect(find.text('Poné un título corto (qué hay que arreglar).'), findsOneWidget);
      expect(find.text('Explicá qué pasa y qué habría que cambiar.'), findsOneWidget);
      expect(find.text('Revisá los datos marcados en rojo.'), findsOneWidget);
      expect(api.created, isNull);
    });

    testWidgets('crea el arreglo y después sube las fotos de a una, mostrando el avance', (tester) async {
      final api = FakeArreglosApi()..uploadGate = Completer<void>();
      final source = FakePhotoSource(gallery: [fakePhoto('uno.jpg'), fakePhoto('dos.jpg'), fakePhoto('tres.png')]);
      await showScreen(
        tester,
        'arreglo_form_completo',
        // Se abre desde el listado, como en la app.
        const AdminArreglosScreen(),
        height: 1400,
        me: me,
        overrides: [
          arreglosProvider.overrideWith((ref) async => data),
          arreglosApiProvider.overrideWithValue(api),
          photoSourceProvider.overrideWithValue(source),
        ],
      );
      await tester.tap(find.text('Nuevo arreglo'));
      await settle(tester);

      await tester.enterText(find.widgetWithText(TextField, 'Qué hay que arreglar'), 'Falla el login');
      await tester.enterText(
        find.widgetWithText(TextField, 'Qué pasa y qué habría que cambiar'),
        'No deja entrar con Google.',
      );
      await tester.tap(find.byType(Switch));
      await tester.pump();
      await tester.tap(find.text('Sumar fotos'));
      await settle(tester);
      expect(find.text('3 de 6 fotos.'), findsOneWidget);

      await tester.tap(find.widgetWithText(GoldButton, 'Cargar arreglo'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      // El arreglo ya se creó y la primera foto está subiendo.
      expect(api.created!.toJson(), {
        'title': 'Falla el login',
        'description': 'No deja entrar con Google.',
        'urgent': true,
      });
      expect(find.text('Subiendo foto 1 de 3…'), findsOneWidget);
      expect(api.uploads, isEmpty);

      api.uploadGate!.complete();
      await settle(tester);
      expect(api.uploads.map((u) => u.filename), ['uno.jpg', 'dos.jpg', 'tres.png'], reason: 'de a una y en orden');
      expect(api.uploads.every((u) => u.id == 'nuevo'), isTrue, reason: 'al arreglo recién creado');
      // De vuelta en el listado, con el aviso.
      expect(find.byType(ArregloFormScreen), findsNothing);
      expect(find.text('Arreglo cargado'), findsOneWidget);
    });

    testWidgets('si alguna foto falla, el arreglo queda y avisa cuántas no subieron', (tester) async {
      final api = FakeArreglosApi()..failUploads.add('dos.jpg');
      final source = FakePhotoSource(gallery: [fakePhoto('uno.jpg'), fakePhoto('dos.jpg'), fakePhoto('tres.jpg')]);
      await showScreen(
        tester,
        'arreglo_form_foto_falla',
        const AdminArreglosScreen(),
        height: 1400,
        me: me,
        overrides: [
          arreglosProvider.overrideWith((ref) async => data),
          arreglosApiProvider.overrideWithValue(api),
          photoSourceProvider.overrideWithValue(source),
        ],
      );
      await tester.tap(find.text('Nuevo arreglo'));
      await settle(tester);
      await tester.enterText(find.widgetWithText(TextField, 'Qué hay que arreglar'), 'Falla el login');
      await tester.enterText(
        find.widgetWithText(TextField, 'Qué pasa y qué habría que cambiar'),
        'No deja entrar con Google.',
      );
      await tester.tap(find.text('Sumar fotos'));
      await settle(tester);
      await tester.tap(find.widgetWithText(GoldButton, 'Cargar arreglo'));
      await settle(tester);

      expect(api.created, isNotNull);
      expect(api.uploads.map((u) => u.filename), ['uno.jpg', 'tres.jpg'], reason: 'sigue con las demás');
      expect(find.byType(ArregloFormScreen), findsNothing, reason: 'el arreglo ya existe: no se reintenta el alta');
      expect(find.text('Arreglo cargado. No pudimos subir 1 de las 3 fotos.'), findsOneWidget);
    });

    testWidgets('sin fotos solo crea; un error del servidor queda en el formulario', (tester) async {
      final api = FakeArreglosApi()..failWith = ApiException('invalid', 'Máximo 120 caracteres.');
      await showScreen(
        tester,
        'arreglo_form_error_servidor',
        const ArregloFormScreen(maxImages: 6),
        height: 1200,
        me: me,
        overrides: [arreglosApiProvider.overrideWithValue(api)],
      );
      await tester.enterText(find.widgetWithText(TextField, 'Qué hay que arreglar'), 'Falla el login');
      await tester.enterText(
        find.widgetWithText(TextField, 'Qué pasa y qué habría que cambiar'),
        'No deja entrar con Google.',
      );
      await tester.tap(find.widgetWithText(GoldButton, 'Cargar arreglo'));
      await settle(tester);
      expect(find.text('Máximo 120 caracteres.'), findsOneWidget);
      expect(find.byType(ArregloFormScreen), findsOneWidget);
      expect(api.uploads, isEmpty);

      api.failWith = null;
      await tester.tap(find.widgetWithText(GoldButton, 'Cargar arreglo'));
      await settle(tester);
      expect(api.created!.urgent, isFalse);
      expect(api.uploads, isEmpty);
    });

    testWidgets('el tope de fotos es el del servidor', (tester) async {
      final source = FakePhotoSource(gallery: [for (var i = 0; i < 4; i++) fakePhoto('f$i.jpg')]);
      await showScreen(
        tester,
        'arreglo_form_tope',
        const ArregloFormScreen(maxImages: 2),
        height: 1200,
        me: me,
        overrides: [photoSourceProvider.overrideWithValue(source)],
      );
      expect(find.text('Hasta 2 fotos (opcional).'), findsOneWidget);
      await tester.tap(find.text('Sumar fotos'));
      await settle(tester);
      expect(find.byTooltip('Quitar foto'), findsNWidgets(2));
      expect(find.text('Llegaste al tope de 2 fotos.'), findsOneWidget);
    });
  });

  // Los tres temas de la app (oscuro, claro y luz nocturna), en un celular chico.
  group('temas', () {
    for (final mode in HefestoThemeMode.values) {
      testWidgets('listado y formulario en ${mode.name}', (tester) async {
        await showScreen(
          tester,
          'arreglos_${mode.name}_360',
          const AdminArreglosScreen(),
          width: 360,
          height: 1400,
          mode: mode,
          me: me,
          overrides: [arreglosProvider.overrideWith((ref) async => data)],
        );
        expect(find.text('El buscador no encuentra por color'), findsOneWidget);
        await showScreen(
          tester,
          'arreglo_form_${mode.name}_360',
          const ArregloFormScreen(maxImages: 6),
          width: 360,
          height: 1000,
          mode: mode,
          me: me,
        );
        expect(find.text('Cargar arreglo'), findsOneWidget);
      });
    }
  });
}
