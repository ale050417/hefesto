import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import 'filament_types_screen.dart';
import 'filamentos_api.dart';
import 'filamentos_format.dart';
import 'filamentos_models.dart';
import 'shared_widgets.dart';

/// Tope de carretes cerrados que acepta el servidor (`weighSchema`).
const maxSealedSpools = 100;

double _r2(double n) => (n * 100).round() / 100;

/// Qué quedaría de stock con lo tipeado en "Calcular filamento", o por qué no
/// se puede. Mismas reglas que `planWeigh` del servidor (que igual vuelve a
/// validar): peso total − carrete vacío = filamento que queda; los carretes
/// cerrados del mismo color se suman enteros. Pura para poder probarla.
class WeighPlan {
  const WeighPlan.ok({
    required this.emptyGrams,
    required this.totalGrams,
    required this.remainingGrams,
    required this.newStockGrams,
    required this.sealedSpools,
  }) : error = null;
  const WeighPlan.error(this.error)
      : emptyGrams = 0,
        totalGrams = 0,
        remainingGrams = 0,
        newStockGrams = 0,
        sealedSpools = 0;

  /// Todavía no hay nada para calcular (falta el peso o el modelo).
  const WeighPlan.empty()
      : emptyGrams = 0,
        totalGrams = 0,
        remainingGrams = 0,
        newStockGrams = 0,
        sealedSpools = 0,
        error = null;

  final double emptyGrams;
  final double totalGrams;

  /// Filamento que queda en el carrete pesado.
  final double remainingGrams;

  /// Stock total del color: lo pesado + los carretes cerrados aparte.
  final double newStockGrams;
  final int sealedSpools;
  final String? error;

  bool get isValid => error == null && totalGrams > 0;
}

WeighPlan planWeigh({
  required String totalText,
  required double? emptyGrams,
  String sealedText = '',
  required double spoolGrams,
}) {
  var sealed = 0;
  if (sealedText.trim().isNotEmpty) {
    final s = parseNumber(sealedText);
    if (s == null || s < 0 || s != s.floorToDouble()) {
      return const WeighPlan.error('Los carretes cerrados tienen que ser un número entero.');
    }
    if (s > maxSealedSpools) {
      return const WeighPlan.error('Revisá los carretes cerrados (como mucho $maxSealedSpools).');
    }
    sealed = s.toInt();
  }
  if (totalText.trim().isEmpty) return const WeighPlan.empty();
  final total = parseNumber(totalText);
  if (total == null || total <= 0) return const WeighPlan.error('Ingresá cuánto pesa el carrete.');
  if (emptyGrams == null) return const WeighPlan.empty();
  if (total < emptyGrams) {
    return WeighPlan.error(
      'El carrete pesa ${formatGrams(total)} y vacío pesa ${formatGrams(emptyGrams)}: '
      'revisá el peso o el modelo de carrete.',
    );
  }
  final remaining = _r2(total - emptyGrams);
  return WeighPlan.ok(
    emptyGrams: emptyGrams,
    totalGrams: total,
    remainingGrams: remaining,
    newStockGrams: _r2(remaining + sealed * spoolGrams),
    sealedSpools: sealed,
  );
}

/// "Carrete vacío: 250 g · Filamento restante: 430 g" (lo que se ve en vivo).
String weighPreviewText(WeighPlan plan) =>
    'Carrete vacío: ${formatGrams(plan.emptyGrams)} · Filamento restante: ${formatGrams(plan.remainingGrams)}';

/// Aviso con el resultado del pesado.
String weighResultText(WeighResult r) {
  final left = 'Quedan ${formatGrams(r.remainingGrams)} en el carrete';
  if (!r.changed) return '$left · el stock ya era de ${formatGrams(r.newStockGrams)}';
  return '$left · stock: ${formatGrams(r.previousStock)} → ${formatGrams(r.newStockGrams)}'
      '${r.lowStock ? ' · quedó bajo el umbral, conviene reponer' : ''}';
}

/// "Calcular filamento" (pedido de Agustín, 2026-11-24): se elige el modelo de
/// carrete, se pesa el carrete en uso y la app resta el peso del carrete vacío.
/// Al confirmar, el servidor fija el stock (queda en el historial). Se cierra
/// devolviendo el [WeighResult].
Future<WeighResult?> showWeighSheet(BuildContext context, Filamento f) {
  return showAppSheet<WeighResult>(context, builder: (_) => WeighSheet(filament: f));
}

class WeighSheet extends ConsumerStatefulWidget {
  const WeighSheet({super.key, required this.filament});
  final Filamento filament;

  @override
  ConsumerState<WeighSheet> createState() => _WeighSheetState();
}

class _WeighSheetState extends ConsumerState<WeighSheet> {
  static const _title = 'Calcular filamento';

