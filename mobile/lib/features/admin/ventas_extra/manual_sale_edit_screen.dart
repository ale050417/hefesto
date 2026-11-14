import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/format.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import '../admin_providers.dart';
import '../admin_widgets.dart';
import '../sale_status.dart';
import 'ventas_extra_api.dart';
import 'ventas_extra_models.dart';
import 'ventas_extra_widgets.dart';

/// Editar una venta de mostrador ya cargada (espejo del editor de la web,
/// `updateManualSaleAction`): cliente, fecha, detalle, categoría, medio de pago,
/// total y costo. La ganancia la recalcula el servidor (total − costo). No toca
/// stock ni estado: el estado se cambia con los botones del detalle.
class ManualSaleEditScreen extends ConsumerWidget {
  const ManualSaleEditScreen({super.key, required this.saleId});
  final String saleId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sale = ref.watch(manualSaleEditProvider(saleId));
    return Scaffold(
      appBar: AppBar(title: const Text('Editar venta')),
      body: sale.when(
        loading: () => const ListSkeleton(rows: 4, height: 120),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(manualSaleEditProvider(saleId)),
        ),
        data: (data) => _EditForm(data: data),
      ),
    );
  }
}

class _EditForm extends ConsumerStatefulWidget {
  const _EditForm({required this.data});
  final ManualSaleEditData data;

  @override
  ConsumerState<_EditForm> createState() => _EditFormState();
}

