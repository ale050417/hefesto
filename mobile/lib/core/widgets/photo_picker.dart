// Fotos del teléfono para adjuntar (arreglos y consultas del taller): de dónde
// salen ([PhotoSource]), el campo de formulario que las muestra
// ([PhotoPickerField]) y la subida de a una ([uploadPhotosOneByOne]).

import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../api/api_client.dart' show imageSubtypeOf, maxUploadImageBytes;
import '../theme/app_theme.dart';

/// Una foto elegida, ya leída: lista para mostrar y para subir.
class PickedPhoto {
  const PickedPhoto({required this.bytes, required this.filename});
  final Uint8List bytes;
  final String filename;
}

/// De dónde salen las fotos. En la app es el teléfono ([DevicePhotoSource]);
/// los tests ponen una fuente de mentira con [photoSourceProvider] para no
/// depender de la cámara ni de la galería.
abstract class PhotoSource {
  /// Varias fotos de la galería (vacío si se canceló).
  Future<List<PickedPhoto>> fromGallery();

  /// Una foto sacada en el momento (null si se canceló).
  Future<PickedPhoto?> fromCamera();
}

/// Galería y cámara del teléfono. Las fotos se achican a 1600 px de ancho y se
/// comprimen (calidad 80): salen en JPG y livianas, así suben rápido con datos
/// móviles y entran en el tope de 8 MB del servidor.
class DevicePhotoSource implements PhotoSource {
  DevicePhotoSource([ImagePicker? picker]) : _picker = picker ?? ImagePicker();
  final ImagePicker _picker;

  static const _quality = 80;
  static const double _maxWidth = 1600;

  @override
  Future<List<PickedPhoto>> fromGallery() async {
    final files = await _picker.pickMultiImage(imageQuality: _quality, maxWidth: _maxWidth);
    return [for (final f in files) await _read(f)];
  }

  @override
  Future<PickedPhoto?> fromCamera() async {
    final f = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: _quality,
      maxWidth: _maxWidth,
    );
    return f == null ? null : _read(f);
  }

  Future<PickedPhoto> _read(XFile f) async =>
      PickedPhoto(bytes: await f.readAsBytes(), filename: f.name);
}

final photoSourceProvider = Provider<PhotoSource>((ref) => DevicePhotoSource());

/// Sube [photos] de a una, en orden, con [upload]. Antes de cada una avisa por
/// [onProgress] cuál va (1, 2, 3…). Si una falla sigue con las demás: devuelve
/// cuántas NO se pudieron subir (0 = todas bien).
Future<int> uploadPhotosOneByOne(
  List<PickedPhoto> photos,
  Future<void> Function(PickedPhoto photo) upload, {
  void Function(int current, int total)? onProgress,
}) =>
    uploadOneByOne<PickedPhoto>(photos, upload, onProgress: onProgress);

/// Lo mismo para cualquier cosa que se suba de a una (fotos, audios, PDF).
/// [onError] recibe el error de cada una que falla (para mostrar el motivo
/// cuando es una sola).
Future<int> uploadOneByOne<T>(
  List<T> items,
  Future<void> Function(T item) upload, {
  void Function(int current, int total)? onProgress,
  void Function(Object error)? onError,
}) async {
  var failed = 0;
  for (var i = 0; i < items.length; i++) {
    onProgress?.call(i + 1, items.length);
    try {
      await upload(items[i]);
    } catch (e) {
      failed++;
      onError?.call(e);
    }
  }
  return failed;
}

/// Separa las fotos elegidas en las que se pueden subir y un aviso por las
/// que no: lo que el servidor igual rechazaría (otro formato, más de 8 MB) y
/// lo que pasa de los [room] lugares que quedan. Se filtra al elegir, para
/// avisar antes de guardar y no después de haber creado el registro.
({List<PickedPhoto> ok, String? notice}) filterPhotos(
  List<PickedPhoto> picked, {
  required int room,
  required int max,
}) {
  final ok = <PickedPhoto>[];
  var badFormat = 0;
  var tooBig = 0;
  for (final p in picked) {
    if (imageSubtypeOf(p.filename) == null) {
      badFormat++;
    } else if (p.bytes.length > maxUploadImageBytes) {
      tooBig++;
    } else {
      ok.add(p);
    }
  }
  final extra = ok.length > room ? ok.length - room : 0;
  final notes = <String>[
    if (extra > 0) 'Entran hasta $max fotos: ${extra == 1 ? 'quedó 1 afuera' : 'quedaron $extra afuera'}.',
    if (badFormat > 0)
      '${badFormat == 1 ? 'Una foto no se sumó: tiene' : '$badFormat fotos no se sumaron: tienen'} '
          'que ser JPG, PNG o WebP.',
    if (tooBig > 0)
      '${tooBig == 1 ? 'Una foto no se sumó: pesa' : '$tooBig fotos no se sumaron: pesan'} más de 8 MB.',
  ];
  return (ok: ok.take(room < 0 ? 0 : room).toList(), notice: notes.isEmpty ? null : notes.join(' '));
}

/// "Subiendo foto 2 de 3…"
String uploadProgressLabel(int current, int total) => 'Subiendo foto $current de $total…';

/// Qué decirle al usuario cuando el registro se guardó pero [failed] fotos de
/// [total] no subieron (null si subieron todas).
String? uploadFailureNotice(int failed, int total) {
  if (failed <= 0) return null;
  if (total == 1) return 'No pudimos subir la foto. Probá cargarla de nuevo más tarde.';
  if (failed == total) return 'No pudimos subir ninguna de las $total fotos.';
  return failed == 1
      ? 'No pudimos subir 1 de las $total fotos.'
      : 'No pudimos subir $failed de las $total fotos.';
}

