import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../crecimiento/form_kit.dart';
import 'recompensas_models.dart';
import 'recompensas_providers.dart';
import 'recompensas_widgets.dart';

/// Alta o edición de una recompensa del catálogo. Cierra con `true` si guardó.
class RewardFormScreen extends ConsumerStatefulWidget {
  const RewardFormScreen({super.key, this.reward, this.products = const []});

  /// null = recompensa nueva.
  final Reward? reward;

  /// Productos publicados, para elegir el regalo.
  final List<IdName> products;

  @override
  ConsumerState<RewardFormScreen> createState() => _RewardFormScreenState();
}

class _RewardFormScreenState extends ConsumerState<RewardFormScreen> {
  late final _title = TextEditingController(text: widget.reward?.title ?? '');
  late final _cost = TextEditingController(
    text: widget.reward == null ? '' : '${widget.reward!.costPoints}',
  );
  late final _desc = TextEditingController(text: widget.reward?.description ?? '');
  late final _value = TextEditingController(
    text: widget.reward?.discountValue == null ? '' : plainNumber(widget.reward!.discountValue!),
  );

  late RewardType _type = widget.reward?.type ?? RewardType.discount;
  late bool _isPercent = widget.reward?.discountIsPercent ?? false;
  late bool _isActive = widget.reward?.isActive ?? true;
  late IdName? _product = widget.reward?.productId == null
      ? null
      : IdName(widget.reward!.productId!, widget.reward!.productName ?? 'Producto actual');

  late final String _initial = _snapshot();
  bool _busy = false;
  String? _error;
  final Map<String, String> _errors = {};

  bool get _edit => widget.reward != null;

  String _snapshot() => [
        _title.text.trim(),
        _cost.text.trim(),
        _desc.text.trim(),
        _value.text.trim(),
        _type.api,
        _isPercent,
        _isActive,
        _product?.id,
      ].join('\u0001');

  bool get _dirty => _snapshot() != _initial;

  @override
  void dispose() {
    for (final c in [_title, _cost, _desc, _value]) {
      c.dispose();
    }
    super.dispose();
  }

  void _touch([Object? value]) => setState(() => _error = null);

  void _field(String key) => setState(() {
        _errors.remove(key);
        _error = null;
      });

  Future<void> _pickProduct() async {
    final picked = await showOptionPicker(
      context,
      title: 'Producto de regalo',
      options: widget.products,
      selectedId: _product?.id,
      searchHint: 'Buscar producto…',
      emptyText: 'No hay productos publicados.',
    );
    if (picked != null) {
      setState(() {
        _product = picked;
        _errors.remove('product');
        _error = null;
      });
    }
  }

  bool _validate() {
    final errors = <String, String>{};
    if (_title.text.trim().length < 2) errors['title'] = 'Ingresá un título.';
    final cost = int.tryParse(_cost.text.trim());
    if (cost == null || cost <= 0) errors['cost'] = 'Ingresá el costo en puntos.';
    if (_type == RewardType.discount) {
      final v = parseAmount(_value.text);
      if (v == null || v <= 0) {
        errors['value'] = 'Ingresá el valor del descuento.';
      } else if (_isPercent && v > 100) {
        errors['value'] = 'El porcentaje no puede superar 100.';
      }
    }
    if (_type == RewardType.product && _product == null) {
      errors['product'] = 'Elegí el producto de regalo.';
    }
    setState(() {
      _errors
        ..clear()
        ..addAll(errors);
      // También arriba del botón: el campo marcado puede estar fuera de la vista.
      _error = errors.isEmpty ? null : errors.values.first;
    });
    return errors.isEmpty;
  }