  final _total = TextEditingController();
  final _sealed = TextEditingController(text: '0');
  late String? _modelId = widget.filament.spoolModelId;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _total.dispose();
    _sealed.dispose();
    super.dispose();
  }

  /// El modelo elegido; si no hay ninguno elegido (o se borró) y existe uno
  /// solo, ese.
  SpoolModel? _selected(List<SpoolModel> models) {
    for (final m in models) {
      if (m.id == _modelId) return m;
    }
    return models.length == 1 ? models.first : null;
  }

  WeighPlan _plan(SpoolModel? model) => planWeigh(
        totalText: _total.text,
        emptyGrams: model?.emptyGrams,
        sealedText: _sealed.text,
        spoolGrams: widget.filament.spoolGrams,
      );

  Future<void> _editModel([SpoolModel? model]) async {
    final id = await showSpoolModelDialog(context, model: model);
    if (id == null || !mounted) return;
    setState(() {
      if (id.isNotEmpty) _modelId = id;
      _error = null;
    });
  }

  Future<void> _deleteModel(SpoolModel m) async {
    final ok = await confirmDialog(
      context,
      title: '¿Eliminar el carrete «${m.name}»?',
      message: 'Deja de aparecer en esta lista. El stock de los filamentos no cambia.',
      confirmLabel: 'Eliminar',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    final container = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(filamentosApiProvider).deleteSpoolModel(m.id);
      container.invalidate(filamentTypesProvider);
      if (mounted) setState(() => _modelId = null);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'No pudimos eliminarlo. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit(SpoolModel? model) async {
    final plan = _plan(model);
    if (model == null || !plan.isValid || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    final container = ProviderScope.containerOf(context, listen: false);
    try {
      final result = await ref.read(filamentosApiProvider).weigh(
            widget.filament.id,
            spoolModelId: model.id,
            totalGrams: plan.totalGrams,
            sealedSpools: plan.sealedSpools,
          );
      invalidateFilamentos(container);
      if (mounted) popIfCurrent(context, result);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'No pudimos actualizar el stock. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final f = widget.filament;
    final data = ref.watch(filamentTypesProvider);
    final subtitle = '${f.tag} · hoy ${formatGrams(f.stockGrams)}';

    if (data.isLoading && !data.hasValue) {
      return SheetBody(
        title: _title,
        subtitle: subtitle,
        children: const [SizedBox(height: 140, child: LoadingView())],
      );
    }
    if (data.hasError && !data.hasValue) {
      return SheetBody(
        title: _title,
        subtitle: subtitle,
        children: [
          ErrorView(message: '${data.error}', onRetry: () => ref.invalidate(filamentTypesProvider)),
        ],
      );
    }
    final models = data.requireValue.spoolModels;

    if (models.isEmpty) {
      return SheetBody(
        title: _title,
        subtitle: subtitle,
        footer: GoldButton(
          label: 'Agregar un carrete',
          icon: Icons.add_rounded,
          onPressed: _editModel,
        ),
        children: [
          Text(
            'Todavía no cargaste ningún modelo de carrete. Agregá el que usás con su peso VACÍO: '
            'después pesás el carrete en uso y la app resta ese peso.',
            style: TextStyle(fontSize: 13.5, color: c.textDim, height: 1.45),
          ),
        ],
      );
    }

    final model = _selected(models);
    final plan = _plan(model);
    final label = TextStyle(fontSize: 12.5, color: c.textDim, fontWeight: FontWeight.w600);

    return SheetBody(
      footer: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // El rechazo del servidor va pegado al botón: con el teclado abierto,
          // al final del contenido no se llegaba a ver.
          if (_error != null) ...[
            InlineError(_error!),
            const SizedBox(height: 10),
          ],
          GoldButton(
            label: 'Confirmar y actualizar stock',
            icon: Icons.check_rounded,
            loading: _loading,
            onPressed: model != null && plan.isValid ? () => _submit(model) : null,
          ),
        ],
      ),
      children: [
        Row(
          children: [
            ColorDot(hex: f.hex, size: 26),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_title, style: Theme.of(context).textTheme.titleLarge),
                  Text(
                    subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12.5, color: c.textDim),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Text('Modelo de carrete', style: label),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          children: [
            for (final m in models)
              PickChip(
                label: '${m.name} (${formatGrams(m.emptyGrams)})',
                selected: model?.id == m.id,
                onTap: () => setState(() {
                  _modelId = m.id;
                  _error = null;
                }),
              ),
          ],
        ),
        Wrap(
          spacing: 4,
          children: [
            TextButton.icon(
              onPressed: _loading ? null : _editModel,
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Nuevo carrete'),
            ),
            if (model != null) ...[
              TextButton.icon(
                onPressed: _loading ? null : () => _editModel(model),
                icon: const Icon(Icons.edit_outlined, size: 18),
                label: const Text('Editar'),
              ),
              TextButton.icon(
                onPressed: _loading ? null : () => _deleteModel(model),
                style: TextButton.styleFrom(foregroundColor: Brand.danger),
                icon: const Icon(Icons.delete_outline_rounded, size: 18),
                label: const Text('Eliminar'),
              ),
            ],
          ],
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _total,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
          textInputAction: TextInputAction.next,
          onChanged: (_) => setState(() => _error = null),
          decoration: InputDecoration(
            labelText: 'Peso del carrete con filamento',
            suffixText: 'g',
            helperText: 'Pesá el carrete que está en uso, así como está.',
            helperMaxLines: 2,
            errorText: plan.error,
            errorMaxLines: 3,
          ),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _sealed,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          maxLength: 3,
          textInputAction: TextInputAction.done,
          onChanged: (_) => setState(() => _error = null),
          decoration: InputDecoration(
            labelText: 'Carretes cerrados aparte',
            counterText: '',
            helperText: f.spoolGrams > 0
                ? 'Sin abrir, del mismo color: se suman enteros (${formatGrams(f.spoolGrams)} cada uno).'
                : 'Sin abrir, del mismo color.',
            helperMaxLines: 2,
          ),
        ),
        if (model == null) ...[
          const SizedBox(height: 12),
          Text('Elegí el modelo de carrete para ver cuánto queda.', style: TextStyle(fontSize: 12.5, color: c.textFaint)),
        ],
        if (plan.isValid) ...[
          const SizedBox(height: 12),
          Container(
            key: const ValueKey('weigh-preview'),
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Brand.success.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  weighPreviewText(plan),
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: Brand.success),
                ),
                if (plan.sealedSpools > 0) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Stock total: ${formatGrams(plan.newStockGrams)} (con ${plan.sealedSpools} '
                    '${plan.sealedSpools == 1 ? 'carrete cerrado' : 'carretes cerrados'})',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: Brand.success),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }
}
