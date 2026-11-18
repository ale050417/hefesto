import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/photo_picker.dart';
import '../crecimiento/form_kit.dart' show SwitchRow;
import '../filamentos/shared_widgets.dart';
import 'arreglos_api.dart';
import 'arreglos_models.dart';

/// Alta de un arreglo: título, qué pasa, si es urgente y fotos. Primero se
/// crea el arreglo y después se suben las fotos de a una (así, si una foto
/// falla, el arreglo no se pierde). Se cierra devolviendo el aviso para
/// mostrar en el listado.
class ArregloFormScreen extends ConsumerStatefulWidget {
  const ArregloFormScreen({super.key, required this.maxImages});

  /// Tope de fotos (lo manda el servidor con el listado).
  final int maxImages;

  @override
  ConsumerState<ArregloFormScreen> createState() => _ArregloFormScreenState();
}

class _ArregloFormScreenState extends ConsumerState<ArregloFormScreen> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  bool _urgent = false;
  List<PickedPhoto> _photos = const [];

  static const _fixFieldsMessage = 'Revisá los datos marcados en rojo.';

  bool _saving = false;
  bool _submitted = false;

  /// "Subiendo foto 2 de 3…" mientras suben las fotos.
  String? _progress;

  /// Aviso sobre el botón: rechazo del servidor o campos para corregir.
  String? _serverError;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  Map<String, String> get _errors =>
      validateArregloForm(title: _title.text, description: _description.text);

  bool get _hasUnsaved =>
      _title.text.trim().isNotEmpty || _description.text.trim().isNotEmpty || _urgent || _photos.isNotEmpty;

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
    final api = ref.read(arreglosApiProvider);
    try {
      final created = await api.create(
        ArregloDraft(title: _title.text, description: _description.text, urgent: _urgent),
      );
      // Desde acá el arreglo YA existe: pase lo que pase con las fotos, se
      // cierra el formulario (reintentar "Guardar" lo cargaría dos veces).
      final photos = _photos;
      final failed = await uploadPhotosOneByOne(
        photos,
        (p) => api.addImage(created.id, p),
        onProgress: (i, n) {
          if (mounted) setState(() => _progress = uploadProgressLabel(i, n));
        },
      );
      invalidateArreglos(container);
      final notice = uploadFailureNotice(failed, photos.length);
      if (mounted) {
        popIfCurrent(context, notice == null ? 'Arreglo cargado' : 'Arreglo cargado. $notice');
      }
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

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final errors = _submitted ? _errors : const <String, String>{};

    final scaffold = Scaffold(
      appBar: AppBar(title: const Text('Nuevo arreglo')),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  TextField(
                    controller: _title,
                    enabled: !_saving,
                    maxLength: 120,
                    textCapitalization: TextCapitalization.sentences,
                    textInputAction: TextInputAction.next,
                    onChanged: (_) => setState(() => _serverError = null),
                    decoration: InputDecoration(
                      labelText: 'Qué hay que arreglar',
                      hintText: 'Ej: El buscador no encuentra por color',
                      errorText: errors['title'],
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _description,
                    enabled: !_saving,
                    minLines: 4,
                    maxLines: 8,
                    maxLength: 4000,
                    textCapitalization: TextCapitalization.sentences,
                    onChanged: (_) => setState(() => _serverError = null),
                    decoration: InputDecoration(
                      labelText: 'Qué pasa y qué habría que cambiar',
                      alignLabelWithHint: true,
                      errorText: errors['description'],
                    ),
                  ),
                  const SizedBox(height: 10),
                  SwitchRow(
                    title: 'Es urgente',
                    subtitle: 'Marcalo si no se puede trabajar hasta que se arregle.',
                    value: _urgent,
                    onChanged: (v) {
                      if (!_saving) setState(() => _urgent = v);
                    },
                  ),
                  const SizedBox(height: 18),
                  const SectionLabel('Fotos'),
                  const SizedBox(height: 4),
                  Text(
                    'Una captura o una foto ayuda a entender qué pasa.',
                    style: TextStyle(fontSize: 12.5, color: c.textDim, height: 1.4),
                  ),
                  const SizedBox(height: 10),
                  PhotoPickerField(
                    photos: _photos,
                    max: widget.maxImages,
                    enabled: !_saving,
                    onChanged: (v) => setState(() => _photos = v),
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
                    label: 'Cargar arreglo',
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
    // guarda (y suben las fotos) no se sale: se cortaría la subida a la mitad.
    return PopScope(
      canPop: !_saving && !_hasUnsaved,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && !_saving) _confirmLeave();
      },
      child: scaffold,
    );
  }
}
