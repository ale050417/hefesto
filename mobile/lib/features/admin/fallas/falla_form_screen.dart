import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import '../admin_widgets.dart';
import '../filamentos/filamentos_format.dart';
import '../filamentos/shared_widgets.dart';
import 'fallas_api.dart';
import 'fallas_models.dart';

/// Una línea del formulario de alta: qué carrete (id) y cuántos gramos (texto).
class FallaLineInput {
  FallaLineInput({this.filamentId = '', String grams = ''}) : grams = TextEditingController(text: grams);
  String filamentId;
  final TextEditingController grams;
  void dispose() => grams.dispose();
}

/// Validación del formulario de una falla (mismas reglas que `failureSchema` del
/// servidor, que igual vuelve a validar). Mapa campo → mensaje; vacío = válido.
/// Pura, para probarla sin dibujar nada.
///
/// Alta: [lines] = (carrete, gramos tipeados). Edición: [grams] y [material]/[color].
Map<String, String> validateFallaForm({
  required String pieceName,
  required bool isEdit,
  List<({String filamentId, String grams})> lines = const [],
  String grams = '',
  String material = '',
  String color = '',
  String notes = '',
}) {
  final errors = <String, String>{};
  if (pieceName.trim().isEmpty) errors['pieceName'] = 'Ingresá la pieza o producto.';
  if (notes.trim().length > 500) errors['notes'] = 'Las notas pueden tener hasta 500 letras.';
  if (isEdit) {
    if (material.trim().isEmpty) errors['material'] = 'Ingresá el material.';
    if (color.trim().isEmpty) errors['color'] = 'Ingresá el color.';
    final g = parseNumber(grams);
    if (g == null || g <= 0) errors['grams'] = 'Ingresá los gramos perdidos.';
  } else {
    final valid = lines.where((l) {
      final g = parseNumber(l.grams);
      return l.filamentId.isNotEmpty && g != null && g > 0;
    });
    if (valid.isEmpty) errors['lines'] = 'Elegí al menos un carrete y los gramos perdidos.';
  }
  return errors;
}

/// Alta o corrección de una falla. Se cierra devolviendo el [FallaResult] (alta)
/// o `true` (corrección).
class FallaFormScreen extends ConsumerStatefulWidget {
  const FallaFormScreen({super.key, required this.data, this.falla});
  final FallasData data;

  /// Con falla edita; sin ella, registra una nueva.
  final Falla? falla;

  @override
  ConsumerState<FallaFormScreen> createState() => _FallaFormScreenState();
}

class _FallaFormScreenState extends ConsumerState<FallaFormScreen> {
  late final TextEditingController _piece;
  late final TextEditingController _notes;
  late final TextEditingController _grams;
  late final TextEditingController _material;
  late final TextEditingController _color;
  late String _reason;
  final List<FallaLineInput> _lines = [FallaLineInput()];
  // Las líneas quitadas se descartan recién al cerrar la pantalla: su TextField
  // todavía está montado cuando se hace el setState.
  final List<FallaLineInput> _removed = [];

  static const _fixFieldsMessage = 'Revisá los datos marcados en rojo.';

  bool _saving = false;
  bool _submitted = false;

  /// Aviso sobre el botón de guardar: el rechazo del servidor o, si no pasó la
  /// validación, que hay campos para corregir.
  String? _serverError;

  bool get _isEdit => widget.falla != null;

  @override
  void initState() {
    super.initState();
    final f = widget.falla;
    _piece = TextEditingController(text: f?.pieceName ?? '');
    _notes = TextEditingController(text: f?.notes ?? '');
    _grams = TextEditingController(text: f == null ? '' : gramsField(f.gramsLost));
    _material = TextEditingController(text: f?.material ?? '');
    _color = TextEditingController(text: f?.color ?? '');
    _reason = f?.reason ?? widget.data.reasons.first;
  }

  @override
  void dispose() {
    _piece.dispose();
    _notes.dispose();
    _grams.dispose();
    _material.dispose();
    _color.dispose();
    for (final l in [..._lines, ..._removed]) {
      l.dispose();
    }
    super.dispose();
  }

