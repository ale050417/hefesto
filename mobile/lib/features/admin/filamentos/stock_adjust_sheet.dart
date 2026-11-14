import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import 'filamentos_api.dart';
import 'filamentos_format.dart';
import 'filamentos_models.dart';
import 'shared_widgets.dart';

enum AdjustMode {
  add('Sumar'),
  remove('Restar'),
  count('Contado');

  const AdjustMode(this.label);
  final String label;
}

/// Qué pasaría con el stock si se aplica lo tipeado, o por qué no se puede.
/// Pura (no toca la UI) para poder probarla.
class AdjustPlan {
  const AdjustPlan.ok({required this.delta, required this.newStock}) : error = null;
  const AdjustPlan.error(this.error)
      : delta = 0,
        newStock = 0;
  const AdjustPlan.empty()
      : delta = 0,
        newStock = 0,
        error = null;

  final double delta;
  final double newStock;
  final String? error;
  bool get isValid => error == null && delta != 0;
}

AdjustPlan planAdjust(AdjustMode mode, double current, String text) {
  if (text.trim().isEmpty) return const AdjustPlan.empty();
  final v = parseNumber(text);
  if (v == null) return const AdjustPlan.error('Ingresá un número.');
  switch (mode) {
    case AdjustMode.add:
      if (v <= 0) return const AdjustPlan.error('Los gramos tienen que ser más que 0.');
      // Un carrete en deuda (stock negativo: se vendió más de lo cargado) no
      // puede quedar negativo después de un ajuste manual: el servidor lo
      // rechaza, y con un mensaje que confunde ("No hay stock para restar.").
      // Se avisa acá con lo que hay que hacer.
      if (current + v < 0) {
        return AdjustPlan.error(
          'Este carrete debe ${formatGrams(-current)}: sumá al menos eso para saldar la deuda.',
        );
      }
      return AdjustPlan.ok(delta: v, newStock: current + v);
    case AdjustMode.remove:
      if (v <= 0) return const AdjustPlan.error('Los gramos tienen que ser más que 0.');
      if (current - v < 0) {
        return AdjustPlan.error(
          current > 0
              ? 'No podés restar más de lo que hay (${formatGrams(current)}).'
              : 'No hay stock para restar.',
        );
      }
      return AdjustPlan.ok(delta: -v, newStock: current - v);
    case AdjustMode.count:
      if (v < 0) return const AdjustPlan.error('El stock no puede ser negativo.');
      if ((v - current).abs() < 0.005) {
        return AdjustPlan.error('El stock ya es de ${formatGrams(current)}.');
      }
      return AdjustPlan.ok(delta: v - current, newStock: v);
  }
}

const _reasonSuggestions = ['Compra', 'Conteo físico', 'Merma', 'Corrección'];

/// Hoja para sumar, restar o fijar (conteo) el stock de un carrete. Aplica el
/// ajuste ella misma (queda en el historial del servidor) y se cierra devolviendo
/// el [StockAdjustResult].
Future<StockAdjustResult?> showStockAdjustSheet(BuildContext context, Filamento f) {
  return showAppSheet<StockAdjustResult>(
    context,
    builder: (_) => StockAdjustSheet(filament: f),
  );
}

class StockAdjustSheet extends ConsumerStatefulWidget {
  const StockAdjustSheet({super.key, required this.filament});
  final Filamento filament;

  @override
  ConsumerState<StockAdjustSheet> createState() => _StockAdjustSheetState();
}

class _StockAdjustSheetState extends ConsumerState<StockAdjustSheet> {
  final _amount = TextEditingController();
  final _reason = TextEditingController();
  AdjustMode _mode = AdjustMode.add;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _amount.dispose();
    _reason.dispose();
    super.dispose();
  }

  AdjustPlan get _plan => planAdjust(_mode, widget.filament.stockGrams, _amount.text);

  void _setAmount(double v) {
    setState(() {
      _amount.text = gramsField(v);
      _amount.selection = TextSelection.collapsed(offset: _amount.text.length);
      _error = null;
    });
  }

  Future<void> _submit() async {
    final plan = _plan;
    if (!plan.isValid || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(filamentosApiProvider);
      final reason = _reason.text;
      final result = _mode == AdjustMode.count
          ? await api.adjust(widget.filament.id, newStockGrams: plan.newStock, reason: reason)
          : await api.adjust(widget.filament.id, deltaGrams: plan.delta, reason: reason);
      invalidateFilamentos(ref);
      if (mounted) popIfCurrent(context, result);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'No pudimos aplicar el ajuste. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final f = widget.filament;
    final plan = _plan;
    final quick = switch (_mode) {
      AdjustMode.count => <double>[0, if (f.spoolGrams > 0) f.spoolGrams],
      _ => <double>[100, 250, 500, if (f.spoolGrams > 0 && f.spoolGrams != 500) f.spoolGrams],
    };

    // Hoja estándar (2026-11-14, pedido de Ale: que los modales se vean bien):
    // el contenido se desplaza, sube con el teclado sin meterse debajo de la
    // barra de estado, y "Aplicar ajuste" queda fijo y a la vista.
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
            label: 'Aplicar ajuste',
            icon: Icons.check_rounded,
            loading: _loading,
            onPressed: plan.isValid ? _submit : null,
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
                  Text('Ajustar stock', style: Theme.of(context).textTheme.titleLarge),
                  Text(
                    '${f.tag} · hoy ${formatGrams(f.stockGrams)}',
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
        SizedBox(
          width: double.infinity,
          child: SegmentedButton<AdjustMode>(
            showSelectedIcon: false,
            segments: [
              for (final m in AdjustMode.values)
                ButtonSegment(value: m, label: Text(m.label, maxLines: 1, softWrap: false)),
            ],
            selected: {_mode},
            onSelectionChanged: (s) => setState(() {
              _mode = s.first;
              _error = null;
            }),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          switch (_mode) {
            AdjustMode.add => 'Sumá lo que compraste o repusiste.',
            AdjustMode.remove => 'Restá lo que se perdió o se usó fuera del sistema.',
            AdjustMode.count => 'Poné el peso que contaste: ajustamos la diferencia.',
          },
          style: TextStyle(fontSize: 12, color: c.textFaint),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _amount,
          autofocus: true,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
          onChanged: (_) => setState(() => _error = null),
          decoration: InputDecoration(
            labelText: _mode == AdjustMode.count ? 'Stock contado' : 'Gramos',
            suffixText: 'g',
            errorText: plan.error,
          ),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          children: [
            for (final q in quick)
              ActionChip(
                label: Text(q == f.spoolGrams && _mode != AdjustMode.count
                    ? '1 carrete (${formatGrams(q)})'
                    : formatGrams(q)),
                onPressed: () => _setAmount(q),
              ),
          ],
        ),
        if (plan.isValid) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: (plan.delta > 0 ? Brand.success : Brand.warning).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              'Queda en ${formatGrams(plan.newStock)} (${formatDeltaGrams(plan.delta)})',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 13.5,
                color: plan.delta > 0 ? Brand.success : Brand.warning,
              ),
            ),
          ),
        ],
        const SizedBox(height: 14),
        TextField(
          controller: _reason,
          maxLength: 200,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(
            labelText: 'Motivo (opcional)',
            counterText: '',
          ),
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          children: [
            for (final r in _reasonSuggestions)
              ActionChip(
                label: Text(r),
                onPressed: () => setState(() => _reason.text = r),
              ),
          ],
        ),
      ],
    );
  }
}
