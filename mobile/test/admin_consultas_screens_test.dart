import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/theme/app_theme.dart' show HefestoThemeMode;
import 'package:hefesto/core/widgets/common.dart' show GoldButton, NetImage;
import 'package:hefesto/core/widgets/file_attach.dart';
import 'package:hefesto/core/widgets/photo_picker.dart';
import 'package:hefesto/features/admin/consultas/consulta_answer_screen.dart';
import 'package:hefesto/features/admin/consultas/consulta_form_screen.dart';
import 'package:hefesto/features/admin/consultas/consultas_api.dart';
import 'package:hefesto/features/admin/consultas/consultas_models.dart';
import 'package:hefesto/features/admin/consultas/consultas_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:hefesto/features/admin/admin_models.dart';
import 'package:hefesto/features/admin/admin_providers.dart';
import 'package:hefesto/features/admin/calculadora/calculadora_models.dart';
import 'package:hefesto/features/admin/calculadora/price_estimator_sheet.dart';
import 'package:hefesto/features/admin/produccion/produccion_api.dart';
import 'package:hefesto/features/admin/produccion/produccion_models.dart';

import 'admin_consultas_models_test.dart' show answeredJson, consultasJson, inquiryJson, sampleMessage;
import 'support/calc_kit.dart';
import 'support/photo_kit.dart';
import 'support/produccion_fallas_filamentos_kit.dart';

/// API de mentira: guarda lo que la pantalla le manda y no toca la red.
class FakeConsultasApi extends ConsultasApi {
  FakeConsultasApi() : super(ApiClient());

  ConsultaDraft? created;
  final uploads = <({String id, String filename})>[];
  final failUploads = <String>{};
  ({String id, RespuestaDraft draft})? answered;
  final moves = <({String id, InquiryMove to})>[];

  /// Medio de pago con el que se confirmó la última vez.
  String? paidWith;
  final fileUploads = <({String id, String filename, String contentType})>[];
  final failFiles = <String>{};
  String? deletedId;
  Object? failWith;

  /// Mensaje que "arma el servidor" cuando la app no manda uno.
  String builtMessage = sampleMessage;

  @override
  Future<Consulta> create(ConsultaDraft d) async {
    if (failWith != null) throw failWith!;
    created = d;
    return Consulta.fromJson(inquiryJson('nueva', customerName: d.customerName, title: d.title, mine: true));
  }

  @override
  Future<String> addImage(String id, PickedPhoto photo) async {
    if (failUploads.contains(photo.filename)) {
      throw ApiException('invalid', 'La imagen no se pudo procesar.');
    }
    uploads.add((id: id, filename: photo.filename));
    return 'https://cdn.test/consultas/$id/${photo.filename}';
  }

  /// Productos de la tienda que "devuelve el servidor" al buscar.
  List<Map<String, dynamic>> storeProducts = const [];
  final productSearches = <String>[];

  @override
  Future<ConsultaProductPage> products({String q = '', int limit = 30}) async {
    productSearches.add(q);
    return ConsultaProductPage.fromJson({'total': storeProducts.length, 'items': storeProducts});
  }

  @override
  Future<Consulta> answer(String id, RespuestaDraft d) async {
    if (failWith != null) throw failWith!;
    answered = (id: id, draft: d);
    return Consulta.fromJson(answeredJson(id, message: d.message ?? builtMessage));
  }

  @override
  Future<ConsultaFile> addFile(String id, PickedAttachment file) async {
    if (failFiles.contains(file.filename)) throw ApiException('invalid', 'El archivo supera los 4 MB.');
    fileUploads.add((id: id, filename: file.filename, contentType: file.contentType));
    return ConsultaFile(url: 'https://cdn.test/consultas/$id/files/${file.filename}', name: file.filename, type: file.contentType);
  }

  @override
  Future<Consulta> move(String id, InquiryMove to, {String? paymentMethod}) async {
    if (failWith != null) throw failWith!;
    moves.add((id: id, to: to));
    if (to == InquiryMove.confirm) paidWith = paymentMethod;
    return Consulta.fromJson(answeredJson(
      id,
      status: to == InquiryMove.reopen ? 'answered' : to.api,
      saleId: to == InquiryMove.confirm ? 'sale-nueva' : null,
    ));
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

Future<void> tapShown(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pump();
  await tester.tap(finder);
  await settle(tester);
}

void main() {
  final launched = <String>[];
  final copied = <String>[];

  setUpAll(() async {
    await setUpKit();
    mockImageCachePlugins();
    final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    // WhatsApp abre otra app: acá solo se anota la dirección.
    messenger.setMockMethodCallHandler(const MethodChannel('plugins.flutter.io/url_launcher'), (call) async {
      if (call.method == 'launch') launched.add('${(call.arguments as Map)['url']}');
      return true;
    });
    // Portapapeles (en los tests no hay plataforma).
    messenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') copied.add('${(call.arguments as Map)['text']}');
      return null;
    });
  });

  setUp(() {
    launched.clear();
    copied.clear();
  });

  final data = ConsultasData.fromJson(consultasJson());
  final me = meWith({'consultas': allActions});
  // Atención al cliente: carga y cierra consultas, no las responde.
  final atencion = meWith({'consultas': ['ver', 'crear']}, role: 'atencion al cliente');
  // Operador: responde, no carga ni cierra.
  final operador = meWith({'consultas': ['ver', 'editar']}, role: 'operator');

  Future<FakeConsultasApi> openList(
    WidgetTester tester,
    String name, {
    ConsultasData? d,
    dynamic who,
    double height = 2200,
    FakeConsultasApi? api,
    PhotoSource? photos,
    AttachmentSource? files,
    List<Override> extra = const [],
  }) async {
    final fake = api ?? FakeConsultasApi();
    await showScreen(
      tester,
      name,
      const AdminConsultasScreen(),
      height: height,
      me: who ?? me,
      overrides: [
        consultasProvider.overrideWith((ref) async => d ?? data),
        consultasApiProvider.overrideWithValue(fake),
        if (photos != null) photoSourceProvider.overrideWithValue(photos),
        if (files != null) attachmentSourceProvider.overrideWithValue(files),
        ...extra,
      ],
    );
    return fake;
  }