  List<({String filamentId, String grams})> get _lineValues =>
      [for (final l in _lines) (filamentId: l.filamentId, grams: l.grams.text)];

  Map<String, String> get _errors => validateFallaForm(
        pieceName: _piece.text,
        isEdit: _isEdit,
        lines: _lineValues,
        grams: _grams.text,
        material: _material.text,
        color: _color.text,
        notes: _notes.text,
      );

  bool get _dirty {
    final f = widget.falla;
    if (f == null) return true;
    return _piece.text.trim() != f.pieceName ||
        _material.text.trim() != f.material ||
        _color.text.trim() != f.color ||
        parseNumber(_grams.text) != f.gramsLost ||
        _reason != f.reason ||
        _notes.text.trim() != (f.notes ?? '');
  }

  double get _totalGrams => _lines.fold(0.0, (a, l) => a + (parseNumber(l.grams.text) ?? 0));

  /// ¿Hay algo cargado que se perdería al salir?
  bool get _hasUnsaved {
    if (_saving) return false;
    if (_isEdit) return _dirty;
    return _piece.text.trim().isNotEmpty ||
        _notes.text.trim().isNotEmpty ||
        _lines.any((l) => l.filamentId.isNotEmpty || l.grams.text.trim().isNotEmpty);
  }

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

  FallaCarrete? _carrete(String id) {
    for (final c in widget.data.filaments) {
      if (c.id == id) return c;
    }
    return null;
  }

