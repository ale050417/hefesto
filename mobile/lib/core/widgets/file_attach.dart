// Adjuntos que no son fotos (audios, videos cortos, PDF) para las consultas:
// de dónde salen ([AttachmentSource]), qué se acepta y el campo de formulario
// que los lista ([AttachmentPickerField]).

import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../theme/app_theme.dart';

/// Tope de un adjunto (el mismo del servidor: el hosting corta los pedidos de
/// más de 4,5 MB, así que no tiene sentido mandar algo más pesado).
const maxAttachmentBytes = 4 * 1024 * 1024;

/// Extensiones que se ofrecen al elegir, con su tipo de contenido. El servidor
/// acepta `audio/*`, `video/*` y `application/pdf`.
const attachmentTypes = <String, String>{
  // Audios (los de WhatsApp son .opus / .ogg; los del iPhone, .m4a).
  'mp3': 'audio/mpeg',
  'm4a': 'audio/mp4',
  'aac': 'audio/aac',
  'ogg': 'audio/ogg',
  'opus': 'audio/ogg',
  'oga': 'audio/ogg',
  'wav': 'audio/wav',
  'amr': 'audio/amr',
  // Videos cortos.
  'mp4': 'video/mp4',
  'mov': 'video/quicktime',
  'webm': 'video/webm',
  '3gp': 'video/3gpp',
  // Documentos.
  'pdf': 'application/pdf',
};

/// Tipo de contenido de un archivo según su extensión; null si no es audio,
/// video ni PDF.
String? attachmentTypeOf(String filename) {
  final dot = filename.lastIndexOf('.');
  if (dot < 0) return null;
  return attachmentTypes[filename.substring(dot + 1).toLowerCase()];
}

/// Ícono según el tipo de contenido (sirve para lo elegido y para lo subido).
IconData attachmentIcon(String contentType) {
  if (contentType.startsWith('audio/')) return Icons.audiotrack_rounded;
  if (contentType.startsWith('video/')) return Icons.videocam_rounded;
  if (contentType == 'application/pdf') return Icons.picture_as_pdf_rounded;
  return Icons.insert_drive_file_outlined;
}

/// "850 KB" · "2,4 MB".
String formatFileSize(int bytes) {
  if (bytes < 1024 * 1024) {
    final kb = (bytes / 1024).ceil();
    return '${kb < 1 ? 1 : kb} KB';
  }
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1).replaceAll('.', ',')} MB';
}

/// Un archivo elegido, ya leído: listo para subir.
class PickedAttachment {
  const PickedAttachment({required this.bytes, required this.filename, required this.contentType});
  final Uint8List bytes;
  final String filename;

  /// "audio/mpeg", "application/pdf"… Vacío si la extensión no es de las
  /// aceptadas (el campo lo descarta con un aviso).
  final String contentType;
}

/// De dónde salen los archivos. En la app es el selector del teléfono
/// ([DeviceAttachmentSource]); los tests ponen uno de mentira con
/// [attachmentSourceProvider].
abstract class AttachmentSource {
  /// Uno o varios archivos (vacío si se canceló).
  Future<List<PickedAttachment>> pick();
}

/// Selector de archivos del sistema, limitado a audio, video y PDF. Es el
/// selector de documentos (no la galería ni la música): no pide permisos.
class DeviceAttachmentSource implements AttachmentSource {
  @override
  Future<List<PickedAttachment>> pick() async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: attachmentTypes.keys.toList(),
      allowMultiple: true,
      withData: true,
    );
    if (result == null) return const [];
    return [
      for (final f in result.files)
        if (f.bytes != null)
          PickedAttachment(
            bytes: f.bytes!,
            filename: f.name,
            contentType: attachmentTypeOf(f.name) ?? '',
          ),
    ];
  }
}

final attachmentSourceProvider = Provider<AttachmentSource>((ref) => DeviceAttachmentSource());

/// Separa lo elegido en lo que se puede subir y un aviso por lo que no (otro
/// tipo de archivo, más de 4 MB, o más de los [room] lugares que quedan).
({List<PickedAttachment> ok, String? notice}) filterAttachments(
  List<PickedAttachment> picked, {
  required int room,
  required int max,
}) {
  final ok = <PickedAttachment>[];
  var badType = 0;
  var tooBig = 0;
  for (final f in picked) {
    if (f.contentType.isEmpty) {
      badType++;
    } else if (f.bytes.length > maxAttachmentBytes) {
      tooBig++;
    } else {
      ok.add(f);
    }
  }
  final extra = ok.length > room ? ok.length - room : 0;
  final notes = <String>[
    if (extra > 0) 'Entran hasta $max archivos: ${extra == 1 ? 'quedó 1 afuera' : 'quedaron $extra afuera'}.',
    if (badType > 0)
      '${badType == 1 ? 'Un archivo no se sumó' : '$badType archivos no se sumaron'}: '
          'se pueden adjuntar audios, videos o PDF.',
    if (tooBig > 0)
      '${tooBig == 1 ? 'Un archivo no se sumó: pesa' : '$tooBig archivos no se sumaron: pesan'} más de 4 MB.',
  ];
  return (ok: ok.take(room < 0 ? 0 : room).toList(), notice: notes.isEmpty ? null : notes.join(' '));
}