class _EditFormState extends ConsumerState<_EditForm> {
  late final _customer = TextEditingController(text: widget.data.customerName);
  late final _detail = TextEditingController(text: widget.data.detail ?? '');
  late final _category = TextEditingController(text: widget.data.category ?? '');
  late final _total = TextEditingController(text: moneyText(widget.data.total));
  late final _cost = TextEditingController(text: moneyText(widget.data.amortization ?? 0));
  late DateTime _date = widget.data.saleDate;
  late String _payment = widget.data.paymentMethod;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _customer.dispose();
    _detail.dispose();
    _category.dispose();
    _total.dispose();
    _cost.dispose();
    super.dispose();
  }

  double? get _totalN => parseMoney(_total.text);
  double get _costN => parseMoney(_cost.text) ?? 0;

  /// Qué falta para poder guardar; null = se puede.
  String? get _problem {
    if (_customer.text.trim().isEmpty) return 'Falta el nombre del cliente.';
    final t = _totalN;
    if (t == null || !(t > 0)) return 'Poné el total cobrado.';
    if (parseMoney(_cost.text) == null && _cost.text.trim().isNotEmpty) {
      return 'El costo no se entiende.';
    }
    return null;
  }

  bool get _dirty {
    final d = widget.data;
    return _customer.text.trim() != d.customerName ||
        _detail.text.trim() != (d.detail ?? '') ||
        _category.text.trim() != (d.category ?? '') ||
        _payment != d.paymentMethod ||
        saleDateParam(_date) != saleDateParam(d.saleDate) ||
        _totalN != d.total ||
        _costN != (d.amortization ?? 0);
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    // El calendario de la app (mismos límites de siempre: 5 años atrás, hasta mañana).
    final picked = await pickDay(
      context,
      initial: _date,
      first: DateTime(now.year - 5),
      last: DateTime(now.year, now.month, now.day).add(const Duration(days: 1)),
      title: 'Fecha de la venta',
    );
    if (picked != null && mounted) setState(() => _date = picked);
  }

  Future<void> _save() async {
    if (_busy || _problem != null || !_dirty) return;
    final messenger = ScaffoldMessenger.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(ventasExtraApiProvider).editManualSale(
            widget.data.id,
            manualSaleEditBody(
              date: _date,
              customer: _customer.text,
              detail: _detail.text,
              category: _category.text,
              total: _totalN!,
              amortization: _costN,
              paymentMethod: _payment,
            ),
          );
      invalidateSales(ref);
      ref.invalidate(manualSaleEditProvider(widget.data.id));
      if (!mounted) return;
      Navigator.of(context).pop(true);
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Venta actualizada')));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'No pudimos guardar los cambios. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Salir con cambios sin guardar los pierde: se pregunta antes (igual que
  /// en "Nueva venta").
  Future<bool> _confirmDiscard() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('¿Descartar los cambios?'),
        content: const Text('Cambiaste datos de la venta que todavía no se guardaron. Si salís, se pierden.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Seguir editando')),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Descartar', style: TextStyle(color: Brand.danger)),
          ),
        ],
      ),
    );
    return ok == true;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final d = widget.data;
    final profit = editedProfit(_totalN ?? 0, _costN);
    final canSave = _problem == null && _dirty;
    final form = ref.watch(saleFormDataProvider).value;
    final categories = form?.categories ?? const <String>[];

    return PopScope(
      canPop: !_dirty || _busy,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _confirmDiscard() && context.mounted) Navigator.of(context).pop();
      },
      child: Column(
        children: [
          Expanded(
            child: ListView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              children: [
                AdminCard(
                  accent: d.status.color,
                  child: Row(
                    children: [
                      Icon(d.status.icon, color: d.status.color),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Estado: ${d.status.label}. Para cambiarlo usá los botones del detalle de la venta.',
                          style: TextStyle(fontSize: 12.5, color: c.textDim, height: 1.35),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                FormSection(
                  title: 'Cliente y fecha',
                  child: Column(
                    children: [
                      TextField(
                        controller: _customer,
                        textCapitalization: TextCapitalization.words,
                        maxLength: 120,
                        onChanged: (_) => setState(() => _error = null),
                        decoration: const InputDecoration(
                          labelText: 'Nombre del cliente',
                          prefixIcon: Icon(Icons.person_outline_rounded),
                          counterText: '',
                        ),
                      ),
                      const SizedBox(height: 12),
                      InkWell(
                        borderRadius: BorderRadius.circular(14),
                        onTap: _pickDate,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                          decoration: BoxDecoration(
                            color: c.surface2,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: c.border),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.event_rounded, size: 20, color: c.textDim),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  formatLongDay(_date),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                ),
                              ),
                              Icon(Icons.edit_calendar_outlined, size: 18, color: c.textFaint),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                FormSection(
                  title: 'Qué se vendió',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextField(
                        controller: _detail,
                        maxLines: 2,
                        minLines: 1,
                        maxLength: 300,
                        textCapitalization: TextCapitalization.sentences,
                        onChanged: (_) => setState(() {}),
                        decoration: const InputDecoration(
                          labelText: 'Detalle',
                          counterText: '',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _category,
                        maxLength: 80,
                        textCapitalization: TextCapitalization.sentences,
                        onChanged: (_) => setState(() {}),
                        decoration: const InputDecoration(
                          labelText: 'Categoría (opcional)',
                          prefixIcon: Icon(Icons.sell_outlined),
                          counterText: '',
                        ),
                      ),
                      if (categories.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 6,
                          children: [
                            for (final cat in categories)
                              ChoiceChip(
                                label: Text(cat),
                                selected: _category.text.trim() == cat,
                                onSelected: (_) => setState(() => _category.text = cat),
                              ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                FormSection(
                  title: 'Plata',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      MoneyField(
                        controller: _total,
                        label: 'Total cobrado',
                        helperText: 'Lo que te pagó el cliente.',
                        onChanged: (_) => setState(() => _error = null),
                      ),
                      const SizedBox(height: 12),
                      MoneyField(
                        controller: _cost,
                        label: 'Costo (material + insumos)',
                        helperText:
                            'Todo lo que gastaste, ej. el vaso. Un insumo que no cobrás va acá, nunca en el total.',
                        onChanged: (_) => setState(() => _error = null),
                      ),
                      const SizedBox(height: 14),
                      Text(
                        'Medio de pago',
                        style: TextStyle(fontSize: 12, color: c.textDim, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final m in paymentMethodLabels.entries)
                            ChoiceChip(
                              label: Text(m.value),
                              selected: _payment == m.key,
                              onSelected: (_) => setState(() => _payment = m.key),
                            ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: Brand.gold.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Ganancia (total − costo)',
                                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: c.text),
                              ),
                            ),
                            Text(
                              formatPrice(profit),
                              style: const TextStyle(
                                fontFamily: 'Orbitron',
                                fontWeight: FontWeight.w800,
                                fontSize: 16,
                                color: Brand.gold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Container(
            decoration: BoxDecoration(
              color: c.surface1,
              border: Border(top: BorderSide(color: c.border)),
            ),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // El error del servidor va junto al botón, donde se mira.
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: InlineError(_error!),
                      )
                    else if (_problem != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: Text(_problem!, style: TextStyle(fontSize: 12, color: c.textDim)),
                        ),
                      ),
                    GoldButton(
                      label: 'Guardar cambios',
                      icon: Icons.check_rounded,
                      loading: _busy,
                      onPressed: canSave ? _save : null,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
