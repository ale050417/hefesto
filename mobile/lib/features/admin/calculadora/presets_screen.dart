import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import '../admin_widgets.dart';
import '../analisis/analysis_widgets.dart';
import '../analisis/ar_number.dart';
import '../analisis/number_field.dart';
import 'calculadora_api.dart';
import 'calculadora_models.dart';

/// Tipos de producto con su margen de ganancia (SOLO admin). El operador elige
/// el tipo en la calculadora sin ver el margen; desactivar un tipo lo oculta sin
/// borrarlo.
class PresetsScreen extends ConsumerStatefulWidget {
  const PresetsScreen({super.key});

  @override
  ConsumerState<PresetsScreen> createState() => _PresetsScreenState();
}

class _PresetsScreenState extends ConsumerState<PresetsScreen> {
  String? _busyId;

  Future<void> _edit(List<CalcPreset> all, [CalcPreset? preset]) async {
    final saved = await showAppSheet<bool>(
      context,
      builder: (_) => PresetSheet(
        preset: preset,
        nextOrder: all.isEmpty ? 0 : all.map((p) => p.sortOrder).reduce((a, b) => a > b ? a : b) + 1,
      ),
    );
    if (saved == true) ref.invalidate(calculadoraProvider);
  }

  Future<void> _toggle(CalcPreset p, bool active) async {
    setState(() => _busyId = p.id);
    try {
      await ref.read(calculadoraApiProvider).updatePreset(
            p.id,
            name: p.name,
            marginPct: p.marginPct ?? 0,
            active: active,
            sortOrder: p.sortOrder,
          );
      ref.invalidate(calculadoraProvider);
    } catch (e) {
      if (mounted) showSnack(context, errorMessage(e));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _delete(CalcPreset p) async {
    final ok = await confirmDialog(
      context,
      title: 'Eliminar tipo',
      message: '¿Eliminar "${p.name}"? Los cálculos ya guardados no se tocan. '
          'Si solo querés ocultarlo, desactivalo.',
    );
    if (!ok || !mounted) return;
    setState(() => _busyId = p.id);
    try {
      await ref.read(calculadoraApiProvider).deletePreset(p.id);
      ref.invalidate(calculadoraProvider);
      if (mounted) showSnack(context, 'Tipo eliminado');
    } catch (e) {
      if (mounted) showSnack(context, errorMessage(e));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final data = ref.watch(calculadoraProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Tipos y márgenes')),
      floatingActionButton: data.hasValue
          ? FloatingActionButton.extended(
              onPressed: () => _edit(data.requireValue.presets),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Agregar tipo'),
            )
          : null,
      // SafeArea (2026-11-14, pedido de Ale: que las pantallas no estén rotas):
      // sin esto, al final de la lista el último tipo quedaba debajo del botón
      // flotante y de la barra del sistema.
      body: SafeArea(
        top: false,
        child: data.when(
        loading: () => const ListSkeleton(rows: 4, height: 76),
        error: (e, _) => ErrorView(message: errorMessage(e, fallback: '$e'), onRetry: () => ref.invalidate(calculadoraProvider)),
        data: (o) {
          if (!o.isAdmin) return const AccessDenied(what: 'los tipos y márgenes');
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
            children: [
              Text(
                'Definí cada tipo (ej: Llaveros, Macetas) con su % de ganancia. El operador lo elige en la '
                'calculadora sin ver el margen.',
                style: TextStyle(fontSize: 13, color: c.textDim, height: 1.45),
              ),
              const SizedBox(height: 14),
              if (o.presets.isEmpty)
                const AdminCard(
                  child: EmptyView(
                    icon: Icons.category_outlined,
                    title: 'Todavía no hay tipos',
                    subtitle: 'Agregá el primero para poder cotizar.',
                  ),
                )
              else
                for (final p in o.presets) ...[
                  AdminCard(
                    onTap: _busyId == null ? () => _edit(o.presets, p) : null,
                    padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(p.name,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 14.5,
                                    color: p.active ? null : c.textFaint,
                                  )),
                              Text(
                                'Margen ${formatArNumber(p.marginPct ?? 0, maxDecimals: 2)}%${p.active ? '' : ' · oculto'}',
                                style: TextStyle(fontSize: 12.5, color: c.textDim),
                              ),
                            ],
                          ),
                        ),
                        // Sin colores a mano: el interruptor sale del tema (con
                        // `activeThumbColor` dorado la pista quedaba color oliva).
                        Switch(
                          value: p.active,
                          onChanged: _busyId == null ? (v) => _toggle(p, v) : null,
                        ),
                        IconButton(
                          tooltip: 'Eliminar',
                          onPressed: _busyId == null ? () => _delete(p) : null,
                          icon: const Icon(Icons.delete_outline_rounded, color: Brand.danger),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
            ],
          );
        },
        ),
      ),
    );
  }
}

/// Alta / edición de un tipo.
class PresetSheet extends ConsumerStatefulWidget {
  const PresetSheet({super.key, this.preset, required this.nextOrder});
  final CalcPreset? preset;
  final int nextOrder;