  Future<void> _pickCarrete(FallaLineInput line) async {
    final picked = await showAppSheet<String>(
      context,
      builder: (_) => _CarretePicker(items: widget.data.filaments, selected: line.filamentId),
    );
    if (picked != null && mounted) {
      setState(() {
        line.filamentId = picked;
        _serverError = null;
      });
    }
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
    setState(() => _saving = true);
    final container = ProviderScope.containerOf(context, listen: false);
    try {
      final api = ref.read(fallasApiProvider);
      final notes = _notes.text.trim();
      if (_isEdit) {
        await api.update(
          widget.falla!.id,
          FallaDraft(
            pieceName: _piece.text.trim(),
            material: _material.text.trim(),
            color: _color.text.trim(),
            gramsLost: parseNumber(_grams.text) ?? 0,
            reason: _reason,
            notes: notes,
          ),
        );
        invalidateFallas(container);
        if (mounted) popIfCurrent(context, true);
      } else {
        final lines = [
          for (final l in _lines)
            if (l.filamentId.isNotEmpty && (parseNumber(l.grams.text) ?? 0) > 0)
              FallaLine(filamentId: l.filamentId, grams: parseNumber(l.grams.text)!),
        ];
        // Igual que la web: material y color de la falla son los del primer carrete.
        final primary = _carrete(lines.first.filamentId);
        final res = await api.create(
          FallaDraft(
            pieceName: _piece.text.trim(),
            material: primary?.material ?? '',
            color: primary?.color ?? '',
            gramsLost: lines.fold(0.0, (a, l) => a + l.grams),
            reason: _reason,
            notes: notes,
            lines: lines,
          ),
        );
        invalidateFallas(container);
        if (mounted) popIfCurrent(context, res);
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _serverError = e.message);
    } catch (_) {
      if (mounted) setState(() => _serverError = 'No pudimos guardar. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _suggestions(List<String> options, TextEditingController ctl) {
    if (options.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Wrap(
        spacing: 8,
        runSpacing: 4,
        children: [
          for (final o in options)
            ActionChip(
              label: Text(o),
              onPressed: () => setState(() => ctl.text = o),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final errors = _submitted ? _errors : const <String, String>{};
    final reasons = {...widget.data.reasons, _reason}.toList();
    final colorOptions = {for (final f in widget.data.filaments) f.color}.toList()..sort();

    final scaffold = Scaffold(
      appBar: AppBar(title: Text(_isEdit ? 'Editar falla' : 'Registrar falla')),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  TextField(
                    controller: _piece,
                    textCapitalization: TextCapitalization.sentences,
                    onChanged: (_) => setState(() => _serverError = null),
                    decoration: InputDecoration(
                      labelText: 'Pieza / producto',
                      hintText: 'Ej: Lámpara lunar',
                      errorText: errors['pieceName'],
                    ),
                  ),
                  const SizedBox(height: 18),
                  if (_isEdit) ...[
                    TextField(
                      controller: _material,
                      onChanged: (_) => setState(() => _serverError = null),
                      decoration: InputDecoration(labelText: 'Material', errorText: errors['material']),
                    ),
                    _suggestions(widget.data.materials, _material),
                    const SizedBox(height: 14),
                    TextField(
                      controller: _color,
                      onChanged: (_) => setState(() => _serverError = null),
                      decoration: InputDecoration(labelText: 'Color', errorText: errors['color']),
                    ),
                    _suggestions(colorOptions, _color),
                    const SizedBox(height: 14),
                    TextField(
                      controller: _grams,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
                      onChanged: (_) => setState(() => _serverError = null),
                      decoration: InputDecoration(
                        labelText: 'Gramos perdidos',
                        suffixText: 'g',
                        errorText: errors['grams'],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: c.surface2,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: c.border),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.info_outline_rounded, size: 18, color: c.textDim),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Corregir una falla no cambia el stock. Si te equivocaste de gramos, '
                              'eliminala y volvé a registrarla, o ajustá el stock del carrete.',
                              style: TextStyle(fontSize: 12.5, color: c.textDim, height: 1.35),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ] else ...[
                    const SectionLabel('Colores perdidos'),
                    const SizedBox(height: 4),
                    Text(
                      'Elegí el o los carretes y cuántos gramos se perdieron de cada uno. Se '
                      'descuenta de cada carrete; si a alguno no le alcanza, la falla se registra '
                      'igual y te avisamos para reponer.',
                      style: TextStyle(fontSize: 12.5, color: c.textDim, height: 1.4),
                    ),
                    const SizedBox(height: 10),
                    for (var i = 0; i < _lines.length; i++) ...[
                      _LineRow(
                        key: ObjectKey(_lines[i]),
                        line: _lines[i],
                        carrete: _carrete(_lines[i].filamentId),
                        canRemove: _lines.length > 1,
                        onPick: () => _pickCarrete(_lines[i]),
                        onChanged: () => setState(() => _serverError = null),
                        onRemove: () => setState(() => _removed.add(_lines.removeAt(i))),
                      ),
                      const SizedBox(height: 10),
                    ],
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: () => setState(() => _lines.add(FallaLineInput())),
                        icon: const Icon(Icons.add_rounded, size: 18),
                        label: const Text('Agregar color'),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(left: 12),
                      child: Text(
                        'Total perdido: ${formatGrams(_totalGrams)}',
                        style: TextStyle(fontSize: 13, color: c.textDim, fontWeight: FontWeight.w700),
                      ),
                    ),
                    if (errors['lines'] != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          errors['lines']!,
                          style: const TextStyle(color: Brand.danger, fontSize: 12.5),
                        ),
                      ),
                  ],
                  const SizedBox(height: 18),
                  const SectionLabel('Causa'),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      for (final r in reasons)
                        ChoiceChip(
                          label: Text(r),
                          selected: _reason == r,
                          onSelected: (_) => setState(() => _reason = r),
                        ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  TextField(
                    controller: _notes,
                    maxLines: 3,
                    maxLength: 500,
                    textCapitalization: TextCapitalization.sentences,
                    onChanged: (_) => setState(() => _serverError = null),
                    decoration: InputDecoration(
                      labelText: 'Notas (opcional)',
                      hintText: 'Qué pasó…',
                      errorText: errors['notes'],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // El aviso va pegado al botón (fijo): al final de la lista, con
                  // el teclado abierto, quedaba fuera de la pantalla y parecía
                  // que "Guardar" no hacía nada.
                  if (_serverError != null) ...[
                    InlineError(_serverError!),
                    const SizedBox(height: 10),
                  ],
                  GoldButton(
                    label: _isEdit ? 'Guardar cambios' : 'Registrar falla',
                    icon: Icons.check_rounded,
                    loading: _saving,
                    onPressed: (_dirty && !_saving) ? _save : null,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
    // "Atrás" con datos sin guardar pregunta antes de perderlos, igual que
    // los demás formularios del panel (2026-11-14, pedido de Ale).
    return PopScope(
      canPop: !_hasUnsaved,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmLeave();
      },
      child: scaffold,
    );
  }
}

/// Fila de una línea del alta: selector de carrete + gramos + quitar.
class _LineRow extends StatelessWidget {
  const _LineRow({
    super.key,
    required this.line,
    required this.carrete,
    required this.canRemove,
    required this.onPick,
    required this.onChanged,
    required this.onRemove,
  });
  final FallaLineInput line;
  final FallaCarrete? carrete;
  final bool canRemove;
  final VoidCallback onPick;
  final VoidCallback onChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final grams = parseNumber(line.grams.text) ?? 0;
    final short = carrete != null && grams > carrete!.stockGrams;
    return AdminCard(
      padding: const EdgeInsets.fromLTRB(12, 10, 6, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: onPick,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        ColorDot(hex: carrete?.hex, size: 24),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                carrete?.tag ?? 'Elegí un carrete',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                  color: carrete == null ? c.textFaint : c.text,
                                ),
                              ),
                              if (carrete != null)
                                Text(
                                  'Hay ${formatGrams(carrete!.stockGrams)}',
                                  style: TextStyle(fontSize: 11.5, color: c.textDim),
                                ),
                            ],
                          ),
                        ),
                        Icon(Icons.unfold_more_rounded, size: 20, color: c.textFaint),
                      ],
                    ),
                  ),
                ),
              ),
              if (canRemove)
                IconButton(
                  tooltip: 'Quitar',
                  icon: Icon(Icons.close_rounded, size: 20, color: c.textFaint),
                  onPressed: onRemove,
                )
              else
                const SizedBox(width: 8),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(right: 6, top: 4),
            child: TextField(
              controller: line.grams,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
              onChanged: (_) => onChanged(),
              decoration: const InputDecoration(
                labelText: 'Gramos perdidos',
                suffixText: 'g',
                isDense: true,
              ),
            ),
          ),
          if (short)
            Padding(
              padding: const EdgeInsets.only(top: 6, right: 6),
              child: Text(
                'Solo hay ${formatGrams(carrete!.stockGrams)}: la falla se registra igual y '
                'el carrete queda en deuda hasta que repongas.',
                style: const TextStyle(fontSize: 11.5, color: Brand.warning, height: 1.3),
              ),
            ),
        ],
      ),
    );
  }
}