/// Qué decirle al usuario cuando [failed] archivos de [total] no subieron
/// (null si subieron todos).
String? attachmentFailureNotice(int failed, int total) {
  if (failed <= 0) return null;
  if (total == 1) return 'No pudimos subir el archivo.';
  if (failed == total) return 'No pudimos subir ninguno de los $total archivos.';
  return failed == 1
      ? 'No pudimos subir 1 de los $total archivos.'
      : 'No pudimos subir $failed de los $total archivos.';
}

/// Campo de adjuntos de un formulario: el botón "Sumar audio o archivo" y la
/// lista de lo elegido, cada uno con su cruz. No guarda nada: avisa la lista
/// nueva por [onChanged] y el formulario los sube al guardar.
class AttachmentPickerField extends ConsumerStatefulWidget {
  const AttachmentPickerField({
    super.key,
    required this.files,
    required this.onChanged,
    required this.max,
    this.enabled = true,
  });

  final List<PickedAttachment> files;
  final ValueChanged<List<PickedAttachment>> onChanged;

  /// Tope de archivos (lo manda el servidor: `maxFiles`).
  final int max;
  final bool enabled;

  @override
  ConsumerState<AttachmentPickerField> createState() => _AttachmentPickerFieldState();
}

class _AttachmentPickerFieldState extends ConsumerState<AttachmentPickerField> {
  bool _busy = false;
  String? _notice;

  int get _room => widget.max - widget.files.length;

  Future<void> _pick() async {
    if (_busy || !widget.enabled || _room <= 0) return;
    setState(() {
      _busy = true;
      _notice = null;
    });
    try {
      final picked = await ref.read(attachmentSourceProvider).pick();
      if (!mounted || picked.isEmpty) return;
      final res = filterAttachments(picked, room: _room, max: widget.max);
      setState(() => _notice = res.notice);
      if (res.ok.isNotEmpty) widget.onChanged([...widget.files, ...res.ok]);
    } catch (_) {
      if (mounted) setState(() => _notice = 'No pudimos abrir tus archivos. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _remove(int index) {
    if (!widget.enabled) return;
    setState(() => _notice = null);
    widget.onChanged([...widget.files]..removeAt(index));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final files = widget.files;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        OutlinedButton.icon(
          onPressed: widget.enabled && !_busy && _room > 0 ? _pick : null,
          icon: const Icon(Icons.attach_file_rounded, size: 18),
          label: const Text('Sumar audio o archivo'),
        ),
        const SizedBox(height: 6),
        Text(
          files.isEmpty
              ? 'Audios, videos cortos o PDF, hasta 4 MB cada uno (opcional).'
              : _room > 0
                  ? '${files.length} de ${widget.max} archivos.'
                  : 'Llegaste al tope de ${widget.max} archivos.',
          style: TextStyle(fontSize: 12, color: c.textDim),
        ),
        if (_notice != null) ...[
          const SizedBox(height: 6),
          Text(_notice!, style: const TextStyle(fontSize: 12.5, color: Brand.warning, height: 1.3)),
        ],
        for (var i = 0; i < files.length; i++) ...[
          const SizedBox(height: 8),
          AttachmentRow(
            key: ObjectKey(files[i]),
            icon: attachmentIcon(files[i].contentType),
            name: files[i].filename,
            detail: formatFileSize(files[i].bytes.length),
            trailing: IconButton(
              tooltip: 'Quitar archivo',
              icon: const Icon(Icons.close_rounded, size: 20),
              onPressed: widget.enabled ? () => _remove(i) : null,
            ),
          ),
        ],
      ],
    );
  }
}

/// Renglón de un adjunto: ícono del tipo, nombre (cortado si es largo) y algo
/// a la derecha (quitar, abrir). Con [onTap] se puede tocar entero.
class AttachmentRow extends StatelessWidget {
  const AttachmentRow({
    super.key,
    required this.icon,
    required this.name,
    this.detail,
    this.trailing,
    this.onTap,
  });
  final IconData icon;
  final String name;
  final String? detail;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final radius = BorderRadius.circular(12);
    return Material(
      color: c.surface2,
      borderRadius: radius,
      child: InkWell(
        borderRadius: radius,
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 48),
          // Sin margen vertical: el botón de la derecha conserva sus 48 dp.
          padding: EdgeInsets.only(left: 12, right: trailing == null ? 12 : 2),
          decoration: BoxDecoration(borderRadius: radius, border: Border.all(color: c.border)),
          child: Row(
            children: [
              Icon(icon, size: 20, color: Brand.gold),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.text),
                    ),
                    if (detail != null)
                      Text(detail!, style: TextStyle(fontSize: 11.5, color: c.textFaint)),
                  ],
                ),
              ),
              ?trailing,
            ],
          ),
        ),
      ),
    );
  }
}