  @override
  ConsumerState<PresetSheet> createState() => _PresetSheetState();
}

class _PresetSheetState extends ConsumerState<PresetSheet> {
  late final _name = TextEditingController(text: widget.preset?.name ?? '');
  late final _margin = TextEditingController(text: arEditText(widget.preset?.marginPct ?? 100));
  late bool _active = widget.preset?.active ?? true;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _margin.dispose();
    super.dispose();
  }

  /// Tope del margen: la columna del servidor es `numeric(6,2)`; un valor más
  /// grande hacía fallar el guardado con un error genérico (2026-11-14).
  static const double _maxMargin = 9999.99;

  bool get _valid =>
      _name.text.trim().isNotEmpty && validateArNumber(_margin.text, min: 0, max: _maxMargin) == null;

  Future<void> _save() async {
    if (!_valid || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final api = ref.read(calculadoraApiProvider);
    final name = _name.text.trim();
    final margin = parseArNumber(_margin.text)!;
    try {
      final p = widget.preset;
      if (p == null) {
        await api.createPreset(name: name, marginPct: margin, active: _active, sortOrder: widget.nextOrder);
      } else {
        await api.updatePreset(p.id, name: name, marginPct: margin, active: _active, sortOrder: p.sortOrder);
      }
      if (!mounted) return;
      showSnack(context, p == null ? 'Tipo creado' : 'Tipo guardado');
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isNew = widget.preset == null;
    // Hoja estándar (2026-11-14, pedido de Ale: "que cuando tocás los botones se
    // vean bien los modales"): el contenido sube con el teclado y "Guardar"
    // queda fijo a la vista, arriba de la barra del sistema.
    return SheetBody(
      title: isNew ? 'Nuevo tipo' : 'Editar tipo',
      footer: GoldButton(label: 'Guardar', icon: Icons.check_rounded, loading: _saving, onPressed: _valid ? _save : null),
      children: [
        TextField(
          controller: _name,
          onChanged: (_) => setState(() => _error = null),
          onTapOutside: closeKeyboardOnTapOutside,
          textCapitalization: TextCapitalization.sentences,
          textInputAction: TextInputAction.next,
          maxLength: 120,
          decoration: const InputDecoration(labelText: 'Nombre', hintText: 'Ej: Llaveros 2 colores', counterText: ''),
        ),
        const SizedBox(height: 14),
        ArNumberField(
          controller: _margin,
          label: 'Margen de ganancia',
          suffix: '%',
          max: _maxMargin,
          helper: 'Sobre el costo total. Puede pasar de 100% (ej: 200%).',
          textInputAction: TextInputAction.done,
          onChanged: (_) => setState(() => _error = null),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Activo'),
          subtitle: const Text('Si está apagado, no aparece en la calculadora.'),
          value: _active,
          onChanged: (v) => setState(() => _active = v),
        ),
        if (_error != null) ...[
          const SizedBox(height: 6),
          NoticeBanner(_error!, icon: Icons.error_outline_rounded, color: Brand.danger),
        ],
      ],
    );
  }
}
