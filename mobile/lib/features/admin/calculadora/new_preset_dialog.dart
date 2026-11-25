import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../analisis/analysis_widgets.dart';
import 'calc_extras_api.dart';
import 'calculadora_api.dart';
import 'calculadora_models.dart';

/// Tipos para elegir en la calculadora: los del servidor más el recién creado
/// (mientras la lista se vuelve a pedir todavía no lo trae). Pura.
List<CalcPreset> presetOptionsWith(List<CalcPreset> options, CalcPreset? created) => [
      ...options,
      if (created != null && !options.any((p) => p.id == created.id)) created,
    ];

/// "＋ Nuevo tipo" (sugerencia de Agustín, 2026-11-25): el operador crea un
/// tipo de producto sin pedírselo al dueño. Elige con qué tipo existente "se
/// cobra igual"; el servidor copia ese margen y acá NUNCA se muestra.
///
/// Guarda él mismo, vuelve a pedir los datos de la calculadora y devuelve el
/// tipo creado (o null si se canceló).
Future<CalcPreset?> showNewPresetDialog(BuildContext context, {required List<CalcPreset> options}) {
  return showDialog<CalcPreset>(
    context: context,
    builder: (_) => _NewPresetDialog(options: options),
  );
}

class _NewPresetDialog extends ConsumerStatefulWidget {
  const _NewPresetDialog({required this.options});
  final List<CalcPreset> options;

  @override
  ConsumerState<_NewPresetDialog> createState() => _NewPresetDialogState();
}

class _NewPresetDialogState extends ConsumerState<_NewPresetDialog> {
  final _name = TextEditingController();
  String? _likeId;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_saving) return;
    final name = _name.text.trim();
    final likeId = _likeId;
    if (name.isEmpty || likeId == null) {
      setState(() => _error = 'Poné un nombre y elegí con qué tipo se cobra igual.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    // El contenedor se toma ANTES del `await`: si el diálogo se cerró mientras
    // el servidor respondía, la calculadora igual se refresca.
    final container = ProviderScope.containerOf(context, listen: false);
    try {
      final created = await ref.read(calcExtrasApiProvider).createPresetLike(name: name, likePresetId: likeId);
      container.invalidate(calculadoraProvider);
      if (!mounted) return;
      final route = ModalRoute.of(context);
      if (route != null && route.isCurrent) Navigator.of(context).pop(created);
    } catch (e) {
      if (mounted) setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return AlertDialog(
      // Con campos adentro SIEMPRE `scrollable`: en un teléfono chico con el
      // teclado abierto el diálogo no entra entero.
      scrollable: true,
      title: const Text('Nuevo tipo'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _name,
            autofocus: true,
            maxLength: 120,
            textCapitalization: TextCapitalization.sentences,
            textInputAction: TextInputAction.done,
            onChanged: (_) => setState(() => _error = null),
            decoration: const InputDecoration(
              labelText: 'Nombre del tipo',
              hintText: 'Ej: Llaveros 2 colores',
              counterText: '',
            ),
          ),
          const SizedBox(height: 14),
          Text('Se cobra como', style: TextStyle(fontSize: 12.5, color: c.textDim, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: [
              for (final p in widget.options)
                ChoiceChip(
                  // Solo el nombre: el porcentaje nunca se muestra acá.
                  label: Text(p.name),
                  selected: p.id == _likeId,
                  onSelected: (_) => setState(() {
                    _likeId = p.id;
                    _error = null;
                  }),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'Se cobra igual que el tipo que elijas. Ale puede ajustarlo después.',
            style: TextStyle(fontSize: 12.5, color: c.textFaint, height: 1.35),
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!, style: const TextStyle(color: Brand.danger, fontSize: 12.5)),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        TextButton(
          onPressed: _saving ? null : _submit,
          child: Text(_saving ? 'Creando…' : 'Crear tipo'),
        ),
      ],
    );
  }
}

/// Botón "＋ Nuevo tipo" que va al lado de los tipos de producto.
class NewPresetChip extends StatelessWidget {
  const NewPresetChip({super.key, required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => ActionChip(
        avatar: const Icon(Icons.add_rounded, size: 18),
        label: const Text('Nuevo tipo'),
        onPressed: onPressed,
      );
}