/// Lista de carretes para elegir (con su color, marca y stock).
class _CarretePicker extends StatelessWidget {
  const _CarretePicker({required this.items, required this.selected});
  final List<FallaCarrete> items;
  final String selected;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return PickerSheet(
      title: 'Elegí el carrete',
      child: items.isEmpty
          ? const EmptyView(
              icon: Icons.donut_large_outlined,
              title: 'No hay carretes cargados',
              subtitle: 'Cargá filamentos en Más → Filamentos para poder registrar fallas.',
            )
          : ListView.builder(
              shrinkWrap: true,
              padding: PickerSheet.listPadding(context),
              itemCount: items.length,
              itemBuilder: (_, i) {
                final f = items[i];
                final isSel = f.id == selected;
                return ListTile(
                  leading: ColorDot(hex: f.hex, size: 26),
                  title: Text(
                    f.tag,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontWeight: isSel ? FontWeight.w800 : FontWeight.w600,
                      color: isSel ? Brand.gold : c.text,
                    ),
                  ),
                  subtitle: Text('Hay ${formatGrams(f.stockGrams)}'),
                  trailing: isSel ? const Icon(Icons.check_rounded, color: Brand.gold) : null,
                  onTap: () => Navigator.of(context).pop(f.id),
                );
              },
            ),
    );
  }
}