  group('listado', () {
    testWidgets('dibuja las consultas abiertas con cliente, fotos y respuesta', (tester) async {
      await openList(tester, 'consultas');
      expect(find.text('Consultas'), findsOneWidget);
      // Chips con su cuenta; "Abiertas" es el filtro inicial.
      for (final chip in [
        'Abiertas (2)',
        'Sin responder (1)',
        'Respondidas (1)',
        'Confirmadas (1)',
        'No se hicieron (1)',
        'Todas (4)',
      ]) {
        expect(find.widgetWithText(ChoiceChip, chip), findsOneWidget);
      }
      expect(tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Abiertas (2)')).selected, isTrue);

      expect(find.text('12 × Llavero con logo'), findsNWidgets(2));
      expect(find.text('Carla Gómez'), findsNWidgets(2));
      expect(find.text('+54 9 11 2345-6789'), findsNWidgets(2));
      expect(find.textContaining('Cargó Antonella · '), findsNWidgets(2));
      expect(find.text('Sin responder'), findsOneWidget);
      expect(find.text('Respondida'), findsOneWidget);
      expect(find.text('Con el escudo del club, de 5 cm.'), findsNWidgets(2));
      expect(find.byType(NetImage), findsOneWidget);
      // Los adjuntos que no son fotos, debajo de las fotos.
      expect(find.text('audio del cliente.ogg'), findsOneWidget);
      expect(find.text('diseño.pdf'), findsOneWidget);
      expect(find.byIcon(Icons.audiotrack_rounded), findsOneWidget);
      expect(find.byIcon(Icons.picture_as_pdf_rounded), findsOneWidget);

      // La respuesta: resumen de precio, quién respondió y el mensaje.
      expect(find.text(r'Precio: $2.500 c/u'), findsOneWidget);
      expect(find.text(r'Total (12 unidades): $30.000'), findsOneWidget);
      expect(find.text(r'Desde 50 unidades: $2.000 c/u'), findsOneWidget);
      expect(find.textContaining('Respondió Lucas'), findsOneWidget);
      expect(find.textContaining('Te paso la cotización'), findsOneWidget);
      expect(find.text('Copiar mensaje'), findsOneWidget);
      expect(find.text('WhatsApp'), findsOneWidget);
      expect(find.text('Nueva consulta'), findsOneWidget);
      // El costo es interno: no aparece en ningún lado de la tarjeta.
      expect(find.textContaining('900'), findsNothing);
      expect(find.textContaining('osto'), findsNothing);
    });

    testWidgets('tocar un adjunto lo abre fuera de la app', (tester) async {
      await openList(tester, 'consultas_adjunto_abrir');
      await tapShown(tester, find.text('diseño.pdf'));
      expect(launched.single, 'https://cdn.test/consultas/c1/files/b.pdf');
    });

    testWidgets('confirmada con pedido: lo dice en la tarjeta y no se puede reabrir', (tester) async {
      await openList(tester, 'consultas_confirmada_con_pedido');
      await tapShown(tester, find.text('Confirmadas (1)'));
      expect(find.text('Confirmada · el pedido ya está en Pedidos'), findsOneWidget);
      expect(find.text('Reabrir'), findsNothing, reason: 'ya generó un pedido');
      expect(find.text('Adjuntar'), findsNothing, reason: 'cerrada: no se adjunta más');

      // Una confirmada vieja, sin pedido, sí se puede reabrir.
      await openList(
        tester,
        'consultas_confirmada_sin_pedido',
        d: ConsultasData.fromJson({
          'items': [answeredJson('v', status: 'confirmed')],
        }),
      );
      await tapShown(tester, find.text('Confirmadas (1)'));
      expect(find.text('Confirmada'), findsOneWidget);
      expect(find.text('Reabrir'), findsOneWidget);
    });

    testWidgets('una sola unidad no lleva prefijo ni total', (tester) async {
      await openList(
        tester,
        'consultas_una_unidad',
        d: ConsultasData.fromJson({
          'items': [answeredJson('u', quantity: 1, message: 'Hola, sale 2500.')],
        }),
      );
      expect(find.text('Llavero con logo'), findsOneWidget);
      expect(find.text(r'Precio: $2.500'), findsOneWidget);
      expect(find.textContaining('Total ('), findsNothing);
    });

    testWidgets('los filtros cambian lo que se ve', (tester) async {
      await openList(tester, 'consultas_filtros');
      await tapShown(tester, find.text('No se hicieron (1)'));
      expect(find.text('Maceta geométrica'), findsOneWidget);
      expect(find.text('Pedro'), findsOneWidget);
      expect(find.text('12 × Llavero con logo'), findsNothing);
      expect(find.text('Reabrir'), findsOneWidget);

      await tapShown(tester, find.text('Confirmadas (1)'));
      expect(find.text('Confirmada · el pedido ya está en Pedidos'), findsOneWidget);
      await tapShown(tester, find.text('Todas (4)'));
      expect(find.text('12 × Llavero con logo'), findsNWidgets(3));
    });

    testWidgets('sin overflow a 360 dp con fuente grande', (tester) async {
      await showScreen(
        tester,
        'consultas_fuente_grande',
        const AdminConsultasScreen(),
        width: 360,
        height: 3200,
        textScale: 1.4,
        me: me,
        overrides: [consultasProvider.overrideWith((ref) async => data)],
      );
      expect(find.text('12 × Llavero con logo'), findsNWidgets(2));
    });

    testWidgets('estados: vacío, nada abierto, sin acceso y error', (tester) async {
      await openList(tester, 'consultas_vacio', d: ConsultasData.fromJson({'items': <dynamic>[]}), height: 880);
      expect(find.text('Todavía no hay consultas'), findsOneWidget);

      await openList(
        tester,
        'consultas_nada_abierto',
        d: ConsultasData.fromJson({
          'items': [answeredJson('k', status: 'confirmed')],
        }),
        height: 880,
      );
      expect(find.text('No hay consultas abiertas'), findsOneWidget);

      await openList(tester, 'consultas_sin_acceso', who: meWith({'consultas': <String>[]}, role: 'operator'), height: 880);
      expect(find.text('Sin acceso'), findsOneWidget);
      expect(find.text('Nueva consulta'), findsNothing);

      await showScreen(
        tester,
        'consultas_error',
        const AdminConsultasScreen(),
        me: me,
        overrides: [consultasProvider.overrideWith((ref) => throw Exception('boom'))],
      );
      expect(find.text('Reintentar'), findsOneWidget);
    });
  });

  group('acciones según el permiso', () {
    testWidgets('atención al cliente: carga, confirma, descarta y reabre; no responde', (tester) async {
      final api = await openList(tester, 'consultas_atencion', who: atencion);
      expect(find.text('Nueva consulta'), findsOneWidget);
      expect(find.text('Responder'), findsNothing);
      expect(find.text('Cambiar respuesta'), findsNothing);
      // "Confirmado" solo en la respondida; "No se hizo" en las dos abiertas.
      expect(find.text('Confirmado'), findsOneWidget);
      expect(find.text('No se hizo'), findsNWidgets(2));
      // La suya sin responder la puede borrar; la respondida de otro, no.
      expect(find.text('Eliminar'), findsOneWidget);

      // La suya (c1) la puede seguir completando; la de otro (c2), no.
      expect(find.text('Adjuntar'), findsOneWidget);

      await tapShown(tester, find.text('No se hizo').first);
      expect(api.moves.last, (id: 'c1', to: InquiryMove.cancel));

      await tapShown(tester, find.text('No se hicieron (1)'));
      expect(find.text('Confirmado'), findsNothing);
      expect(find.widgetWithText(OutlinedButton, 'No se hizo'), findsNothing, reason: 'queda solo el rótulo del estado');
      await tapShown(tester, find.text('Reabrir'));
      expect(api.moves.last, (id: 'c4', to: InquiryMove.reopen));
      expect(find.text('Consulta reabierta'), findsOneWidget);
    });

    testWidgets('operador: responde o cambia la respuesta; no carga ni cierra', (tester) async {
      await openList(tester, 'consultas_operador', who: operador);
      expect(find.text('Nueva consulta'), findsNothing);
      expect(find.text('Responder'), findsOneWidget);
      expect(find.text('Cambiar respuesta'), findsOneWidget);
      expect(find.text('Confirmado'), findsNothing);
      expect(find.text('No se hizo'), findsNothing);
      // Quien responde puede adjuntar en las dos abiertas (un audio, un PDF).
      expect(find.text('Adjuntar'), findsNWidgets(2));
      // Sin consultas/eliminar solo se borra lo propio sin responder (c1 viene
      // marcada como suya); la respondida de otro, no.
      expect(find.text('Eliminar'), findsOneWidget);

      // Cerradas: ya no se responden.
      await tapShown(tester, find.text('Todas (4)'));
      expect(find.text('Responder'), findsOneWidget);
      expect(find.text('Cambiar respuesta'), findsOneWidget);
      expect(find.text('Reabrir'), findsNothing);
    });

    testWidgets('el rechazo del servidor al cambiar el estado se avisa', (tester) async {
      final api = FakeConsultasApi()..failWith = ApiException('invalid', 'Esta consulta ya generó un pedido.');
      await openList(tester, 'consultas_estado_error', who: atencion, api: api);
      await tapShown(tester, find.text('No se hizo').first);
      expect(find.text('Esta consulta ya generó un pedido.'), findsOneWidget);
      expect(api.moves, isEmpty);
    });

    testWidgets('eliminar pide confirmación', (tester) async {
      final api = await openList(tester, 'consultas_eliminar');
      await tapShown(tester, find.text('Eliminar').first);
      expect(find.text('¿Eliminar la consulta de Carla Gómez?'), findsOneWidget);
      await tester.tap(find.text('Cancelar'));
      await settle(tester);
      expect(api.deletedId, isNull);

      await tapShown(tester, find.text('Eliminar').first);
      await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Eliminar')));
      await settle(tester);
      expect(api.deletedId, 'c1');
      expect(find.text('Consulta eliminada'), findsOneWidget);
    });
  });

  group('confirmar crea el pedido', () {
    testWidgets('"Confirmado" abre la hoja: qué pedido se crea, cómo paga y los dos botones', (tester) async {
      final api = await openList(tester, 'consultas_confirmar_hoja', who: atencion);
      await tapShown(tester, find.text('Confirmado'));
      expect(find.byType(ConfirmOrderSheet), findsOneWidget);
      expect(api.moves, isEmpty, reason: 'abrir la hoja todavía no confirma nada');
      expect(
        find.text(r'Se va a crear el pedido de Carla Gómez: 12 × Llavero con logo, por $30.000. '
            'Entra como confirmado a Pedidos y a la cola de impresión.'),
        findsOneWidget,
      );
      expect(find.text('¿CÓMO PAGA?'), findsOneWidget);
      for (final m in ['Transferencia', 'MercadoPago', 'Efectivo']) {
        expect(find.widgetWithText(ChoiceChip, m), findsOneWidget);
      }
      expect(tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Transferencia')).selected, isTrue);
      expect(find.widgetWithText(GoldButton, 'Confirmar y crear pedido'), findsOneWidget);

      // "Todavía no" cierra sin tocar nada.
      await tester.tap(find.text('Todavía no'));
      await settle(tester);
      expect(find.byType(ConfirmOrderSheet), findsNothing);
      expect(api.moves, isEmpty);
    });

    testWidgets('confirma con transferencia por defecto y avisa que el pedido está en Pedidos', (tester) async {
      final api = await openList(tester, 'consultas_confirmar', who: atencion);
      await tapShown(tester, find.text('Confirmado'));
      await tester.tap(find.widgetWithText(GoldButton, 'Confirmar y crear pedido'));
      await settle(tester);
      expect(api.moves.single, (id: 'c2', to: InquiryMove.confirm));
      expect(api.paidWith, 'transfer');
      expect(find.byType(ConfirmOrderSheet), findsNothing);
      expect(find.text('Confirmada: el pedido ya está en Pedidos'), findsOneWidget);
    });

    testWidgets('se elige otro medio de pago', (tester) async {
      final api = await openList(tester, 'consultas_confirmar_efectivo', who: atencion);
      await tapShown(tester, find.text('Confirmado'));
      await tester.tap(find.widgetWithText(ChoiceChip, 'Efectivo'));
      await tester.pump();
      await tester.tap(find.widgetWithText(GoldButton, 'Confirmar y crear pedido'));
      await settle(tester);
      expect(api.paidWith, 'cash');
    });

    testWidgets('una sola unidad: el total es el precio', (tester) async {
      await openList(
        tester,
        'consultas_confirmar_una',
        who: atencion,
        d: ConsultasData.fromJson({
          'items': [answeredJson('u', quantity: 1)],
        }),
      );
      await tapShown(tester, find.text('Confirmado'));
      expect(find.textContaining(r'1 × Llavero con logo, por $2.500.'), findsOneWidget);
    });

    testWidgets('el rechazo del servidor (falta el costo) queda en la hoja', (tester) async {
      const msg = 'A la respuesta le falta el costo por unidad. Pedile al operador que la complete.';
      final api = FakeConsultasApi()..failWith = ApiException('invalid', msg);
      await openList(tester, 'consultas_confirmar_error', who: atencion, api: api);
      await tapShown(tester, find.text('Confirmado'));
      await tester.tap(find.widgetWithText(GoldButton, 'Confirmar y crear pedido'));
      await settle(tester);
      expect(find.text(msg), findsOneWidget);
      expect(find.byType(ConfirmOrderSheet), findsOneWidget);
      expect(find.text('Confirmada: el pedido ya está en Pedidos'), findsNothing);
    });

    test('al confirmar se refrescan las consultas y todo lo de ventas', () {
      // El pedido nuevo tiene que aparecer en el inicio, en Ventas y en la cola.
      var consultas = 0, cola = 0, inicio = 0;
      final container = ProviderContainer(overrides: [
        consultasProvider.overrideWith((ref) async {
          consultas++;
          return data;
        }),
        produccionProvider.overrideWith((ref) async {
          cola++;
          return BoardData.fromJson({});
        }),
        adminDashboardProvider.overrideWith((ref) async {
          inicio++;
          return AdminDashboard.fromJson({});
        }),
      ]);
      addTearDown(container.dispose);
      for (final p in [consultasProvider, produccionProvider, adminDashboardProvider]) {
        container.listen(p, (_, _) {});
      }
      expect((consultas, cola, inicio), (1, 1, 1));
      invalidateConsultaConfirmed(container);
      for (final p in [consultasProvider, produccionProvider, adminDashboardProvider]) {
        container.read(p);
      }
      expect((consultas, cola, inicio), (2, 2, 2));
    });
  });

  group('adjuntar en una consulta abierta', () {
    testWidgets('ofrece galería, cámara y audio o archivo; sube el archivo elegido', (tester) async {
      final files = FakeAttachmentSource([fakeFile('audio.ogg')]);
      final api = await openList(tester, 'consultas_adjuntar', who: atencion, files: files);
      await tapShown(tester, find.text('Adjuntar'));
      expect(find.byType(AttachSheet), findsOneWidget);
      expect(find.text('Foto de la galería'), findsOneWidget);
      expect(find.text('Sacar foto'), findsOneWidget);
      expect(find.text('Audio o archivo'), findsOneWidget);

      await tester.tap(find.text('Audio o archivo'));
      await settle(tester);
      expect(files.calls, 1);
      expect(api.fileUploads.single, (id: 'c1', filename: 'audio.ogg', contentType: 'audio/ogg'));
      expect(find.text('Archivo adjuntado'), findsOneWidget);
    });

    testWidgets('fotos de la galería y de la cámara van al endpoint de fotos', (tester) async {
      final photos = FakePhotoSource(camera: fakePhoto('camara.jpg'));
      final api = await openList(tester, 'consultas_adjuntar_fotos', who: atencion, photos: photos);
      await tapShown(tester, find.text('Adjuntar'));
      await tester.tap(find.text('Foto de la galería'));
      await settle(tester);
      expect(api.uploads.map((u) => u.filename), ['uno.jpg', 'dos.jpg']);
      expect(find.text('2 fotos adjuntadas'), findsOneWidget);

      await tapShown(tester, find.text('Adjuntar'));
      await tester.tap(find.text('Sacar foto'));
      await settle(tester);
      expect(api.uploads.last, (id: 'c1', filename: 'camara.jpg'));
      expect(find.text('Foto adjuntada'), findsOneWidget);
      expect(api.fileUploads, isEmpty);
    });

    testWidgets('quien solo responde (sin crear) adjunta audio o archivo, no fotos', (tester) async {
      final files = FakeAttachmentSource();
      final api = await openList(tester, 'consultas_adjuntar_operador', who: operador, files: files);
      await tapShown(tester, find.text('Adjuntar').first);
      expect(find.text('Foto de la galería'), findsNothing);
      expect(find.text('Sacar foto'), findsNothing);
      await tester.tap(find.text('Audio o archivo'));
      await settle(tester);
      expect(api.fileUploads.map((f) => f.contentType), ['audio/ogg', 'application/pdf']);
      expect(find.text('2 archivos adjuntados'), findsOneWidget);
    });

    testWidgets('el rechazo del servidor a un archivo se muestra tal cual; cancelar no sube nada', (tester) async {
      final files = FakeAttachmentSource([fakeFile('audio.ogg')]);
      final api = FakeConsultasApi()..failFiles.add('audio.ogg');
      await openList(tester, 'consultas_adjuntar_error', who: atencion, api: api, files: files);
      await tapShown(tester, find.text('Adjuntar'));
      await tester.tap(find.text('Audio o archivo'));
      await settle(tester);
      expect(find.text('El archivo supera los 4 MB.'), findsOneWidget);

      files.files = const [];
      await tapShown(tester, find.text('Adjuntar'));
      await tester.tap(find.text('Audio o archivo'));
      await settle(tester);
      expect(api.fileUploads, isEmpty);
      expect(find.text('No se adjuntó nada.'), findsOneWidget);
    });

    testWidgets('lo que no es audio, video ni PDF, o pesa más de 4 MB, no se manda', (tester) async {
      final files = FakeAttachmentSource([
        fakeFile('planilla.xlsx'),
        fakeFile('video.mp4', size: maxAttachmentBytes + 1),
        fakeFile('plano.pdf'),
      ]);
      final api = await openList(tester, 'consultas_adjuntar_filtrado', who: atencion, files: files);
      await tapShown(tester, find.text('Adjuntar'));
      await tester.tap(find.text('Audio o archivo'));
      await settle(tester);
      expect(api.fileUploads.map((f) => f.filename), ['plano.pdf']);
      expect(find.textContaining('Archivo adjuntado'), findsOneWidget);
      expect(find.textContaining('se pueden adjuntar audios, videos o PDF'), findsOneWidget);
      expect(find.textContaining('pesa más de 4 MB'), findsOneWidget);
    });

    testWidgets('con el máximo de archivos ya cargado avisa y no abre el selector', (tester) async {
      final files = FakeAttachmentSource();
      final full = [
        for (var i = 0; i < 8; i++) {'url': 'https://cdn.test/f$i.pdf', 'name': 'f$i.pdf', 'type': 'application/pdf'},
      ];
      await openList(
        tester,
        'consultas_adjuntar_tope',
        who: atencion,
        files: files,
        d: ConsultasData.fromJson({
          'items': [inquiryJson('c1', mine: true, files: full)],
          'maxFiles': 8,
        }),
      );
      await tapShown(tester, find.text('Adjuntar'));
      await tester.tap(find.text('Audio o archivo'));
      await settle(tester);
      expect(files.calls, 0);
      expect(find.text('Ya tiene el máximo de 8 archivos.'), findsOneWidget);
    });
  });

  group('mensaje para el cliente', () {
    testWidgets('"Copiar mensaje" lo deja en el portapapeles y avisa', (tester) async {
      await openList(tester, 'consultas_copiar');
      await tapShown(tester, find.text('Copiar mensaje'));
      expect(copied.single, sampleMessage);
      expect(find.text('Mensaje copiado'), findsOneWidget);
    });

    testWidgets('"WhatsApp" abre el chat del cliente con el mensaje', (tester) async {
      await openList(tester, 'consultas_whatsapp');
      await tapShown(tester, find.text('WhatsApp'));
      expect(launched.single, 'https://wa.me/5491123456789?text=${Uri.encodeComponent(sampleMessage)}');
    });

    testWidgets('sin teléfono, WhatsApp se abre sin destinatario', (tester) async {
      await openList(
        tester,
        'consultas_whatsapp_sin_telefono',
        d: ConsultasData.fromJson({
          'items': [answeredJson('s', customerPhone: null)],
        }),
      );
      await tapShown(tester, find.text('WhatsApp'));
      expect(launched.single, 'https://wa.me/?text=${Uri.encodeComponent(sampleMessage)}');
    });
  });

  group('responder', () {
    final pending = data.items[0];
    final answered = data.items[1];

    late FakeEstimatorApi calcApi;

    Future<FakeConsultasApi> openAnswer(
      WidgetTester tester,
      String name,
      Consulta q, {
      CalcOverview? overview,
      Object? calcLoadError,
    }) async {
      final api = FakeConsultasApi();
      calcApi = FakeEstimatorApi();
      await showScreen(
        tester,
        name,
        ConsultaAnswerScreen(consulta: q),
        height: 1900,
        me: me,
        overrides: [
          consultasApiProvider.overrideWithValue(api),
          ...estimatorOverrides(calcApi, overview: overview, loadError: calcLoadError),
        ],
      );
      return api;
    }

    String messageText(WidgetTester tester) =>
        tester.widget<TextField>(find.widgetWithText(TextField, 'Mensaje para el cliente')).controller!.text;

    String fieldText(WidgetTester tester, String label) =>
        tester.widget<TextField>(find.widgetWithText(TextField, label)).controller!.text;

    final calcButton = find.widgetWithText(OutlinedButton, 'Calcular precio');
    final recalcButton = find.widgetWithText(OutlinedButton, 'Volver a calcular');
    const helpWithout = 'Calculá el precio con la calculadora: elegís el tipo de producto y queda '
        'guardado el costo para cuando se confirme el pedido.';
    const helpWith = 'Costo guardado. Podés ajustar el precio a mano.';

    /// Abre la calculadora, carga una pieza y usa el precio.
    Future<void> calculate(WidgetTester tester, {Finder? button, String grams = '18,5', String minutes = '35'}) async {
      await tapShown(tester, button ?? calcButton);
      expect(find.byType(PriceEstimatorSheet), findsOneWidget);
      await tester.enterText(find.widgetWithText(TextField, 'Gramos por unidad'), grams);
      await tester.enterText(find.widgetWithText(TextField, 'Minutos'), minutes);
      await tester.tap(find.widgetWithText(ChoiceChip, 'Llaveros'));
      await settle(tester);
      await tester.tap(find.widgetWithText(GoldButton, 'Usar este precio'));
      await settle(tester);
      expect(find.byType(PriceEstimatorSheet), findsNothing);
    }

    testWidgets('consulta sin mensaje: precio con calculadora, sin campo de costo', (tester) async {
      await openAnswer(tester, 'consulta_responder', pending);
      expect(find.text('Responder'), findsOneWidget);
      expect(find.text('12 × Llavero con logo'), findsOneWidget);
      for (final label in [
        r'Precio por unidad ($)',
        'Demora',
        'Precio por unidad comprando más',
        'A partir de cuántas unidades',
        'Medidas',
        'Colores',
        'Nota',
      ]) {
        expect(find.widgetWithText(TextField, label), findsOneWidget, reason: 'falta el campo $label');
      }
      expect(messageText(tester), isEmpty);
      expect(find.text('Se arma solo con estos datos. Escribí acá solo si querés cambiarlo.'), findsOneWidget);
      // El costo ya no se tipea ni se muestra: sale de la calculadora.
      expect(find.textContaining('Costo por unidad'), findsNothing);
      expect(calcButton, findsOneWidget);
      expect(find.text(helpWithout), findsOneWidget);
      // Con más de una unidad se elige cómo se tipea el precio.
      expect(tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Por unidad')).selected, isTrue);
      expect(tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Por las 12')).selected, isFalse);
    });

    // Sugerencia de Agustín (2026-11-19): elegir un producto ya cargado y que
    // se rellene todo, como al cargar una venta.
    const trofeo = <String, dynamic>{
      'id': 'p-trofeo',
      'name': 'Trofeo taekwondo',
      'categoryName': 'Trofeos',
      'material': 'PLA',
      'dimensions': 'Alto: 20 cm',
      'deliveryTime': '5 días hábiles',
      'colors': 'Dorado, Negro',
      'options': [
        {'label': 'Chico', 'unitPrice': 12000, 'grams': 80, 'printMinutes': 240},
        {'label': 'Grande', 'unitPrice': 18000, 'grams': 140.5, 'printMinutes': 420},
      ],
    };
    final loadButton = find.widgetWithText(OutlinedButton, 'Cargar desde un producto');

    testWidgets('"Cargar desde un producto": rellena todo y guarda con qué se costea', (tester) async {
      final api = await openAnswer(tester, 'consulta_responder_producto', pending);
      api.storeProducts = [trofeo];
      await tapShown(tester, loadButton);
      expect(find.text('Elegir producto'), findsOneWidget);
      expect(find.text(r'desde $12.000'), findsOneWidget);
      await tester.tap(find.text('Trofeo taekwondo'));
      await settle(tester);
      // Tiene dos tamaños: pregunta cuál.
      expect(find.text('¿Cuál se cotiza?'), findsOneWidget);
      await tester.tap(find.text('Grande'));
      await settle(tester);

      expect(find.text('Elegir producto'), findsNothing);
      expect(fieldText(tester, r'Precio por unidad ($)'), '18.000');
      expect(fieldText(tester, 'Demora'), '5 días hábiles');
      expect(fieldText(tester, 'Medidas'), 'Alto: 20 cm');
      expect(fieldText(tester, 'Colores'), 'Dorado, Negro');
      expect(find.text(helpWith), findsOneWidget);
      expect(
        find.text('Datos cargados desde Trofeo taekwondo · Grande. Podés cambiar lo que haga falta.'),
        findsOneWidget,
      );

      await tapShown(tester, find.widgetWithText(GoldButton, 'Guardar respuesta'));
      expect(api.answered!.draft.toJson(), {
        'unitPrice': 18000,
        'unitCost': null,
        'filamentId': null,
        'material': 'PLA',
        'grams': 140.5,
        'printMinutes': 420,
        'bulkPrice': null,
        'bulkFrom': null,
        'dimensions': 'Alto: 20 cm',
        'colors': 'Dorado, Negro',
        'deliveryTime': '5 días hábiles',
        'note': null,
        'message': null,
      });
    });

    testWidgets('producto sin gramos ni material: pone el precio pero pide la calculadora', (tester) async {
      final api = await openAnswer(tester, 'consulta_responder_producto_sin_costo', pending);
      api.storeProducts = [
        {
          'id': 'p-x',
          'name': 'Llavero simple',
          'options': [
            {'label': null, 'unitPrice': 2500, 'grams': 0, 'printMinutes': 0},
          ],
        },
      ];
      await tapShown(tester, loadButton);
      await tester.tap(find.text('Llavero simple'));
      await settle(tester);
      // Un solo tamaño: no pregunta nada.
      expect(find.text('Elegir producto'), findsNothing);
      expect(fieldText(tester, r'Precio por unidad ($)'), '2.500');
      expect(fieldText(tester, 'Medidas'), isEmpty);
      expect(find.text(helpWithout), findsOneWidget);
      await tapShown(tester, find.widgetWithText(GoldButton, 'Guardar respuesta'));
      expect(api.answered, isNull);
    });

    testWidgets('una sola unidad: no hay "Por unidad / Por las N" ni renglón del total', (tester) async {
      final one = Consulta.fromJson(inquiryJson('u1', quantity: 1));
      await openAnswer(tester, 'consulta_responder_una', one);
      expect(find.byType(ChoiceChip), findsNothing);
      await tester.enterText(find.widgetWithText(TextField, r'Precio por unidad ($)'), '2.500');
      await tester.pump();
      expect(find.textContaining('c/u'), findsNothing);
    });

    testWidgets('sin precio ni cálculo marca los errores y no llama al servidor', (tester) async {
      final api = await openAnswer(tester, 'consulta_responder_errores', pending);
      await tester.enterText(find.widgetWithText(TextField, 'Precio por unidad comprando más'), '2.000');
      await tester.tap(find.widgetWithText(GoldButton, 'Guardar respuesta'));
      await settle(tester);
      expect(find.text('Poné el precio por unidad.'), findsOneWidget);
      expect(find.text('Calculá el precio con la calculadora: así queda guardado el costo del pedido.'), findsOneWidget);
      expect(find.text('Poné desde cuántas unidades.'), findsOneWidget);
      expect(find.text('Revisá los datos marcados en rojo.'), findsOneWidget);
      expect(api.answered, isNull);
    });

    testWidgets('precio tipeado a mano pero sin calcular: no se guarda', (tester) async {
      final api = await openAnswer(tester, 'consulta_responder_sin_calculo', pending);
      await tester.enterText(find.widgetWithText(TextField, r'Precio por unidad ($)'), '2500');
      await tester.tap(find.widgetWithText(GoldButton, 'Guardar respuesta'));
      await settle(tester);
      expect(find.text('Calculá el precio con la calculadora: así queda guardado el costo del pedido.'), findsOneWidget);
      expect(api.answered, isNull);
    });

    testWidgets('"Calcular precio": el servidor da el precio y queda guardado con qué se calculó', (tester) async {
      final api = await openAnswer(tester, 'consulta_responder_guardar', pending);
      await tapShown(tester, calcButton);
      expect(find.text('Elegí el tipo de producto.'), findsNothing, reason: 'primero pide los gramos o el tiempo');
      expect(find.text('Cargá los gramos o el tiempo de impresión.'), findsOneWidget);
      await tester.enterText(find.widgetWithText(TextField, 'Gramos por unidad'), '18,5');
      await tester.enterText(find.widgetWithText(TextField, 'Horas'), '1');
      await tester.enterText(find.widgetWithText(TextField, 'Minutos'), '35');
      await tester.pump();
      // Sin tipo no hay precio (arranca sin ninguno elegido).
      expect(find.text('Elegí el tipo de producto.'), findsOneWidget);
      expect(calcApi.quotes, isEmpty);
      expect(tester.widget<GoldButton>(find.widgetWithText(GoldButton, 'Usar este precio')).onPressed, isNull);
      await tester.tap(find.widgetWithText(ChoiceChip, 'Llaveros'));
      await settle(tester);
      final sent = calcApi.quotes.single;
      expect(sent.toJson(), {
        'presetId': 'p1',
        'filamentId': estimatorFilamentId,
        'grams': 18.5,
        'hours': closeTo(95 / 60, 1e-9),
      });
      // $2.814 del servidor → número redondo hacia arriba, como en la web.
      expect(tester.widget<Text>(find.byKey(const ValueKey('estimator-price'))).data, r'$2.900');
      // Ni margen ni costo de la pieza a la vista.
      expect(find.textContaining('%'), findsNothing);
      expect(find.textContaining('anancia'), findsNothing);
      expect(find.textContaining('osto total'), findsNothing);
      await tester.tap(find.widgetWithText(GoldButton, 'Usar este precio'));
      await settle(tester);

      expect(fieldText(tester, r'Precio por unidad ($)'), '2.900');
      expect(find.text(r'$2.900 c/u · $34.800 por las 12'), findsOneWidget);
      expect(find.text(helpWith), findsOneWidget);
      expect(recalcButton, findsOneWidget);

      await tester.enterText(find.widgetWithText(TextField, 'Demora'), '5 días hábiles');
      await tester.enterText(find.widgetWithText(TextField, 'Precio por unidad comprando más'), '2.000');
      await tester.enterText(find.widgetWithText(TextField, 'A partir de cuántas unidades'), '50');
      await tester.enterText(find.widgetWithText(TextField, 'Medidas'), '5 × 5 cm');
      await tester.enterText(find.widgetWithText(TextField, 'Colores'), 'negro, dorado');
      await tester.enterText(find.widgetWithText(TextField, 'Nota'), 'Con argolla incluida.');
      await tester.tap(find.widgetWithText(GoldButton, 'Guardar respuesta'));
      await settle(tester);

      expect(api.answered!.id, 'c1');
      expect(api.answered!.draft.toJson(), {
        'unitPrice': 2900,
        'unitCost': null,
        'filamentId': estimatorFilamentId,
        'material': 'PLA',
        'grams': 18.5,
        'printMinutes': 95,
        'bulkPrice': 2000,
        'bulkFrom': 50,
        'dimensions': '5 × 5 cm',
        'colors': 'negro, dorado',
        'deliveryTime': '5 días hábiles',
        'note': 'Con argolla incluida.',
        'message': null,
      });
      // El resultado: el mensaje que armó el servidor, listo para mandar.
      expect(find.text('Respuesta guardada'), findsOneWidget);
      expect(find.textContaining('Te paso la cotización'), findsOneWidget);
      expect(find.textContaining('atención al cliente le va a mandar a Carla Gómez'), findsOneWidget);
      expect(find.text('Copiar mensaje'), findsOneWidget);
      expect(find.widgetWithText(GoldButton, 'Listo'), findsOneWidget);
      expect(find.textContaining('osto'), findsNothing);
    });

    testWidgets('después de calcular se puede ajustar el precio a mano', (tester) async {
      final api = await openAnswer(tester, 'consulta_responder_ajuste', pending);
      await calculate(tester);
      await tester.enterText(find.widgetWithText(TextField, r'Precio por unidad ($)'), '3.000');
      await tester.tap(find.widgetWithText(GoldButton, 'Guardar respuesta'));
      await settle(tester);
      expect(api.answered!.draft.unitPrice, 3000);
      expect(api.answered!.draft.calc!.grams, 18.5, reason: 'el costo sigue saliendo de lo calculado');
    });

    testWidgets('"Por las 12": convierte lo tipeado y manda el precio por unidad', (tester) async {
      final api = await openAnswer(tester, 'consulta_responder_total', pending);
      await tester.enterText(find.widgetWithText(TextField, r'Precio por unidad ($)'), '2.500');
      await tester.pump();
      expect(find.text(r'$2.500 c/u · $30.000 por las 12'), findsOneWidget);
      await tapShown(tester, find.widgetWithText(ChoiceChip, 'Por las 12'));
      // Mismo precio, expresado por el total.
      expect(find.widgetWithText(TextField, r'Precio por unidad ($)'), findsNothing);
      expect(fieldText(tester, r'Precio por las 12 ($)'), '30.000');
      expect(find.text(r'$2.500 c/u · $30.000 por las 12'), findsOneWidget);
      // La calculadora cotiza UNA pieza: en este modo va × 12.
      await calculate(tester);
      expect(fieldText(tester, r'Precio por las 12 ($)'), '34.800');
      expect(find.text(r'$2.900 c/u · $34.800 por las 12'), findsOneWidget);
      // El operador cierra el lote en un número redondo.
      await tester.enterText(find.widgetWithText(TextField, r'Precio por las 12 ($)'), '36.000');
      await tester.pump();
      expect(find.text(r'$3.000 c/u · $36.000 por las 12'), findsOneWidget);
      await tester.tap(find.widgetWithText(GoldButton, 'Guardar respuesta'));
      await settle(tester);
      expect(api.answered!.draft.unitPrice, 3000);
      // Y de vuelta a "Por unidad" antes de guardar daría lo mismo.
    });

    testWidgets('volver a "Por unidad" deja el precio por unidad en el campo', (tester) async {
      await openAnswer(tester, 'consulta_responder_ida_vuelta', pending);
      await tapShown(tester, find.widgetWithText(ChoiceChip, 'Por las 12'));
      await tester.enterText(find.widgetWithText(TextField, r'Precio por las 12 ($)'), '30.000');
      await tapShown(tester, find.widgetWithText(ChoiceChip, 'Por unidad'));
      expect(fieldText(tester, r'Precio por unidad ($)'), '2.500');
    });

    testWidgets('mensaje escrito a mano: se manda ese texto', (tester) async {
      final api = await openAnswer(tester, 'consulta_responder_a_mano', pending);
      await calculate(tester);
      await tester.enterText(find.widgetWithText(TextField, 'Mensaje para el cliente'), 'Hola Carla, sale 2900 cada uno.');
      await tester.tap(find.widgetWithText(GoldButton, 'Guardar respuesta'));
      await settle(tester);
      expect(api.answered!.draft.message, 'Hola Carla, sale 2900 cada uno.');
      expect(find.text('Hola Carla, sale 2900 cada uno.'), findsOneWidget, reason: 'el resultado muestra lo que quedó');
    });

    testWidgets('respuesta vieja (costo a mano): no se muestra el costo y se reenvía tal cual', (tester) async {
      final api = await openAnswer(tester, 'consulta_cambiar_respuesta', answered);
      expect(find.text('Cambiar respuesta'), findsOneWidget);
      expect(messageText(tester), sampleMessage);
      expect(find.textContaining('Si no lo tocás, se vuelve a armar solo'), findsOneWidget);
      // Vienen cargados los datos de la respuesta anterior.
      expect(fieldText(tester, r'Precio por unidad ($)'), '2.500');
      expect(fieldText(tester, 'A partir de cuántas unidades'), '50');
      // El costo viejo ($900) no aparece en ningún lado.
      expect(find.textContaining('900'), findsNothing);
      expect(find.textContaining('Costo por unidad'), findsNothing);
      expect(find.text(helpWith), findsOneWidget);
      expect(calcButton, findsOneWidget, reason: 'nunca se calculó con la calculadora');

      api.builtMessage = 'Mensaje rearmado con \$3.000';
      await tester.enterText(find.widgetWithText(TextField, r'Precio por unidad ($)'), '3.000');
      await tester.tap(find.widgetWithText(GoldButton, 'Guardar respuesta'));
      await settle(tester);
      final json = api.answered!.draft.toJson();
      expect(json['unitPrice'], 3000);
      expect(json['unitCost'], 900, reason: 'el costo cargado antes se manda de nuevo');
      expect(json['filamentId'], isNull);
      expect(json['grams'], isNull);
      expect(api.answered!.draft.message, isNull, reason: 'sin tocar el texto, lo rearma el servidor');
      expect(find.text('Mensaje rearmado con \$3.000'), findsOneWidget);
    });

    testWidgets('respuesta vieja recalculada: deja de mandar el costo a mano', (tester) async {
      final api = await openAnswer(tester, 'consulta_cambiar_recalculada', answered);
      await calculate(tester);
      await tester.tap(find.widgetWithText(GoldButton, 'Guardar respuesta'));
      await settle(tester);
      final json = api.answered!.draft.toJson();
      expect(json['unitCost'], isNull);
      expect(json['filamentId'], estimatorFilamentId);
      expect(json['printMinutes'], 35);
    });

    testWidgets('respuesta con cálculo guardado: "Volver a calcular" abre la calculadora cargada', (tester) async {
      final withCalc = Consulta.fromJson(answeredJson('c9', withCalc: true));
      final api = await openAnswer(tester, 'consulta_volver_a_calcular', withCalc);
      expect(recalcButton, findsOneWidget);
      expect(find.text(helpWith), findsOneWidget);
      await tapShown(tester, recalcButton);
      expect(fieldText(tester, 'Gramos por unidad'), '18,5');
      expect(fieldText(tester, 'Horas'), '1');
      expect(fieldText(tester, 'Minutos'), '35');
      expect(find.text('PLA · Rojo · Grilon3'), findsOneWidget, reason: 'el filamento guardado');
      // Cerrar sin usar no cambia nada.
      Navigator.of(tester.element(find.byType(PriceEstimatorSheet))).pop();
      await settle(tester);
      expect(fieldText(tester, r'Precio por unidad ($)'), '2.500');
      // Guardar sin recalcular manda de nuevo lo calculado antes.
      await tester.enterText(find.widgetWithText(TextField, 'Demora'), '7 días');
      await tester.tap(find.widgetWithText(GoldButton, 'Guardar respuesta'));
      await settle(tester);
      final json = api.answered!.draft.toJson();
      expect(json['unitCost'], isNull);
      expect(json['filamentId'], '11111111-1111-4111-8111-111111111111');
      expect(json['material'], 'PLA');
      expect(json['grams'], 18.5);
      expect(json['printMinutes'], 95);
    });

    testWidgets('calculadora: si el servidor no deja cotizar, se ve el motivo y no hay precio para usar', (tester) async {
      await openAnswer(tester, 'consulta_calculadora_error', pending);
      calcApi.failWith = ApiException('invalid', 'El filamento elegido ya no existe. Elegí otro.');
      await tapShown(tester, calcButton);
      await tester.enterText(find.widgetWithText(TextField, 'Gramos por unidad'), '20');
      await tester.tap(find.widgetWithText(ChoiceChip, 'Macetas'));
      await settle(tester);
      expect(find.text('El filamento elegido ya no existe. Elegí otro.'), findsOneWidget);
      expect(tester.widget<GoldButton>(find.widgetWithText(GoldButton, 'Usar este precio')).onPressed, isNull);
    });

    testWidgets('calculadora: sin permiso o sin conexión muestra el aviso con "Reintentar"', (tester) async {
      await openAnswer(
        tester,
        'consulta_calculadora_sin_permiso',
        pending,
        calcLoadError: ApiException('forbidden', 'No tenés permiso para esta acción.'),
      );
      await tapShown(tester, calcButton);
      expect(find.text('No tenés permiso para esta acción.'), findsOneWidget);
      expect(find.widgetWithText(GoldButton, 'Reintentar'), findsOneWidget);
      expect(find.widgetWithText(GoldButton, 'Usar este precio'), findsNothing);
    });

    testWidgets('calculadora: sin filamentos ni tipos cargados lo avisa', (tester) async {
      await openAnswer(
        tester,
        'consulta_calculadora_vacia',
        pending,
        overview: sampleEstimatorOverview(noFilaments: true, noPresets: true),
      );
      await tapShown(tester, calcButton);
      expect(find.textContaining('No hay filamentos cargados.'), findsOneWidget);
      expect(find.text('No hay tipos disponibles. Avisale al administrador.'), findsOneWidget);
    });

    testWidgets('con mensaje guardado y cambiado a mano: se manda el texto nuevo', (tester) async {
      final api = await openAnswer(tester, 'consulta_cambiar_mensaje', answered);
      await tester.enterText(
        find.widgetWithText(TextField, 'Mensaje para el cliente'),
        '$sampleMessage\n\n¡Gracias por escribirnos!',
      );
      await tester.tap(find.widgetWithText(GoldButton, 'Guardar respuesta'));
      await settle(tester);
      expect(api.answered!.draft.message, '$sampleMessage\n\n¡Gracias por escribirnos!');
    });

    testWidgets('un rechazo del servidor queda en el formulario', (tester) async {
      final api = await openAnswer(tester, 'consulta_responder_error', pending);
      api.failWith = ApiException('invalid', 'Esta consulta ya está cerrada. Reabrila para cambiar la respuesta.');
      await calculate(tester);
      await tester.tap(find.widgetWithText(GoldButton, 'Guardar respuesta'));
      await settle(tester);
      expect(find.text('Esta consulta ya está cerrada. Reabrila para cambiar la respuesta.'), findsOneWidget);
      expect(find.text('Respuesta guardada'), findsNothing);
    });

    testWidgets('desde el listado: "Responder" abre el formulario y "Listo" vuelve', (tester) async {
      calcApi = FakeEstimatorApi();
      final api = await openList(tester, 'consultas_responder_camino', who: operador, extra: estimatorOverrides(calcApi));
      await tapShown(tester, find.text('Responder'));
      expect(find.byType(ConsultaAnswerScreen), findsOneWidget);
      await calculate(tester);
      await tester.tap(find.widgetWithText(GoldButton, 'Guardar respuesta'));
      await settle(tester);
      expect(api.answered!.id, 'c1');
      await tester.tap(find.widgetWithText(GoldButton, 'Listo'));
      await settle(tester);
      expect(find.byType(ConsultaAnswerScreen), findsNothing);
      expect(find.byType(AdminConsultasScreen), findsOneWidget);
    });
  });

  group('nueva consulta', () {
    testWidgets('sin datos válidos muestra los errores y no llama al servidor', (tester) async {
      final api = FakeConsultasApi();
      await showScreen(
        tester,
        'consulta_form_errores',
        const ConsultaFormScreen(maxImages: 6),
        height: 1400,
        me: me,
        overrides: [consultasApiProvider.overrideWithValue(api)],
      );
      expect(find.text('Nueva consulta'), findsOneWidget);
      // El WhatsApp se escribe con el teclado de teléfono.
      expect(
        tester.widget<TextField>(find.widgetWithText(TextField, 'WhatsApp (opcional)')).keyboardType,
        TextInputType.phone,
      );
      await tester.enterText(find.widgetWithText(TextField, 'Cantidad'), '0');
      await tester.tap(find.widgetWithText(GoldButton, 'Cargar consulta'));
      await settle(tester);
      expect(find.text('Poné el nombre del cliente.'), findsOneWidget);
      expect(find.text('Poné qué pide el cliente.'), findsOneWidget);
      expect(find.text('La cantidad mínima es 1.'), findsOneWidget);
      expect(api.created, isNull);
    });

    testWidgets('crea la consulta y sube las fotos; si una falla, avisa cuántas', (tester) async {
      final api = FakeConsultasApi()..failUploads.add('uno.jpg');
      final source = FakePhotoSource();
      await openList(tester, 'consulta_form_completo', who: atencion, api: api, photos: source);
      await tester.tap(find.text('Nueva consulta'));
      await settle(tester);

      await tester.enterText(find.widgetWithText(TextField, 'Nombre del cliente'), 'Carla Gómez');
      await tester.enterText(find.widgetWithText(TextField, 'WhatsApp (opcional)'), '11 2345 6789');
      await tester.enterText(find.widgetWithText(TextField, 'Qué pide'), 'Llavero con logo');
      await tester.enterText(find.widgetWithText(TextField, 'Cantidad'), '12');
      await tester.enterText(find.widgetWithText(TextField, 'Detalles (opcional)'), 'Con el escudo del club.');
      await tapShown(tester, find.text('Sumar fotos'));
      expect(find.text('2 de 6 fotos.'), findsOneWidget);
      await tester.tap(find.widgetWithText(GoldButton, 'Cargar consulta'));
      await settle(tester);

      expect(api.created!.toJson(), {
        'customerName': 'Carla Gómez',
        'customerPhone': '11 2345 6789',
        'title': 'Llavero con logo',
        'description': 'Con el escudo del club.',
        'quantity': 12,
      });
      expect(api.uploads, [(id: 'nueva', filename: 'dos.jpg')]);
      expect(find.byType(ConsultaFormScreen), findsNothing);
      expect(find.text('Consulta cargada. No pudimos subir 1 de las 2 fotos.'), findsOneWidget);
    });

    testWidgets('audios y archivos: se listan, se quitan y suben después de las fotos', (tester) async {
      final api = FakeConsultasApi()..failFiles.add('diseño.pdf');
      final files = FakeAttachmentSource([fakeFile('audio del cliente.ogg'), fakeFile('diseño.pdf'), fakeFile('video.mp4')]);
      await openList(tester, 'consulta_form_archivos', who: atencion, api: api, photos: FakePhotoSource(), files: files);
      await tester.tap(find.text('Nueva consulta'));
      await settle(tester);
      await tester.enterText(find.widgetWithText(TextField, 'Nombre del cliente'), 'Carla');
      await tester.enterText(find.widgetWithText(TextField, 'Qué pide'), 'Llavero');
      await tapShown(tester, find.text('Sumar fotos'));
      await tapShown(tester, find.text('Sumar audio o archivo'));
      expect(find.text('3 de 8 archivos.'), findsOneWidget);
      expect(find.text('audio del cliente.ogg'), findsOneWidget);
      expect(find.byTooltip('Quitar archivo'), findsNWidgets(3));
      await tapShown(tester, find.byTooltip('Quitar archivo').last);
      expect(find.text('video.mp4'), findsNothing);

      await tester.tap(find.widgetWithText(GoldButton, 'Cargar consulta'));
      await settle(tester);
      expect(api.uploads.map((u) => u.filename), ['uno.jpg', 'dos.jpg']);
      expect(api.fileUploads, [(id: 'nueva', filename: 'audio del cliente.ogg', contentType: 'audio/ogg')]);
      expect(find.byType(ConsultaFormScreen), findsNothing);
      expect(find.text('Consulta cargada. No pudimos subir 1 de los 2 archivos.'), findsOneWidget);
    });

    testWidgets('lo mínimo: nombre y qué pide (cantidad 1, sin teléfono ni fotos)', (tester) async {
      final api = FakeConsultasApi();
      await openList(tester, 'consulta_form_minimo', who: atencion, api: api);
      await tester.tap(find.text('Nueva consulta'));
      await settle(tester);
      await tester.enterText(find.widgetWithText(TextField, 'Nombre del cliente'), 'Pedro');
      await tester.enterText(find.widgetWithText(TextField, 'Qué pide'), 'Maceta');
      await tester.tap(find.widgetWithText(GoldButton, 'Cargar consulta'));
      await settle(tester);
      expect(api.created!.toJson(), {'customerName': 'Pedro', 'title': 'Maceta', 'description': '', 'quantity': 1});
      expect(api.uploads, isEmpty);
      expect(find.text('Consulta cargada'), findsOneWidget);
    });
  });

  // Los tres temas de la app (oscuro, claro y luz nocturna), en un celular chico.
  group('temas', () {
    for (final mode in HefestoThemeMode.values) {
      testWidgets('listado, respuesta y alta en ${mode.name}', (tester) async {
        await showScreen(
          tester,
          'consultas_${mode.name}_360',
          const AdminConsultasScreen(),
          width: 360,
          height: 2600,
          mode: mode,
          me: me,
          overrides: [consultasProvider.overrideWith((ref) async => data)],
        );
        expect(find.text('12 × Llavero con logo'), findsNWidgets(2));
        await showScreen(
          tester,
          'consulta_responder_${mode.name}_360',
          ConsultaAnswerScreen(consulta: data.items[1]),
          width: 360,
          height: 2000,
          mode: mode,
          me: me,
        );
        expect(find.text('Guardar respuesta'), findsOneWidget);
        await showScreen(
          tester,
          'consulta_form_${mode.name}_360',
          const ConsultaFormScreen(maxImages: 6),
          width: 360,
          height: 1300,
          mode: mode,
          me: me,
        );
        expect(find.text('Cargar consulta'), findsOneWidget);
      });
    }
  });
}
