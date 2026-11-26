// Chat en vivo de una consulta (pedido de Ale, 2026-11-25): globos, envío de
// texto y fotos, reintento, novedades cada 4 segundos, el botón "Chat" de la
// tarjeta y "Crear cotización" para quien cotiza. Todo con una API de mentira.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/widgets/common.dart' show GoldButton, NetImage;
import 'package:hefesto/core/widgets/photo_gallery.dart';
import 'package:hefesto/core/widgets/photo_picker.dart';
import 'package:hefesto/features/admin/consultas/consulta_answer_screen.dart';
import 'package:hefesto/features/admin/consultas/consulta_chat.dart';
import 'package:hefesto/features/admin/consultas/consulta_chat_screen.dart';
import 'package:hefesto/features/admin/consultas/consultas_api.dart';
import 'package:hefesto/features/admin/consultas/consultas_models.dart';
import 'package:hefesto/features/admin/consultas/consultas_screen.dart';
import 'package:hefesto/features/admin/consultas/consultas_widgets.dart';

import 'admin_consultas_models_test.dart' show answeredJson, chatMessageJson, consultasJson, inquiryJson;
import 'admin_consultas_screens_test.dart' show FakeConsultasApi;
import 'support/calc_kit.dart';
import 'support/photo_kit.dart';
import 'support/produccion_fallas_filamentos_kit.dart';

Future<void> settle(WidgetTester tester, [int frames = 8]) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

/// Deja pasar un pedido de novedades (4 s) y que la pantalla lo dibuje.
Future<void> nextPoll(WidgetTester tester) async {
  await tester.pump(ConsultaChatController.pollEvery);
  await settle(tester, 4);
}

/// La app pasa a segundo plano y vuelve, por los estados intermedios como en
/// el teléfono.
Future<void> background(WidgetTester tester) async {
  for (final s in [AppLifecycleState.inactive, AppLifecycleState.hidden, AppLifecycleState.paused]) {
    tester.binding.handleAppLifecycleStateChanged(s);
  }
  await tester.pump();
}

Future<void> foreground(WidgetTester tester) async {
  for (final s in [AppLifecycleState.hidden, AppLifecycleState.inactive, AppLifecycleState.resumed]) {
    tester.binding.handleAppLifecycleStateChanged(s);
  }
  await tester.pump();
}

/// Conversación de ejemplo: dos días, dos personas del equipo, uno propio y
/// una foto sin texto.
List<Map<String, dynamic>> sampleChat() => [
      chatMessageJson('m1', createdAt: '2026-11-24T15:00:00.000Z'),
      chatMessageJson('m2', body: '¿Y de qué color?', createdAt: '2026-11-24T15:01:00.000Z'),
      chatMessageJson('m3', author: 'Ale', mine: true, body: 'Lo quiere de 12 cm', createdAt: '2026-11-25T14:03:11.000Z'),
      chatMessageJson(
        'm4',
        author: 'Agustín',
        body: '',
        image: 'https://cdn.test/consultas/c1/chat/pieza.webp',
        createdAt: '2026-11-25T14:05:00.000Z',
      ),
    ];

DateTime localOf(String iso) => DateTime.parse(iso).toLocal();

