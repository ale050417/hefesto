import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/widgets/file_attach.dart';

import 'support/device_kit.dart';
import 'support/photo_kit.dart';

/// Pantalla mínima con el campo de adjuntos (guarda la lista como un formulario).
class _Host extends StatefulWidget {
  const _Host({required this.max});
  final int max;

  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> {
  List<PickedAttachment> files = const [];

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Archivos')),
        // Como las pantallas de la app: la lista termina arriba de la barra del sistema.
        body: SafeArea(
          top: false,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              AttachmentPickerField(files: files, max: widget.max, onChanged: (v) => setState(() => files = v)),
            ],
          ),
        ),
      );
}

void main() {
  setUpAll(setUpDeviceKit);

  group('tipos de adjunto', () {
    test('audio, video y PDF según la extensión; lo demás no', () {
      expect(attachmentTypeOf('nota.ogg'), 'audio/ogg');
      expect(attachmentTypeOf('PTT-2026.OPUS'), 'audio/ogg');
      expect(attachmentTypeOf('audio.m4a'), 'audio/mp4');
      expect(attachmentTypeOf('tema.mp3'), 'audio/mpeg');
      expect(attachmentTypeOf('clip.mp4'), 'video/mp4');
      expect(attachmentTypeOf('clip.mov'), 'video/quicktime');
      expect(attachmentTypeOf('plano.final.pdf'), 'application/pdf');
      expect(attachmentTypeOf('planilla.xlsx'), isNull);
      expect(attachmentTypeOf('foto.jpg'), isNull, reason: 'las fotos van por su propio camino');
      expect(attachmentTypeOf('sin_extension'), isNull);
      // Todo lo que se ofrece lo acepta el servidor (audio/*, video/*, PDF).
      for (final t in attachmentTypes.values) {
        expect(t.startsWith('audio/') || t.startsWith('video/') || t == 'application/pdf', isTrue, reason: t);
      }
    });

    test('íconos y tamaños', () {
      expect(attachmentIcon('audio/ogg'), Icons.audiotrack_rounded);
      expect(attachmentIcon('video/mp4'), Icons.videocam_rounded);
      expect(attachmentIcon('application/pdf'), Icons.picture_as_pdf_rounded);
      expect(attachmentIcon(''), Icons.insert_drive_file_outlined);
      expect(formatFileSize(300), '1 KB');
      expect(formatFileSize(850 * 1024), '850 KB');
      expect(formatFileSize(2516582), '2,4 MB');
    });

    test('el cuerpo multipart lleva un solo campo "file" con el tipo que se le pasa', () {
      final form = fileFormData([1, 2, 3], 'nota.ogg', 'audio/ogg');
      expect(form.fields, isEmpty);
      expect(form.files.single.key, 'file');
      expect(form.files.single.value.filename, 'nota.ogg');
      expect(form.files.single.value.contentType.toString(), 'audio/ogg');
      expect(fileFormData([1], 'a.pdf', 'application/pdf').files.single.value.contentType.toString(), 'application/pdf');
    });
  });

  group('filtro de lo elegido', () {
    test('descarta otros tipos, lo que pasa de 4 MB y lo que no entra', () {
      final res = filterAttachments(
        [
          fakeFile('a.ogg'),
          fakeFile('b.xlsx'),
          fakeFile('c.mp4', size: maxAttachmentBytes + 1),
          fakeFile('d.pdf', size: maxAttachmentBytes),
          fakeFile('e.pdf'),
        ],
        room: 2,
        max: 8,
      );
      expect(res.ok.map((f) => f.filename), ['a.ogg', 'd.pdf']);
      expect(res.notice, contains('quedó 1 afuera'));
      expect(res.notice, contains('se pueden adjuntar audios, videos o PDF'));
      expect(res.notice, contains('pesa más de 4 MB'));
      expect(filterAttachments([fakeFile('a.ogg')], room: 3, max: 8).notice, isNull);
      expect(filterAttachments([fakeFile('a.ogg')], room: 0, max: 8).ok, isEmpty);
    });

    test('aviso de archivos que no subieron', () {
      expect(attachmentFailureNotice(0, 2), isNull);
      expect(attachmentFailureNotice(1, 1), 'No pudimos subir el archivo.');
      expect(attachmentFailureNotice(1, 3), 'No pudimos subir 1 de los 3 archivos.');
      expect(attachmentFailureNotice(3, 3), 'No pudimos subir ninguno de los 3 archivos.');
    });
  });

  group('campo de adjuntos', () {
    Future<_HostState> pump(WidgetTester tester, FakeAttachmentSource source,
        {int max = 8, Phone phone = Phone.small, double textScale = 1}) async {
      await pumpPhone(tester, _Host(max: max),
          phone: phone, textScale: textScale, overrides: [attachmentSourceProvider.overrideWithValue(source)]);
      return tester.state<_HostState>(find.byType(_Host));
    }

    testWidgets('suma, lista con su tamaño y quita', (tester) async {
      final source = FakeAttachmentSource();
      final host = await pump(tester, source);
      expect(find.textContaining('hasta 4 MB cada uno'), findsOneWidget);
      await tester.tap(find.text('Sumar audio o archivo'));
      await settle(tester);
      expect(host.files.map((f) => f.filename), ['audio del cliente.ogg', 'diseño.pdf']);
      expect(find.text('2 de 8 archivos.'), findsOneWidget);
      expect(find.text('2 KB'), findsNWidgets(2));
      await tester.tap(find.byTooltip('Quitar archivo').first);
      await settle(tester);
      expect(host.files.map((f) => f.filename), ['diseño.pdf']);
    });

    testWidgets('respeta el tope, avisa lo que no entra y explica si falla', (tester) async {
      final source = FakeAttachmentSource([for (var i = 0; i < 4; i++) fakeFile('f$i.pdf'), fakeFile('x.zip')]);
      final host = await pump(tester, source, max: 3);
      await tester.tap(find.text('Sumar audio o archivo'));
      await settle(tester);
      expect(host.files, hasLength(3));
      expect(find.text('Llegaste al tope de 3 archivos.'), findsOneWidget);
      expect(find.textContaining('quedó 1 afuera'), findsOneWidget);
      expect(find.textContaining('Un archivo no se sumó'), findsOneWidget);
      expect(tester.widget<OutlinedButton>(find.byType(OutlinedButton)).onPressed, isNull);

      final failing = FakeAttachmentSource()..failWith = Exception('sin selector');
      await pump(tester, failing);
      await tester.tap(find.text('Sumar audio o archivo'));
      await settle(tester);
      expect(find.textContaining('No pudimos abrir tus archivos'), findsOneWidget);
    });

    for (final phone in Phone.both) {
      testWidgets('ocho archivos con nombre larguísimo y letra 1,3× en ${phone.name}', (tester) async {
        final source = FakeAttachmentSource([
          for (var i = 0; i < 8; i++)
            fakeFile('Audio de WhatsApp larguísimo del cliente con todos los detalles del pedido número $i.ogg'),
        ]);
        await pump(tester, source, phone: phone, textScale: 1.3);
        await tester.tap(find.text('Sumar audio o archivo'));
        await settle(tester);
        expectNoLayoutErrors(tester);
        await scrollToEnd(tester);
        expectReachable(tester, find.byTooltip('Quitar archivo').last, what: 'la cruz del último archivo');
        await shoot(tester, 'archivos_campo_lleno');
      });
    }
  });
}