  Future<void> _save() async {
    if (!_validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final body = rewardBody(
      type: _type,
      title: _title.text,
      description: _desc.text,
      costPoints: int.parse(_cost.text.trim()),
      discountValue: parseAmount(_value.text),
      discountIsPercent: _isPercent,
      productId: _product?.id,
      isActive: _isActive,
    );
    try {
      final api = ref.read(apiClientProvider);
      if (_edit) {
        await updateReward(api, widget.reward!.id, body);
      } else {
        await createReward(api, body);
      }
      if (!mounted) return;
      showToast(context, _edit ? 'Recompensa actualizada' : 'Recompensa creada');
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final preview = Reward(
      id: widget.reward?.id ?? 'preview',
      type: _type,
      title: _title.text.trim().isEmpty ? 'Título de la recompensa' : _title.text.trim(),
      description: _desc.text.trim().isEmpty ? null : _desc.text.trim(),
      costPoints: int.tryParse(_cost.text.trim()) ?? 0,
      discountValue: parseAmount(_value.text),
      discountIsPercent: _isPercent,
      productId: _product?.id,
      productName: _product?.name,
      isActive: _isActive,
    );

    return DiscardGuard(
      dirty: _dirty && !_busy,
      child: Scaffold(
        appBar: AppBar(title: Text(_edit ? 'Editar recompensa' : 'Nueva recompensa')),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          children: [
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 8),
              child: Text('Así la ve tu cliente', style: TextStyle(fontSize: 12, color: c.textFaint)),
            ),
            IgnorePointer(
              child: RewardCard(reward: preview, canEdit: false, canDelete: false, onMenu: (_) {}),
            ),
            FormSection(
              title: 'Tipo de recompensa',
              children: [
                ChoiceRow<RewardType>(
                  options: [for (final t in RewardType.values) (t, t.label, t.icon)],
                  value: _type,
                  onChanged: (v) => setState(() {
                    _type = v;
                    _errors
                      ..remove('value')
                      ..remove('product');
                    _error = null;
                  }),
                ),
              ],
            ),
            FormSection(
              title: 'Datos',
              children: [
                TextField(
                  controller: _title,
                  textInputAction: TextInputAction.next,
                  textCapitalization: TextCapitalization.sentences,
                  onChanged: (_) => _field('title'),
                  decoration: InputDecoration(
                    labelText: 'Título',
                    hintText: 'Ej: \$2.000 de descuento',
                    errorText: _errors['title'],
                  ),
                ),
                TextField(
                  controller: _cost,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  onChanged: (_) => _field('cost'),
                  decoration: InputDecoration(
                    labelText: 'Costo en puntos',
                    hintText: '500',
                    suffixText: 'pts',
                    errorText: _errors['cost'],
                  ),
                ),
                TextField(
                  controller: _desc,
                  textInputAction: TextInputAction.done,
                  textCapitalization: TextCapitalization.sentences,
                  maxLength: 200,
                  onChanged: _touch,
                  decoration: const InputDecoration(
                    labelText: 'Descripción (opcional)',
                    hintText: 'Cupón aplicable a cualquier pedido',
                    counterText: '',
                  ),
                ),
              ],
            ),
            if (_type == RewardType.discount)
              FormSection(
                title: 'Valor del descuento',
                hint: 'Al canjear, el cliente recibe un cupón de un solo uso con este valor.',
                children: [
                  ChoiceRow<bool>(
                    options: const [
                      (false, 'Monto fijo (\$)', Icons.attach_money_rounded),
                      (true, 'Porcentaje (%)', Icons.percent_rounded),
                    ],
                    value: _isPercent,
                    onChanged: (v) => setState(() {
                      _isPercent = v;
                      _errors.remove('value');
                      _error = null;
                    }),
                  ),
                  TextField(
                    controller: _value,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
                    onChanged: (_) => _field('value'),
                    decoration: InputDecoration(
                      labelText: _isPercent ? 'Porcentaje' : 'Monto',
                      hintText: _isPercent ? '15' : '2000',
                      prefixText: _isPercent ? null : '\$ ',
                      suffixText: _isPercent ? '%' : null,
                      errorText: _errors['value'],
                    ),
                  ),
                ],
              )
            else if (_type == RewardType.product)
              FormSection(
                title: 'Producto de regalo',
                hint: 'Al canjear, se descuentan los puntos y coordinás la entrega con el cliente.',
                children: [
                  PickerField(
                    label: 'Producto',
                    value: _product?.name,
                    placeholder: 'Elegí un producto',
                    errorText: _errors['product'],
                    onTap: _pickProduct,
                  ),
                ],
              )
            else
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 18, 4, 0),
                child: Text(
                  'Genera un beneficio de envío gratis al canjearse. Lo coordinás con el cliente por WhatsApp.',
                  style: TextStyle(fontSize: 12.5, color: c.textFaint, height: 1.4),
                ),
              ),
            FormSection(
              title: 'Visibilidad',
              children: [
                SwitchRow(
                  title: 'Recompensa activa',
                  subtitle: _isActive
                      ? 'Los clientes la ven en "Canjear puntos".'
                      : 'Pausada: los clientes no la ven ni la pueden canjear.',
                  value: _isActive,
                  onChanged: (v) => setState(() {
                    _isActive = v;
                    _error = null;
                  }),
                ),
              ],
            ),
          ],
        ),
        bottomNavigationBar: SaveBar(
          label: _edit ? 'Guardar cambios' : 'Crear recompensa',
          loading: _busy,
          error: _error,
          onPressed: _dirty ? _save : null,
        ),
      ),
    );
  }
}
