import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/file_attach.dart';
import '../../../core/widgets/photo_picker.dart';
import '../filamentos/shared_widgets.dart';
import 'consultas_api.dart';
import 'consultas_models.dart';

/// Alta de una consulta (atención al cliente): quién pregunta, qué pide,
/// cuántas, fotos de referencia y audios o archivos (el audio de WhatsApp del
/// cliente, un PDF con el diseño). Primero se crea la consulta y después se
/// suben las fotos y los archivos de a uno (si alguno falla, la consulta no se
/// pierde). Se cierra devolviendo el aviso para mostrar en el listado.
class ConsultaFormScreen extends ConsumerStatefulWidget {
  const ConsultaFormScreen({super.key, required this.maxImages, this.maxFiles = 8});

  /// Topes de fotos y de archivos (los manda el servidor con el listado).
  final int maxImages;
  final int maxFiles;

  @override
  ConsumerState<ConsultaFormScreen> createState() => _ConsultaFormScreenState();
}

class _ConsultaFormScreenState extends ConsumerState<ConsultaFormScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _title = TextEditingController();
  final _quantity = TextEditingController(text: '1');
  final _description = TextEditingController();
  List<PickedPhoto> _photos = const [];
  List<PickedAttachment> _files = const [];

  static const _fixFieldsMessage = 'Revisá los datos marcados en rojo.';

  bool _saving = false;
  bool _submitted = false;

  /// "Subiendo foto 2 de 3…" mientras suben las fotos.
  String? _progress;

  /// Aviso sobre el botón: rechazo del servidor o campos para corregir.
  String? _serverError;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _title.dispose();
    _quantity.dispose();
    _description.dispose();
    super.dispose();
  }

  Map<String, String> get _errors => validateConsultaForm(
        customerName: _name.text,
        customerPhone: _phone.text,
        title: _title.text,
        description: _description.text,
        quantity: _quantity.text,
      );

  bool get _hasUnsaved =>
      _name.text.trim().isNotEmpty ||
      _phone.text.trim().isNotEmpty ||
      _title.text.trim().isNotEmpty ||
      _description.text.trim().isNotEmpty ||
      _quantity.text.trim() != '1' ||
      _photos.isNotEmpty ||
      _files.isNotEmpty;

  Future<void> _confirmLeave() async {
    final leave = await confirmDialog(
      context,
      title: '¿Descartar los cambios?',
      message: 'Lo que cargaste no se guardó.',
      confirmLabel: 'Descartar',
      cancelLabel: 'Seguir editando',
      destructive: true,
    );
    if (leave && mounted) Navigator.of(context).pop();
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() {
      _submitted = true;
      // Si falta algo, se avisa también sobre el botón: el campo marcado en
      // rojo puede haber quedado fuera de la pantalla.
      _serverError = _errors.isEmpty ? null : _fixFieldsMessage;
    });
    if (_errors.isNotEmpty) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() => _saving = true);
    final container = ProviderScope.containerOf(context, listen: false);
    final api = ref.read(consultasApiProvider);
    try {
      final created = await api.create(ConsultaDraft(
        customerName: _name.text,
        customerPhone: _phone.text,
        title: _title.text,
        description: _description.text,
        quantity: int.parse(_quantity.text.trim()),
      ));
      // Desde acá la consulta YA existe: pase lo que pase con las fotos, se
      // cierra el formulario (reintentar "Guardar" la cargaría dos veces).
      final photos = _photos;
      final failed = await uploadPhotosOneByOne(
        photos,
        (p) => api.addImage(created.id, p),
        onProgress: (i, n) {
          if (mounted) setState(() => _progress = uploadProgressLabel(i, n));
        },
      );
      // Después de las fotos, los audios y archivos.
      final files = _files;
      final failedFiles = await uploadOneByOne<PickedAttachment>(
        files,
        (f) => api.addFile(created.id, f),
        onProgress: (i, n) {
          if (mounted) setState(() => _progress = 'Subiendo archivo $i de $n…');
        },
      );
      invalidateConsultas(container);
      final notice = [
        'Consulta cargada.',
        ?uploadFailureNotice(failed, photos.length),
        ?attachmentFailureNotice(failedFiles, files.length),
      ];
      if (mounted) popIfCurrent(context, notice.length == 1 ? 'Consulta cargada' : notice.join(' '));
    } on ApiException catch (e) {
      if (mounted) setState(() => _serverError = e.message);
    } catch (_) {
      if (mounted) setState(() => _serverError = 'No pudimos guardar. Probá de nuevo.');
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
          _progress = null;
        });
      }
    }
  }

  void _touched(String _) => setState(() => _serverError = null);

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final errors = _submitted ? _errors : const <String, String>{};

    final scaffold = Scaffold(
      appBar: AppBar(title: const Text('Nueva consulta')),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  TextField(
                    controller: _name,
                    enabled: !_saving,
                    textCapitalization: TextCapitalization.words,
                    textInputAction: TextInputAction.next,
                    inputFormatters: [LengthLimitingTextInputFormatter(120)],
                    onChanged: _touched,
                    decoration: InputDecoration(
                      labelText: 'Nombre del cliente',
                      errorText: errors['customerName'],
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _phone,
                    enabled: !_saving,
                    keyboardType: TextInputType.phone,
                    textInputAction: TextInputAction.next,
                    inputFormatters: [LengthLimitingTextInputFormatter(40)],
                    onChanged: _touched,
                    decoration: InputDecoration(
                      labelText: 'WhatsApp (opcional)',
                      hintText: 'Ej: 11 2345 6789',
                      helperText: 'Para mandarle la respuesta con un toque.',
                      errorText: errors['customerPhone'],
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _title,
                    enabled: !_saving,
                    textCapitalization: TextCapitalization.sentences,
                    textInputAction: TextInputAction.next,
                    inputFormatters: [LengthLimitingTextInputFormatter(160)],
                    onChanged: _touched,
                    decoration: InputDecoration(
                      labelText: 'Qué pide',
                      hintText: 'Ej: Llavero con el logo del club',
                      errorText: errors['title'],
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _quantity,
                    enabled: !_saving,
                    keyboardType: TextInputType.number,
                    textInputAction: TextInputAction.next,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(4),
                    ],
                    onChanged: _touched,
                    decoration: InputDecoration(
                      labelText: 'Cantidad',
                      errorText: errors['quantity'],
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _description,
                    enabled: !_saving,
                    minLines: 3,
                    maxLines: 8,
                    maxLength: 4000,
                    textCapitalization: TextCapitalization.sentences,
                    onChanged: _touched,
                    decoration: InputDecoration(
                      labelText: 'Detalles (opcional)',
                      hintText: 'Tamaño, colores, para cuándo lo necesita…',
                      alignLabelWithHint: true,
                      errorText: errors['description'],
                    ),
                  ),
                  const SizedBox(height: 10),
                  const SectionLabel('Fotos de referencia'),
                  const SizedBox(height: 4),
                  Text(
                    'Lo que mandó el cliente: un dibujo, una foto, una captura.',
                    style: TextStyle(fontSize: 12.5, color: c.textDim, height: 1.4),
                  ),
                  const SizedBox(height: 10),
                  PhotoPickerField(
                    photos: _photos,
                    max: widget.maxImages,
                    enabled: !_saving,
                    onChanged: (v) => setState(() => _photos = v),
                  ),
                  const SizedBox(height: 18),
                  const SectionLabel('Audios y archivos'),
                  const SizedBox(height: 4),
                  Text(
                    'El audio que mandó el cliente, un video corto o un PDF con el diseño.',
                    style: TextStyle(fontSize: 12.5, color: c.textDim, height: 1.4),
                  ),
                  const SizedBox(height: 10),
                  AttachmentPickerField(
                    files: _files,
                    max: widget.maxFiles,
                    enabled: !_saving,
                    onChanged: (v) => setState(() => _files = v),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Avisos pegados al botón (fijo): al final de la lista, con
                  // el teclado abierto, quedaban fuera de la pantalla.
                  if (_serverError != null) ...[
                    InlineError(_serverError!),
                    const SizedBox(height: 10),
                  ],
                  if (_progress != null) ...[
                    Text(
                      _progress!,
                      style: TextStyle(fontSize: 13, color: c.textDim, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                  ],
                  GoldButton(
                    label: 'Cargar consulta',
                    icon: Icons.check_rounded,
                    loading: _saving,
                    onPressed: _saving ? null : _save,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
    // "Atrás" con datos sin guardar pregunta antes de perderlos. Mientras se
    // guarda (y suben las fotos y los archivos) no se sale: se cortaría la subida a la mitad.
    return PopScope(
      canPop: !_saving && !_hasUnsaved,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && !_saving) _confirmLeave();
      },
      child: scaffold,
    );
  }
}