void main() {
  final copied = <String>[];

  setUpAll(() async {
    await setUpKit();
    mockImageCachePlugins();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') copied.add('${(call.arguments as Map)['text']}');
      return null;
    });
  });

  setUp(copied.clear);

  final data = ConsultasData.fromJson(consultasJson());
  final pending = data.items[0]; // c1, sin cotizar
  final answered = data.items[1]; // c2, cotizada
  final confirmed = data.items[2]; // c3
  final cancelled = data.items[3]; // c4
  final me = meWith({'consultas': allActions});
  final atencion = meWith({'consultas': ['ver', 'crear']}, role: 'atencion al cliente');
  final operador = meWith({'consultas': ['ver', 'editar']}, role: 'operator');
  final soloVer = meWith({'consultas': ['ver']}, role: 'operator');

  final input = find.byKey(const Key('chat-input'));
  final sendButton = find.widgetWithIcon(IconButton, Icons.send_rounded);
  final photoButton = find.byTooltip('Mandar una foto');

  Future<FakeConsultasApi> openChat(
    WidgetTester tester,
    String name, {
    Consulta? q,
    dynamic who,
    List<Map<String, dynamic>>? chat,
    FakeConsultasApi? api,
    PhotoSource? photos,
    double height = 880,
  }) async {
    final fake = api ?? FakeConsultasApi();
    if (chat != null) fake.chat.addAll(chat);
    await showScreen(
      tester,
      name,
      ConsultaChatScreen(consulta: q ?? pending),
      height: height,
      me: who ?? me,
      overrides: [
        consultasProvider.overrideWith((ref) async => data),
        consultasApiProvider.overrideWithValue(fake),
        if (photos != null) photoSourceProvider.overrideWithValue(photos),
        ...estimatorOverrides(FakeEstimatorApi()),
      ],
    );
    return fake;
  }

  Future<void> type(WidgetTester tester, String text) async {
    await tester.enterText(input, text);
    await tester.pump();
  }

  group('textos del chat', () {
    test('hora y separador de día', () {
      expect(chatTime(DateTime(2026, 11, 25, 9, 5)), '09:05');
      final now = DateTime(2026, 11, 25, 18);
      expect(chatDayLabel(DateTime(2026, 11, 25, 0, 1), now: now), 'Hoy');
      expect(chatDayLabel(DateTime(2026, 11, 24, 23, 59), now: now), 'Ayer');
      expect(chatDayLabel(DateTime(2026, 11, 20, 10), now: now), 'viernes 20 de noviembre');
    });
  });

  group('conversación', () {
    testWidgets('dibuja los globos: autor, hora, días y foto; el encabezado dice de quién es', (tester) async {
      final api = await openChat(tester, 'chat', chat: sampleChat());
      // Encabezado: el cliente y lo que pide.
      expect(find.descendant(of: find.byType(AppBar), matching: find.text('Carla Gómez')), findsOneWidget);
      expect(find.descendant(of: find.byType(AppBar), matching: find.text('12 × Llavero con logo')), findsOneWidget);

      expect(find.text('¿De qué tamaño lo quiere?'), findsOneWidget);
      expect(find.text('¿Y de qué color?'), findsOneWidget);
      expect(find.text('Lo quiere de 12 cm'), findsOneWidget);
      // El nombre va en los mensajes de otros, una vez por tanda; nunca en los propios.
      expect(find.text('Lucas'), findsOneWidget);
      expect(find.text('Agustín'), findsOneWidget);
      expect(find.text('Ale'), findsNothing);
      // Los propios a la derecha, los del resto a la izquierda.
      final screen = tester.getSize(find.byType(Scaffold)).width;
      expect(tester.getCenter(find.text('Lo quiere de 12 cm')).dx, greaterThan(screen / 2));
      expect(tester.getCenter(find.text('¿Y de qué color?')).dx, lessThan(screen / 2));
      // Hora de cada uno y un separador por día.
      expect(find.text(chatTime(localOf('2026-11-25T14:03:11.000Z'))), findsOneWidget);
      expect(find.text(chatDayLabel(localOf('2026-11-24T15:00:00.000Z'))), findsOneWidget);
      expect(find.text(chatDayLabel(localOf('2026-11-25T14:03:11.000Z'))), findsOneWidget);
      // En orden: lo más viejo arriba.
      expect(
        tester.getTopLeft(find.text('¿De qué tamaño lo quiere?')).dy,
        lessThan(tester.getTopLeft(find.text('Lo quiere de 12 cm')).dy),
      );
      // La primera vez se pide todo (sin `after`).
      expect(api.chatFetches.single, (id: 'c1', after: null));

      // La foto se abre a pantalla completa.
      expect(find.byType(NetImage), findsOneWidget);
      await tester.tap(find.byType(NetImage));
      await settle(tester);
      expect(find.byType(PhotoViewerScreen), findsOneWidget);
      expect(tester.widget<PhotoViewerScreen>(find.byType(PhotoViewerScreen)).urls,
          ['https://cdn.test/consultas/c1/chat/pieza.webp']);
    });

    testWidgets('sin mensajes muestra la invitación a escribir', (tester) async {
      await openChat(tester, 'chat_vacio');
      expect(find.text('Todavía no hay mensajes.'), findsOneWidget);
      expect(find.text('Escribile al equipo por acá.'), findsOneWidget);
      // Sin nada escrito no se puede enviar.
      expect(tester.widget<IconButton>(sendButton).onPressed, isNull);
    });

    testWidgets('si no carga, avisa y "Reintentar" lo vuelve a pedir', (tester) async {
      final api = FakeConsultasApi()..failChat = ApiException('forbidden', 'No tenés permiso para hacer esto.');
      await openChat(tester, 'chat_error', api: api, chat: sampleChat());
      expect(find.text('No tenés permiso para hacer esto.'), findsOneWidget);
      // Con el error a la vista no se insiste solo.
      await nextPoll(tester);
      expect(api.chatFetches, hasLength(1));

      api.failChat = null;
      await tester.tap(find.widgetWithText(GoldButton, 'Reintentar'));
      await settle(tester);
      expect(find.text('Lo quiere de 12 cm'), findsOneWidget);
      expect(api.chatFetches, hasLength(2));
    });

    testWidgets('mantener apretado un mensaje copia el texto', (tester) async {
      await openChat(tester, 'chat_copiar', chat: sampleChat());
      await tester.longPress(find.text('Lo quiere de 12 cm'));
      await settle(tester);
      expect(copied.single, 'Lo quiere de 12 cm');
      expect(find.text('Mensaje copiado'), findsOneWidget);
    });

    testWidgets('el encabezado abre el resumen de la consulta', (tester) async {
      await openChat(tester, 'chat_resumen', chat: sampleChat());
      await tester.tap(find.byTooltip('Ver la consulta'));
      await settle(tester);
      expect(find.byType(ConsultaSummarySheet), findsOneWidget);
      final sheet = find.byType(ConsultaSummarySheet);
      expect(find.descendant(of: sheet, matching: find.text('Llavero con logo')), findsOneWidget);
      expect(find.descendant(of: sheet, matching: find.text('Carla Gómez · +54 9 11 2345-6789')), findsOneWidget);
      expect(find.descendant(of: sheet, matching: find.text('12 unidades')), findsOneWidget);
      expect(find.descendant(of: sheet, matching: find.text('Con el escudo del club, de 5 cm.')), findsOneWidget);
      expect(find.descendant(of: sheet, matching: find.text('Sin cotizar')), findsOneWidget);
      // Las fotos de referencia y los adjuntos de la consulta.
      expect(find.descendant(of: sheet, matching: find.byType(PhotoStrip)), findsOneWidget);
      expect(find.descendant(of: sheet, matching: find.text('diseño.pdf')), findsOneWidget);
    });

    testWidgets('resumen de una cotizada: pedido pendiente de pago y el mensaje para mandar', (tester) async {
      await openChat(tester, 'chat_resumen_cotizada', q: answered, who: atencion);
      // Tocar el nombre también lo abre.
      await tester.tap(find.descendant(of: find.byType(AppBar), matching: find.text('Carla Gómez')));
      await settle(tester);
      final sheet = find.byType(ConsultaSummarySheet);
      expect(find.descendant(of: sheet, matching: find.text('Cotizada · espera seña')), findsOneWidget);
      expect(find.descendant(of: sheet, matching: find.text('Pedido pendiente de pago')), findsOneWidget);
      expect(find.descendant(of: sheet, matching: find.text(r'Total del pedido: $30.000')), findsOneWidget);
      expect(find.descendant(of: sheet, matching: find.text('Copiar mensaje')), findsOneWidget);
      expect(find.descendant(of: sheet, matching: find.text('WhatsApp')), findsOneWidget);
    });
  });

  group('mandar mensajes', () {
    testWidgets('texto: aparece como "enviando…" y queda con la hora cuando el servidor responde', (tester) async {
      final api = FakeConsultasApi()..sendGate = Completer<void>();
      await openChat(tester, 'chat_enviar', api: api, chat: sampleChat());
      await type(tester, '  Dice que en rojo  ');
      await tester.tap(sendButton);
      await tester.pump();
      // Al toque: el globo con "enviando…" y el campo vacío.
      expect(find.text('Dice que en rojo'), findsOneWidget);
      expect(find.text('enviando…'), findsOneWidget);
      expect(tester.widget<TextField>(input).controller!.text, isEmpty);
      expect(api.sent, isEmpty);

      api.sendGate!.complete();
      await settle(tester);
      expect(api.sent.single, (id: 'c1', body: 'Dice que en rojo', photo: null));
      expect(find.text('enviando…'), findsNothing);
      expect(find.text('Dice que en rojo'), findsOneWidget);
      expect(find.text(chatTime(localOf('2026-11-25T18:00:01.000Z'))), findsOneWidget);

      // El pedido de novedades lo trae de nuevo: no se repite.
      await nextPoll(tester);
      expect(find.text('Dice que en rojo'), findsOneWidget);
    });

    testWidgets('el primer mensaje de una conversación vacía', (tester) async {
      final api = await openChat(tester, 'chat_primer_mensaje');
      await type(tester, 'Hola, tengo un cliente nuevo');
      await tester.tap(sendButton);
      await settle(tester);
      expect(api.sent.single.body, 'Hola, tengo un cliente nuevo');
      expect(find.text('Todavía no hay mensajes.'), findsNothing);
      expect(find.text('Hola, tengo un cliente nuevo'), findsOneWidget);
    });

    testWidgets('foto sola: se elige de la galería, se ve lista y se manda sin texto', (tester) async {
      final photos = FakePhotoSource(gallery: [fakePhoto('pieza.jpg')]);
      final api = await openChat(tester, 'chat_foto', chat: sampleChat(), photos: photos);
      await tester.tap(photoButton);
      await settle(tester);
      expect(find.text('Mandar una foto'), findsOneWidget);
      await tester.tap(find.text('Elegir de la galería'));
      await settle(tester);
      expect(find.text('Foto lista para mandar'), findsOneWidget);
      expect(photos.galleryCalls, 1);

      await tester.tap(sendButton);
      await settle(tester);
      expect(api.sent.single, (id: 'c1', body: '', photo: 'pieza.jpg'));
      expect(find.text('Foto lista para mandar'), findsNothing);
      // La del ejemplo y la nueva.
      expect(find.byType(NetImage), findsNWidgets(2));
    });

    testWidgets('foto de la cámara con texto; la foto elegida se puede quitar', (tester) async {
      final photos = FakePhotoSource(camera: fakePhoto('camara.jpg'));
      final api = await openChat(tester, 'chat_foto_texto', photos: photos);
      await tester.tap(photoButton);
      await settle(tester);
      await tester.tap(find.text('Sacar una foto'));
      await settle(tester);
      expect(find.text('Foto lista para mandar'), findsOneWidget);
      await tester.tap(find.byTooltip('Quitar la foto'));
      await tester.pump();
      expect(find.text('Foto lista para mandar'), findsNothing);
      expect(tester.widget<IconButton>(sendButton).onPressed, isNull);

      await tester.tap(photoButton);
      await settle(tester);
      await tester.tap(find.text('Sacar una foto'));
      await settle(tester);
      await type(tester, 'Así quedó la muestra');
      await tester.tap(sendButton);
      await settle(tester);
      expect(api.sent.single, (id: 'c1', body: 'Así quedó la muestra', photo: 'camara.jpg'));
    });

    testWidgets('una foto que no sirve (formato) se avisa y no se adjunta', (tester) async {
      final photos = FakePhotoSource(gallery: [fakePhoto('pieza.heic')]);
      final api = await openChat(tester, 'chat_foto_formato', photos: photos);
      await tester.tap(photoButton);
      await settle(tester);
      await tester.tap(find.text('Elegir de la galería'));
      await settle(tester);
      expect(find.text('La foto tiene que ser JPG, PNG o WebP.'), findsOneWidget);
      expect(find.text('Foto lista para mandar'), findsNothing);
      expect(api.sent, isEmpty);
    });

    testWidgets('si falla queda con el motivo; "Reintentar" lo manda y "Descartar" lo saca', (tester) async {
      final api = FakeConsultasApi()
        ..failSend = ApiException('offline', 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.');
      await openChat(tester, 'chat_fallo', api: api, chat: sampleChat());
      await type(tester, 'Confirmó el color');
      await tester.tap(sendButton);
      await settle(tester);
      expect(find.text('Confirmó el color'), findsOneWidget);
      expect(find.text('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.'), findsOneWidget);
      expect(find.text('enviando…'), findsNothing);
      expect(api.sent, isEmpty);

      // Vuelve a fallar: sigue ahí.
      await tester.tap(find.text('Reintentar'));
      await settle(tester);
      expect(find.text('Reintentar'), findsOneWidget);

      api.failSend = null;
      await tester.tap(find.text('Reintentar'));
      await settle(tester);
      expect(api.sent.single.body, 'Confirmó el color');
      expect(find.text('Reintentar'), findsNothing);
      expect(find.text('Confirmó el color'), findsOneWidget);

      // Otro que falla y se descarta.
      api.failSend = ApiException('invalid', 'Máximo 2000 caracteres.');
      await type(tester, 'Este no va');
      await tester.tap(sendButton);
      await settle(tester);
      expect(find.text('Máximo 2000 caracteres.'), findsOneWidget);
      await tester.tap(find.text('Descartar'));
      await settle(tester);
      expect(find.text('Este no va'), findsNothing);
      expect(api.sent, hasLength(1));
    });
  });

  group('en vivo', () {
    testWidgets('cada 4 segundos pide lo nuevo (con `after`) y lo suma al final', (tester) async {
      final api = await openChat(tester, 'chat_novedades', chat: sampleChat());
      expect(api.chatFetches, hasLength(1));
      api.chat.add(chatMessageJson('m5', author: 'Agustín', body: 'Ya lo modelé', createdAt: '2026-11-25T14:10:00.000Z'));
      await nextPoll(tester);
      expect(api.chatFetches, hasLength(2));
      // Pide desde el último que ya tenía.
      expect(api.chatFetches.last.after!.isAtSameMomentAs(DateTime.parse('2026-11-25T14:05:00.000Z')), isTrue);
      expect(find.text('Ya lo modelé'), findsOneWidget);
      // Sigue la tanda de Agustín (m4): no repite el nombre.
      expect(find.text('Agustín'), findsOneWidget);

      await nextPoll(tester);
      expect(api.chatFetches, hasLength(3));
      expect(api.chatFetches.last.after!.isAtSameMomentAs(DateTime.parse('2026-11-25T14:10:00.000Z')), isTrue);
      expect(find.text('Ya lo modelé'), findsOneWidget, reason: 'no se repite');
    });

    testWidgets('un pedido de novedades que falla no rompe el chat y se reintenta solo', (tester) async {
      final api = await openChat(tester, 'chat_novedades_error', chat: sampleChat());
      api.failChat = ApiException('offline', 'Sin conexión.');
      await nextPoll(tester);
      expect(find.text('Sin conexión.'), findsNothing);
      expect(find.text('Lo quiere de 12 cm'), findsOneWidget);
      api
        ..failChat = null
        ..chat.add(chatMessageJson('m5', body: 'Volvió la señal', createdAt: '2026-11-25T14:10:00.000Z'));
      await nextPoll(tester);
      expect(find.text('Volvió la señal'), findsOneWidget);
    });

    testWidgets('en segundo plano no pide nada; al volver pide enseguida', (tester) async {
      addTearDown(() => tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed));
      final api = await openChat(tester, 'chat_segundo_plano', chat: sampleChat());
      expect(api.chatFetches, hasLength(1));
      await background(tester);
      api.chat.add(chatMessageJson('m5', body: 'Llegó mientras no miraba', createdAt: '2026-11-25T14:10:00.000Z'));
      await tester.pump(const Duration(seconds: 20));
      expect(api.chatFetches, hasLength(1));
      expect(find.text('Llegó mientras no miraba'), findsNothing);

      await foreground(tester);
      await settle(tester, 3);
      expect(api.chatFetches, hasLength(2), reason: 'sin esperar los 4 segundos');
      expect(find.text('Llegó mientras no miraba'), findsOneWidget);
      // Y sigue pidiendo cada 4 segundos.
      await nextPoll(tester);
      expect(api.chatFetches, hasLength(3));
    });

    testWidgets('al cerrar la pantalla deja de pedir', (tester) async {
      final api = await openChat(tester, 'chat_cerrar', chat: sampleChat());
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(seconds: 20));
      expect(api.chatFetches, hasLength(1));
    });

    List<Map<String, dynamic>> longChat() => [
          for (var i = 1; i <= 40; i++)
            chatMessageJson(
              'l$i',
              mine: i.isEven,
              body: 'Mensaje $i',
              createdAt: '2026-11-25T13:${i.toString().padLeft(2, '0')}:00.000Z',
            ),
        ];

    testWidgets('abre en lo último; si estás al final, lo nuevo queda a la vista', (tester) async {
      final api = await openChat(tester, 'chat_largo', chat: longChat());
      expect(find.text('Mensaje 40'), findsOneWidget);
      expect(find.text('Mensaje 1'), findsNothing, reason: 'lo viejo queda arriba, fuera de la pantalla');
      api.chat.add(chatMessageJson('n1', body: 'Recién llegado', createdAt: '2026-11-25T14:30:00.000Z'));
      await nextPoll(tester);
      expect(find.text('Recién llegado').hitTestable(), findsOneWidget);
      expect(find.text('Mensajes nuevos'), findsNothing);
    });

    testWidgets('leyendo mensajes viejos, lo nuevo no mueve la lista y avisa "Mensajes nuevos"', (tester) async {
      final api = await openChat(tester, 'chat_largo_arriba', chat: longChat());
      await tester.drag(find.byType(ListView), const Offset(0, 600));
      await settle(tester);
      expect(find.text('Mensaje 40'), findsNothing);
      final reading = find.text('Mensaje 27');
      expect(reading, findsOneWidget);
      final before = tester.getTopLeft(reading).dy;

      api.chat.add(chatMessageJson('n1', body: 'Recién llegado', createdAt: '2026-11-25T14:30:00.000Z'));
      await nextPoll(tester);
      expect(tester.getTopLeft(reading).dy, closeTo(before, 1), reason: 'lo que se estaba leyendo no se movió');
      expect(find.text('Mensajes nuevos'), findsOneWidget);

      await tester.tap(find.text('Mensajes nuevos'));
      await settle(tester);
      expect(find.text('Recién llegado').hitTestable(), findsOneWidget);
      expect(find.text('Mensajes nuevos'), findsNothing);
    });

    testWidgets('apenas subido (lo último sigue armado): lo nuevo tampoco mueve la lista', (tester) async {
      final api = await openChat(tester, 'chat_largo_apenas_arriba', chat: longChat());
      await tester.drag(find.byType(ListView), const Offset(0, 160));
      await settle(tester);
      final reading = find.text('Mensaje 34');
      expect(reading, findsOneWidget);
      final before = tester.getTopLeft(reading).dy;
      api.chat.add(chatMessageJson('n1', body: 'Recién llegado', createdAt: '2026-11-25T14:30:00.000Z'));
      await nextPoll(tester);
      expect(tester.getTopLeft(reading).dy, closeTo(before, 1));
      expect(find.text('Mensajes nuevos'), findsOneWidget);
    });

    testWidgets('mandar uno propio baja al final aunque se esté leyendo arriba', (tester) async {
      await openChat(tester, 'chat_largo_enviar', chat: longChat());
      await tester.drag(find.byType(ListView), const Offset(0, 600));
      await settle(tester);
      await type(tester, 'Va el mío');
      await tester.tap(sendButton);
      await settle(tester);
      expect(find.text('Va el mío').hitTestable(), findsOneWidget);
      expect(find.text('Mensajes nuevos'), findsNothing);
    });
  });

  group('"Crear cotización" en el chat', () {
    testWidgets('operador en una consulta sin cotizar: botón principal que abre la cotización', (tester) async {
      await openChat(tester, 'chat_operador', who: operador, chat: sampleChat());
      expect(find.widgetWithText(GoldButton, 'Crear cotización'), findsOneWidget);
      expect(find.textContaining('el pedido queda en pendiente de pago'), findsOneWidget);
      await tester.tap(find.widgetWithText(GoldButton, 'Crear cotización'));
      await settle(tester);
      expect(find.byType(ConsultaAnswerScreen), findsOneWidget);
      expect(tester.widget<ConsultaAnswerScreen>(find.byType(ConsultaAnswerScreen)).consulta.id, 'c1');
    });

    testWidgets('operador en una cotizada: "Cambiar cotización" y el pedido pendiente', (tester) async {
      await openChat(tester, 'chat_operador_cotizada', q: answered, who: operador);
      expect(find.widgetWithText(GoldButton, 'Cambiar cotización'), findsOneWidget);
      expect(find.widgetWithText(GoldButton, 'Crear cotización'), findsNothing);
      expect(find.text(r'Pedido pendiente de pago · $30.000'), findsOneWidget);
    });

    testWidgets('la vendedora no cotiza: en la cotizada solo ve el pedido pendiente', (tester) async {
      await openChat(tester, 'chat_vendedora', who: atencion, chat: sampleChat());
      expect(find.text('Crear cotización'), findsNothing);
      expect(find.text('Cambiar cotización'), findsNothing);

      await openChat(tester, 'chat_vendedora_cotizada', q: answered, who: atencion);
      expect(find.text('Cambiar cotización'), findsNothing);
      expect(find.text(r'Pedido pendiente de pago · $30.000'), findsOneWidget);
    });

    testWidgets('consulta cerrada (confirmada o no se hizo): no se cotiza, se sigue pudiendo escribir', (tester) async {
      for (final q in [confirmed, cancelled]) {
        final api = await openChat(tester, 'chat_cerrada_${q.status.api}', q: q, who: me);
        expect(find.text('Crear cotización'), findsNothing);
        expect(find.text('Cambiar cotización'), findsNothing);
        expect(find.textContaining('Pedido pendiente de pago'), findsNothing);
        await type(tester, 'Una cosa más');
        await tester.tap(sendButton);
        await settle(tester);
        expect(api.sent.single.id, q.id);
      }
    });

    testWidgets('con el teclado abierto la franja se esconde para dejarle lugar al chat', (tester) async {
      await openChat(tester, 'chat_operador_teclado', who: operador, chat: sampleChat());
      tester.view.viewInsets = const FakeViewPadding(bottom: 300 * 2.75);
      await settle(tester, 3);
      expect(find.text('Crear cotización'), findsNothing);
      expect(find.text('Lo quiere de 12 cm'), findsOneWidget);
      // La barra de escribir queda arriba del teclado.
      expect(tester.getRect(input).bottom, lessThanOrEqualTo(880 - 300));
    });
  });

  group('botón "Chat" en el listado', () {
    ConsultasData withChat() => ConsultasData.fromJson({
          'items': [
            inquiryJson('c1', mine: true, chatMessages: 5, chatUnread: 3),
            answeredJson('c2', chatMessages: 7, chatUnread: 0),
            inquiryJson('c5', title: 'Sin conversación'),
          ],
        });

    Future<FakeConsultasApi> openList(WidgetTester tester, String name, {dynamic who, List<Override> extra = const []}) async {
      final api = FakeConsultasApi()..chat.addAll(sampleChat());
      await showScreen(
        tester,
        name,
        const AdminConsultasScreen(),
        height: 2200,
        me: who ?? me,
        overrides: [
          if (extra.isEmpty) consultasProvider.overrideWith((ref) async => withChat()),
          consultasApiProvider.overrideWithValue(api),
          ...extra,
        ],
      );
      return api;
    }

    testWidgets('dice cuántos sin leer hay; si no, cuántos mensajes tiene', (tester) async {
      await openList(tester, 'consultas_chat_boton');
      expect(find.byType(ConsultaChatButton), findsNWidgets(3));
      // Sin leer: lo dice y marca el ícono.
      final unread = find.byKey(const ValueKey('chat-c1'));
      expect(find.descendant(of: unread, matching: find.text('Chat · 3')), findsOneWidget);
      expect(find.descendant(of: unread, matching: find.byType(Badge)), findsOneWidget);
      // Todo leído: la cantidad, apagada.
      final read = find.byKey(const ValueKey('chat-c2'));
      expect(find.descendant(of: read, matching: find.text('Chat  7')), findsOneWidget);
      expect(find.descendant(of: read, matching: find.byType(Badge)), findsNothing);
      // Sin mensajes: solo "Chat".
      expect(find.descendant(of: find.byKey(const ValueKey('chat-c5')), matching: find.text('Chat')), findsOneWidget);
    });

    testWidgets('lo ven la vendedora y el operador; quien solo mira, no', (tester) async {
      await openList(tester, 'consultas_chat_vendedora', who: atencion);
      expect(find.byType(ConsultaChatButton), findsNWidgets(3));
      await openList(tester, 'consultas_chat_operador', who: operador);
      expect(find.byType(ConsultaChatButton), findsNWidgets(3));
      await openList(tester, 'consultas_chat_solo_ver', who: soloVer);
      expect(find.byType(ConsultaChatButton), findsNothing);
    });

    testWidgets('abre el chat de esa consulta y, al volver, pide el listado de nuevo (se va el "sin leer")', (tester) async {
      var loads = 0;
      final api = await openList(tester, 'consultas_chat_abrir', who: atencion, extra: [
        consultasProvider.overrideWith((ref) async {
          loads++;
          // La primera vez hay 3 sin leer; después de abrir el chat, ninguno.
          return ConsultasData.fromJson({
            'items': [inquiryJson('c1', mine: true, chatMessages: 5, chatUnread: loads == 1 ? 3 : 0)],
          });
        }),
      ]);
      expect(loads, 1);
      await tester.tap(find.text('Chat · 3'));
      await settle(tester);
      expect(find.byType(ConsultaChatScreen), findsOneWidget);
      expect(api.chatFetches.single.id, 'c1');
      expect(find.text('Lo quiere de 12 cm'), findsOneWidget);

      await tester.pageBack();
      await settle(tester);
      expect(find.byType(ConsultaChatScreen), findsNothing);
      expect(loads, 2);
      expect(find.text('Chat · 3'), findsNothing);
      expect(find.text('Chat  5'), findsOneWidget);
      // Cerrado el chat, no quedan pedidos de novedades dando vueltas.
      await tester.pump(const Duration(seconds: 20));
      expect(api.chatFetches, hasLength(1));
    });
  });

  group('ConsultaChatController', () {
    test('un mensaje de otro guardado justo antes del propio no se pierde', () async {
      // El envío propio devuelve un mensaje MÁS NUEVO que uno ajeno que todavía
      // no se pidió: el próximo pedido tiene que salir desde lo último que
      // llegó por el listado, no desde el propio.
      final api = FakeConsultasApi()..chat.add(chatMessageJson('m1', createdAt: '2026-11-25T17:00:00.000Z'));
      final container = ProviderContainer(overrides: [consultasApiProvider.overrideWithValue(api)]);
      addTearDown(container.dispose);
      final sub = container.listen(consultaChatProvider('c1'), (_, _) {});
      final chat = container.read(consultaChatProvider('c1').notifier);
      await pumpEventQueue();
      expect(sub.read().messages.map((m) => m.id), ['m1']);

      // Otro escribe a las 17:59:59 y enseguida se manda el propio (18:00:01).
      api.chat.add(chatMessageJson('otro', body: 'Ojo con el tamaño', createdAt: '2026-11-25T17:59:59.000Z'));
      chat.send('Listo');
      await pumpEventQueue();
      expect(sub.read().messages.map((m) => m.id), ['m1', 'sent-1']);

      await chat.refresh();
      expect(api.chatFetches.last.after!.isAtSameMomentAs(DateTime.parse('2026-11-25T17:00:00.000Z')), isTrue);
      // Llega el ajeno y queda en su lugar, antes del propio.
      expect(sub.read().messages.map((m) => m.id), ['m1', 'otro', 'sent-1']);
      chat.pause();
    });

    test('no manda mensajes vacíos', () async {
      final api = FakeConsultasApi();
      final container = ProviderContainer(overrides: [consultasApiProvider.overrideWithValue(api)]);
      addTearDown(container.dispose);
      final sub = container.listen(consultaChatProvider('c1'), (_, _) {});
      container.read(consultaChatProvider('c1').notifier).send('   ');
      await pumpEventQueue();
      expect(api.sent, isEmpty);
      expect(sub.read().outbox, isEmpty);
    });
  });
}
