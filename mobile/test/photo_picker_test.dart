import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/widgets/photo_picker.dart';

import 'support/device_kit.dart';
import 'support/photo_kit.dart';

/// Pantalla mínima con el campo de fotos (guarda la lista como un formulario).
class _Host extends StatefulWidget {
  const _Host({required this.max, this.enabled = true});
  final int max;
  final bool enabled;

  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> {
  List<PickedPhoto> photos = const [];

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Fotos')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            PhotoPickerField(
              photos: photos,
              max: widget.max,
              enabled: widget.enabled,
              onChanged: (v) => setState(() => photos = v),
            ),
          ],
        ),
      );
}

void main() {
  setUpAll(setUpDeviceKit);

  group('subida de una foto', () {
    test('el tipo sale de la extensión: solo JPG, PNG y WebP', () {
      expect(imageSubtypeOf('foto.jpg'), 'jpeg');
      expect(imageSubtypeOf('FOTO.JPEG'), 'jpeg');
      expect(imageSubtypeOf('captura.png'), 'png');
      expect(imageSubtypeOf('pieza.final.webp'), 'webp');
      expect(imageSubtypeOf('IMG_0001.heic'), isNull);
      expect(imageSubtypeOf('animado.gif'), isNull);
      expect(imageSubtypeOf('sin_extension'), isNull);
    });

    test('el cuerpo es multipart con un solo campo "file" y su tipo de imagen', () {
      final form = imageFormData(tinyPng, 'pieza.png');
      expect(form.fields, isEmpty);
      expect(form.files, hasLength(1));
      final entry = form.files.single;
      expect(entry.key, 'file');
      expect(entry.value.filename, 'pieza.png');
      expect(entry.value.contentType.toString(), 'image/png');
      expect(entry.value.length, tinyPng.length);
      expect(imageFormData(tinyPng, 'a.JPG').files.single.value.contentType.toString(), 'image/jpeg');
      expect(imageFormData(tinyPng, 'a.webp').files.single.value.contentType.toString(), 'image/webp');
    });

    test('campos de texto al lado de la foto (kind, color): van en el mismo multipart', () {
      final form = imageFormData(tinyPng, 'banner.jpg', fields: {'kind': 'banner'});
      expect({for (final f in form.fields) f.key: f.value}, {'kind': 'banner'});
      expect(form.files.single.key, 'file');
      final product = imageFormData(tinyPng, 'rojo.webp', fields: {'color': 'Rojo fuego'});
      expect({for (final f in product.fields) f.key: f.value}, {'color': 'Rojo fuego'});
      // Con campos también se valida el formato y el peso.
      expect(() => imageFormData(tinyPng, 'x.gif', fields: {'kind': 'logo'}), throwsA(isA<ApiException>()));
    });

    test('el tope es 4 MB (el hosting corta los pedidos de más de ~4,5 MB)', () {
      expect(maxUploadImageBytes, 4 * 1024 * 1024);
      expect(photoProblem(fakePhoto('a.jpg')), isNull);
      expect(photoProblem(fakePhoto('a.heic')), 'La foto tiene que ser JPG, PNG o WebP.');
      expect(
        photoProblem(PickedPhoto(bytes: Uint8List(maxUploadImageBytes + 1), filename: 'a.jpg')),
        'La foto pesa más de 4 MB. Probá con una más liviana.',
      );
      expect(photoProblem(PickedPhoto(bytes: Uint8List(maxUploadImageBytes), filename: 'a.png')), isNull);
    });

    test('otro formato o más de 4 MB se rechazan antes de ir a la red', () async {
      expect(
        () => imageFormData(tinyPng, 'foto.heic'),
        throwsA(isA<ApiException>().having((e) => e.message, 'mensaje', contains('JPG, PNG o WebP'))),
      );
      final heavy = Uint8List(maxUploadImageBytes + 1);
      expect(
        () => imageFormData(heavy, 'foto.jpg'),
        throwsA(isA<ApiException>().having((e) => e.message, 'mensaje', contains('4 MB'))),
      );
      // Justo en el tope entra.
      expect(imageFormData(Uint8List(maxUploadImageBytes), 'foto.jpg').files, hasLength(1));
      // Y `uploadImage` lo devuelve como error del Future, sin llamar al servidor.
      await expectLater(
        ApiClient().uploadImage('/admin/arreglos/x/images', bytes: tinyPng, filename: 'foto.bmp'),
        throwsA(isA<ApiException>()),
      );
    });
  });

  group('subir de a una', () {
    test('avisa el avance y cuenta las que fallan sin frenar a las demás', () async {
      final photos = [fakePhoto('a.jpg'), fakePhoto('b.jpg'), fakePhoto('c.jpg')];
      final progress = <String>[];
      final sent = <String>[];
      final failed = await uploadPhotosOneByOne(
        photos,
        (p) async {
          if (p.filename == 'b.jpg') throw ApiException('invalid', 'No.');
          sent.add(p.filename);
        },
        onProgress: (i, n) => progress.add(uploadProgressLabel(i, n)),
      );
      expect(failed, 1);
      expect(sent, ['a.jpg', 'c.jpg']);
      expect(progress, ['Subiendo foto 1 de 3…', 'Subiendo foto 2 de 3…', 'Subiendo foto 3 de 3…']);
    });

    test('el aviso de fotos que no subieron', () {
      expect(uploadFailureNotice(0, 3), isNull);
      expect(uploadFailureNotice(1, 1), contains('No pudimos subir la foto'));
      expect(uploadFailureNotice(1, 3), 'No pudimos subir 1 de las 3 fotos.');
      expect(uploadFailureNotice(2, 3), 'No pudimos subir 2 de las 3 fotos.');
      expect(uploadFailureNotice(3, 3), 'No pudimos subir ninguna de las 3 fotos.');
    });
  });

  group('campo de fotos', () {
    Future<_HostState> pump(
      WidgetTester tester,
      FakePhotoSource source, {
      int max = 6,
      bool enabled = true,
      Phone phone = Phone.small,
      double textScale = 1,
    }) async {
      await pumpPhone(
        tester,
        _Host(max: max, enabled: enabled),
        phone: phone,
        textScale: textScale,
        overrides: [photoSourceProvider.overrideWithValue(source)],
      );
      return tester.state<_HostState>(find.byType(_Host));
    }

    testWidgets('suma de la galería y de la cámara, y quita con la cruz', (tester) async {
      final source = FakePhotoSource(camera: fakePhoto('camara.jpg'));
      final host = await pump(tester, source);
      expect(find.text('Hasta 6 fotos (opcional).'), findsOneWidget);

      await tester.tap(find.text('Sumar fotos'));
      await settle(tester);
      expect(source.galleryCalls, 1);
      expect(host.photos.map((p) => p.filename), ['uno.jpg', 'dos.jpg']);
      expect(find.text('2 de 6 fotos.'), findsOneWidget);

      await tester.tap(find.text('Sacar foto'));
      await settle(tester);
      expect(source.cameraCalls, 1);
      expect(host.photos.map((p) => p.filename), ['uno.jpg', 'dos.jpg', 'camara.jpg']);
      expect(find.byTooltip('Quitar foto'), findsNWidgets(3));

      await tester.tap(find.byTooltip('Quitar foto').at(1));
      await settle(tester);
      expect(host.photos.map((p) => p.filename), ['uno.jpg', 'camara.jpg']);
      expectNoLayoutErrors(tester);
    });

    testWidgets('respeta el tope: lo que sobra queda afuera y los botones se apagan', (tester) async {
      final source = FakePhotoSource(gallery: [for (var i = 0; i < 5; i++) fakePhoto('f$i.jpg')]);
      final host = await pump(tester, source, max: 3);
      await tester.tap(find.text('Sumar fotos'));
      await settle(tester);
      expect(host.photos, hasLength(3));
      expect(find.textContaining('quedaron 2 afuera'), findsOneWidget);
      expect(find.text('Llegaste al tope de 3 fotos.'), findsOneWidget);
      expect(tester.widget<OutlinedButton>(find.widgetWithText(OutlinedButton, 'Sumar fotos')).onPressed, isNull);
      expect(tester.widget<OutlinedButton>(find.widgetWithText(OutlinedButton, 'Sacar foto')).onPressed, isNull);
      await tester.tap(find.text('Sacar foto'), warnIfMissed: false);
      await settle(tester);
      expect(source.cameraCalls, 0);
    });

    testWidgets('no suma formatos que el servidor rechaza ni fotos de más de 4 MB', (tester) async {
      final source = FakePhotoSource(gallery: [
        fakePhoto('bien.jpg'),
        fakePhoto('IMG_1.heic'),
        PickedPhoto(bytes: Uint8List(maxUploadImageBytes + 1), filename: 'pesada.jpg'),
      ]);
      final host = await pump(tester, source);
      await tester.tap(find.text('Sumar fotos'));
      await settle(tester);
      expect(host.photos.map((p) => p.filename), ['bien.jpg']);
      expect(find.textContaining('tiene que ser JPG, PNG o WebP'), findsOneWidget);
      expect(find.textContaining('pesa más de 4 MB'), findsOneWidget);
    });

    testWidgets('cancelar no cambia nada; el permiso negado se explica', (tester) async {
      final source = FakePhotoSource(gallery: const []);
      final host = await pump(tester, source);
      await tester.tap(find.text('Sumar fotos'));
      await settle(tester);
      await tester.tap(find.text('Sacar foto'));
      await settle(tester);
      expect(host.photos, isEmpty);
      expect(find.textContaining('No pudimos'), findsNothing);

      source.failWith = Exception('camera_access_denied');
      await tester.tap(find.text('Sacar foto'));
      await settle(tester);
      expect(find.textContaining('No pudimos abrir la cámara'), findsOneWidget);
      await tester.tap(find.text('Sumar fotos'));
      await settle(tester);
      expect(find.textContaining('No pudimos abrir tus fotos'), findsOneWidget);
      expectNoLayoutErrors(tester);
    });

    testWidgets('deshabilitado (mientras se guarda) no deja sumar ni quitar', (tester) async {
      final source = FakePhotoSource();
      await pump(tester, source, enabled: false);
      await tester.tap(find.text('Sumar fotos'), warnIfMissed: false);
      await settle(tester);
      expect(source.galleryCalls, 0);
    });

    for (final phone in Phone.both) {
      testWidgets('seis fotos con letra 1,3× entran sin desbordar en ${phone.name}', (tester) async {
        final source = FakePhotoSource(gallery: [for (var i = 0; i < 6; i++) fakePhoto('f$i.jpg')]);
        await pump(tester, source, phone: phone, textScale: 1.3);
        await tester.tap(find.text('Sumar fotos'));
        await settle(tester);
        expectNoLayoutErrors(tester);
        expect(find.byTooltip('Quitar foto'), findsNWidgets(6));
        await shoot(tester, 'fotos_campo_lleno');
      });
    }
  });
}
