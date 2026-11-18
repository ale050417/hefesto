// Fotos de mentira para los tests: una fuente que devuelve bytes fijos en vez
// de abrir la galería o la cámara del teléfono (ver `photoSourceProvider`).

import 'dart:convert';
import 'dart:typed_data';

import 'package:hefesto/core/widgets/common.dart' show debugDisableNetworkImages;
import 'package:hefesto/core/widgets/file_attach.dart';
import 'package:hefesto/core/widgets/photo_picker.dart';

/// Un PNG válido de 1×1 (para que `Image.memory` no falle al decodificar).
final Uint8List tinyPng = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
);

PickedPhoto fakePhoto(String name) => PickedPhoto(bytes: tinyPng, filename: name);

/// Fuente de fotos configurable: qué devuelve la galería, qué la cámara, o con
/// qué error fallan (permiso negado).
class FakePhotoSource implements PhotoSource {
  FakePhotoSource({List<PickedPhoto>? gallery, this.camera, this.failWith})
      : gallery = gallery ?? [fakePhoto('uno.jpg'), fakePhoto('dos.jpg')];

  List<PickedPhoto> gallery;
  PickedPhoto? camera;
  Object? failWith;
  int galleryCalls = 0;
  int cameraCalls = 0;

  @override
  Future<List<PickedPhoto>> fromGallery() async {
    galleryCalls++;
    if (failWith != null) throw failWith!;
    return gallery;
  }

  @override
  Future<PickedPhoto?> fromCamera() async {
    cameraCalls++;
    if (failWith != null) throw failWith!;
    return camera;
  }

  /// Una sola de la galería: la primera de [gallery] (null = se canceló).
  @override
  Future<PickedPhoto?> oneFromGallery() async {
    galleryCalls++;
    if (failWith != null) throw failWith!;
    return gallery.isEmpty ? null : gallery.first;
  }
}

/// Para el `setUpAll` de los tests que dibujan fotos con dirección real
/// (`https://…`): apaga las fotos de red (ver `debugDisableNetworkImages`), así
/// se ve el recuadro de "sin foto" y las capturas (SHOT_DIR) no dependen del
/// caché en disco, que en los tests no existe.
void mockImageCachePlugins() {
  debugDisableNetworkImages = true;
}

/// Un adjunto de mentira (audio, video o PDF según la extensión del nombre).
PickedAttachment fakeFile(String name, {int size = 2048}) =>
    PickedAttachment(bytes: Uint8List(size), filename: name, contentType: attachmentTypeOf(name) ?? '');

/// Selector de archivos configurable: qué devuelve, o con qué error falla.
class FakeAttachmentSource implements AttachmentSource {
  FakeAttachmentSource([List<PickedAttachment>? files])
      : files = files ?? [fakeFile('audio del cliente.ogg'), fakeFile('diseño.pdf')];

  List<PickedAttachment> files;
  Object? failWith;
  int calls = 0;

  @override
  Future<List<PickedAttachment>> pick() async {
    calls++;
    if (failWith != null) throw failWith!;
    return files;
  }
}