/// Campo de fotos de un formulario: los botones "Sumar fotos" y "Sacar foto" y
/// las miniaturas de lo elegido, cada una con su cruz para quitarla. No guarda
/// nada: avisa la lista nueva por [onChanged] y el formulario las sube al
/// guardar.
class PhotoPickerField extends ConsumerStatefulWidget {
  const PhotoPickerField({
    super.key,
    required this.photos,
    required this.onChanged,
    required this.max,
    this.enabled = true,
  });

  final List<PickedPhoto> photos;
  final ValueChanged<List<PickedPhoto>> onChanged;

  /// Tope de fotos (lo manda el servidor: `maxImages`).
  final int max;

  /// En falso (mientras se guarda) no se puede sumar ni quitar.
  final bool enabled;

  @override
  ConsumerState<PhotoPickerField> createState() => _PhotoPickerFieldState();
}

class _PhotoPickerFieldState extends ConsumerState<PhotoPickerField> {
  bool _busy = false;

  /// Aviso debajo de los botones (fotos que quedaron afuera, permiso negado).
  String? _notice;

  int get _room => widget.max - widget.photos.length;

  Future<void> _pick({required bool camera}) async {
    if (_busy || !widget.enabled || _room <= 0) return;
    setState(() {
      _busy = true;
      _notice = null;
    });
    try {
      final source = ref.read(photoSourceProvider);
      final List<PickedPhoto> picked;
      if (camera) {
        final one = await source.fromCamera();
        picked = [?one];
      } else {
        picked = await source.fromGallery();
      }
      if (!mounted || picked.isEmpty) return;

      final res = filterPhotos(picked, room: _room, max: widget.max);
      setState(() => _notice = res.notice);
      if (res.ok.isNotEmpty) widget.onChanged([...widget.photos, ...res.ok]);
    } catch (_) {
      // Lo más común: el permiso de cámara o de fotos negado en el teléfono.
      if (mounted) {
        setState(() => _notice = camera
            ? 'No pudimos abrir la cámara. Revisá el permiso en los ajustes del teléfono.'
            : 'No pudimos abrir tus fotos. Revisá el permiso en los ajustes del teléfono.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _remove(int index) {
    if (!widget.enabled) return;
    setState(() => _notice = null);
    widget.onChanged([...widget.photos]..removeAt(index));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final photos = widget.photos;
    final canAdd = widget.enabled && !_busy && _room > 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Wrap y no Row: con letra grande en un teléfono angosto los dos
        // botones no entran lado a lado y el segundo baja de renglón.
        Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            OutlinedButton.icon(
              onPressed: canAdd ? () => _pick(camera: false) : null,
              icon: const Icon(Icons.photo_library_outlined, size: 18),
              label: const Text('Sumar fotos'),
            ),
            OutlinedButton.icon(
              onPressed: canAdd ? () => _pick(camera: true) : null,
              icon: const Icon(Icons.photo_camera_outlined, size: 18),
              label: const Text('Sacar foto'),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          photos.isEmpty
              ? 'Hasta ${widget.max} fotos (opcional).'
              : _room > 0
                  ? '${photos.length} de ${widget.max} fotos.'
                  : 'Llegaste al tope de ${widget.max} fotos.',
          style: TextStyle(fontSize: 12, color: c.textDim),
        ),
        if (_notice != null) ...[
          const SizedBox(height: 6),
          Text(
            _notice!,
            style: const TextStyle(fontSize: 12.5, color: Brand.warning, height: 1.3),
          ),
        ],
        if (photos.isNotEmpty) ...[
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (var i = 0; i < photos.length; i++)
                _Thumb(
                  // Por objeto: al quitar una, las demás no se vuelven a decodificar.
                  key: ObjectKey(photos[i]),
                  photo: photos[i],
                  onRemove: widget.enabled ? () => _remove(i) : null,
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _Thumb extends StatelessWidget {
  const _Thumb({super.key, required this.photo, required this.onRemove});
  final PickedPhoto photo;
  final VoidCallback? onRemove;

  static const double _side = 92;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final broken = Container(
      color: c.surface2,
      alignment: Alignment.center,
      child: Icon(Icons.image_outlined, color: c.textFaint),
    );
    return SizedBox.square(
      dimension: _side,
      child: Stack(
        fit: StackFit.expand,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: DecoratedBox(
              decoration: BoxDecoration(color: c.surface2),
              child: Image.memory(
                photo.bytes,
                fit: BoxFit.cover,
                // La miniatura no necesita los 1600 px de la foto.
                cacheWidth: 276,
                gaplessPlayback: true,
                errorBuilder: (_, _, _) => broken,
              ),
            ),
          ),
          if (onRemove != null)
            Positioned(
              top: 0,
              right: 0,
              // Zona táctil de 40 dp aunque la cruz se vea chica.
              child: Tooltip(
                message: 'Quitar foto',
                child: InkResponse(
                  onTap: onRemove,
                  radius: 22,
                  child: SizedBox.square(
                    dimension: 40,
                    child: Align(
                      alignment: const Alignment(0.5, -0.5),
                      child: Container(
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          color: c.bg.withValues(alpha: 0.82),
                          shape: BoxShape.circle,
                          border: Border.all(color: c.border),
                        ),
                        child: Icon(Icons.close_rounded, size: 15, color: c.text),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
