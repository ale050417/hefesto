import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../crecimiento/form_kit.dart';
import 'descuentos_models.dart';
import 'descuentos_providers.dart';

/// Alta o edición de un cupón. Cierra con `true` si guardó. Mismas reglas que
/// el formulario web (el servidor valida igual): código, valor > 0, y si aplica
/// a un producto o categoría, hay que elegirlo.
class CouponFormScreen extends ConsumerStatefulWidget {
  const CouponFormScreen({super.key, this.coupon});

  /// null = cupón nuevo.
  final Coupon? coupon;

  @override
  ConsumerState<CouponFormScreen> createState() => _CouponFormScreenState();
}

class _CouponFormScreenState extends ConsumerState<CouponFormScreen> {
  late final _code = TextEditingController(text: widget.coupon?.code ?? '');
  late final _desc = TextEditingController(text: widget.coupon?.description ?? '');
  late final _value = TextEditingController(
    text: widget.coupon == null ? '' : plainNumber(widget.coupon!.value),
  );
  late final _minPurchase = TextEditingController(
    text: (widget.coupon?.minPurchase ?? 0) > 0 ? plainNumber(widget.coupon!.minPurchase) : '',
  );
  late final _maxUses = TextEditingController(
    text: widget.coupon?.maxUses == null ? '' : '${widget.coupon!.maxUses}',
  );

  late bool _isPercent = widget.coupon?.isPercent ?? true;
  late CouponScope _scope = widget.coupon?.scope ?? CouponScope.all;
  late IdName? _target = widget.coupon?.targetId == null
      ? null
      : IdName(widget.coupon!.targetId!, widget.coupon!.targetLabel ?? 'Elegido');
  late bool _birthdayOnly = widget.coupon?.birthdayOnly ?? false;
  late bool _isActive = widget.coupon?.isActive ?? true;
  late DateTime? _expiresAt = widget.coupon?.expiresAt;

  late final String _initial = _snapshot();
  bool _busy = false;
  String? _error;
  final Map<String, String> _errors = {};

  bool get _edit => widget.coupon != null;

  String _snapshot() => [
        _code.text.trim(),
        _desc.text.trim(),
        _value.text.trim(),
        _minPurchase.text.trim(),
        _maxUses.text.trim(),
        _isPercent,
        _scope.api,
        _target?.id,
        _birthdayOnly,
        _isActive,
        _expiresAt?.millisecondsSinceEpoch,
      ].join('\u0001');

  bool get _dirty => _snapshot() != _initial;

  @override
  void dispose() {
    for (final c in [_code, _desc, _value, _minPurchase, _maxUses]) {
      c.dispose();
    }
    super.dispose();
  }

  void _touch([Object? value]) => setState(() => _error = null);

  void _field(String key) => setState(() {
        _errors.remove(key);
        _error = null;
      });

  Future<void> _pickTarget() async {
    final isProduct = _scope == CouponScope.product;
    CouponOptions opts;
    try {
      opts = await ref.read(adminCouponOptionsProvider.future);
    } catch (e) {
      if (mounted) showToast(context, errorMessage(e));
      return;
    }
    if (!mounted) return;
    final picked = await showOptionPicker(
      context,
      title: isProduct ? 'Elegí el producto' : 'Elegí la categoría',
      options: isProduct ? opts.products : opts.categories,
      selectedId: _target?.id,
      searchHint: isProduct ? 'Buscar producto…' : 'Buscar categoría…',
      emptyText: isProduct ? 'No hay productos cargados.' : 'No hay categorías cargadas.',
    );
    if (picked != null) {
      setState(() {
        _target = picked;
        _errors.remove('target');
        _error = null;
      });
    }
  }

  Future<void> _pickExpiry() async {
    final base = _expiresAt ?? DateTime.now().add(const Duration(days: 30));
    final picked = await pickDay(
      context,
      // El vencimiento es un día (UTC): se muestra con ese mismo día.
      initial: DateTime(base.year, base.month, base.day),
      first: DateTime.now().subtract(const Duration(days: 365)),
      title: 'Vence el',
    );
    if (picked != null) {
      setState(() {
        _expiresAt = DateTime.utc(picked.year, picked.month, picked.day);
        _error = null;
      });
    }
  }

  bool _validate() {
    final errors = <String, String>{};
    if (_code.text.trim().length < 2) errors['code'] = 'Ingresá un código.';
    final value = parseAmount(_value.text);
    if (value == null || value <= 0) {
      errors['value'] = 'Ingresá un valor mayor a 0.';
    } else if (_isPercent && value > 100) {
      errors['value'] = 'El porcentaje no puede superar 100.';
    }
    if (_minPurchase.text.trim().isNotEmpty) {
      final m = parseAmount(_minPurchase.text);
      if (m == null || m < 0) errors['min'] = 'Ingresá un monto válido.';
    }
    if (_maxUses.text.trim().isNotEmpty) {
      final n = int.tryParse(_maxUses.text.trim());
      if (n == null || n <= 0) errors['max'] = 'Ingresá un número entero mayor a 0.';
    }
    if (_scope != CouponScope.all && _target == null) {
      errors['target'] = _scope == CouponScope.product ? 'Elegí el producto.' : 'Elegí la categoría.';
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
    final body = couponBody(
      code: _code.text,
      description: _desc.text,
      isPercent: _isPercent,
      value: parseAmount(_value.text)!,
      minPurchase: parseAmount(_minPurchase.text) ?? 0,
      maxUses: int.tryParse(_maxUses.text.trim()),
      startsAt: widget.coupon?.startsAt,
      expiresAt: _expiresAt,
      isActive: _isActive,
      scope: _scope,
      targetId: _target?.id,
      targetLabel: _target?.name,
      birthdayOnly: _birthdayOnly,
    );
    try {
      final api = ref.read(apiClientProvider);
      if (_edit) {
        await updateCoupon(api, widget.coupon!.id, body);
      } else {
        await createCoupon(api, body);
      }
      if (!mounted) return;
      showToast(context, _edit ? 'Cupón actualizado' : 'Cupón creado');
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
    final previewValue = parseAmount(_value.text) ?? 0;
    // Productos y categorías: se piden al elegir "Un producto" / "Una categoría"
    // y quedan vivos mientras el formulario siga abierto.
    if (_scope != CouponScope.all) ref.watch(adminCouponOptionsProvider);

    return DiscardGuard(
      dirty: _dirty && !_busy,
      child: Scaffold(
        appBar: AppBar(title: Text(_edit ? 'Editar cupón' : 'Crear cupón')),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          children: [
            CouponPreview(
              code: _code.text.trim().toUpperCase(),
              isPercent: _isPercent,
              value: previewValue,
              scopeLabel: switch (_scope) {
                CouponScope.all => 'Toda la compra',
                CouponScope.product => _target?.name ?? 'Un producto',
                CouponScope.category => _target?.name ?? 'Una categoría',
              },
              birthdayOnly: _birthdayOnly,
              minPurchase: parseAmount(_minPurchase.text) ?? 0,
              expiresAt: _expiresAt,
              isActive: _isActive,
            ),
            FormSection(
              title: 'Descuento',
              children: [
                TextField(
                  controller: _code,
                  textCapitalization: TextCapitalization.characters,
                  textInputAction: TextInputAction.next,
                  autocorrect: false,
                  inputFormatters: [
                    FilteringTextInputFormatter.deny(RegExp(r'\s')),
                    _UpperCaseFormatter(),
                  ],
                  style: const TextStyle(fontFamily: 'Orbitron', letterSpacing: 0.8, fontWeight: FontWeight.w700),
                  onChanged: (_) => _field('code'),
                  decoration: InputDecoration(
                    labelText: 'Código del cupón',
                    hintText: 'HEFESTO15',
                    errorText: _errors['code'],
                  ),
                ),
                TextField(
                  controller: _desc,
                  textInputAction: TextInputAction.next,
                  textCapitalization: TextCapitalization.sentences,
                  maxLength: 200,
                  onChanged: _touch,
                  decoration: const InputDecoration(
                    labelText: 'Descripción (opcional)',
                    hintText: '15% en toda la tienda',
                    counterText: '',
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Tipo de descuento', style: TextStyle(fontSize: 12, color: c.textDim, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    ChoiceRow<bool>(
                      options: const [
                        (true, 'Porcentaje (%)', Icons.percent_rounded),
                        (false, 'Monto fijo (\$)', Icons.attach_money_rounded),
                      ],
                      value: _isPercent,
                      onChanged: (v) => setState(() {
                        _isPercent = v;
                        _errors.remove('value');
                        _error = null;
                      }),
                    ),
                  ],
                ),
                TextField(
                  controller: _value,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
                  onChanged: (_) => _field('value'),
                  decoration: InputDecoration(
                    labelText: _isPercent ? 'Valor (%)' : 'Valor (\$)',
                    hintText: _isPercent ? '15' : '2000',
                    helperText: _isPercent ? 'Un número de 1 a 100.' : 'Un monto en pesos.',
                    errorText: _errors['value'],
                    prefixText: _isPercent ? null : '\$ ',
                    suffixText: _isPercent ? '%' : null,
                  ),
                ),
              ],
            ),
            FormSection(
              title: 'Aplica a',
              hint: _scope == CouponScope.all
                  ? 'El descuento se aplica a toda la compra.'
                  : 'El descuento se aplica SOLO a lo elegido.',
              children: [
                ChoiceRow<CouponScope>(
                  options: [
                    (CouponScope.all, 'Todo el carrito', Icons.shopping_cart_outlined),
                    (CouponScope.product, 'Un producto', Icons.view_in_ar_rounded),
                    (CouponScope.category, 'Una categoría', Icons.category_outlined),
                  ],
                  value: _scope,
                  onChanged: (v) => setState(() {
                    if (v != _scope) _target = null;
                    _scope = v;
                    _errors.remove('target');
                    _error = null;
                  }),
                ),
                if (_scope != CouponScope.all)
                  PickerField(
                    label: _scope == CouponScope.product ? 'Producto' : 'Categoría',
                    value: _target?.name,
                    placeholder: _scope == CouponScope.product ? 'Elegí un producto' : 'Elegí una categoría',
                    errorText: _errors['target'],
                    onTap: _pickTarget,
                  ),
                SwitchRow(
                  title: 'Solo en el cumpleaños',
                  subtitle: 'Vale únicamente en la semana del cumpleaños del cliente.',
                  value: _birthdayOnly,
                  onChanged: (v) => setState(() {
                    _birthdayOnly = v;
                    _error = null;
                  }),
                ),
              ],
            ),
            FormSection(
              title: 'Límites',
              children: [
                TextField(
                  controller: _minPurchase,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
                  onChanged: (_) => _field('min'),
                  decoration: InputDecoration(
                    labelText: 'Compra mínima (opcional)',
                    hintText: 'Sin mínimo',
                    prefixText: '\$ ',
                    errorText: _errors['min'],
                  ),
                ),
                TextField(
                  controller: _maxUses,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  onChanged: (_) => _field('max'),
                  decoration: InputDecoration(
                    labelText: 'Usos máximos',
                    hintText: 'Sin límite',
                    helperText: 'Vacío = se puede usar sin límite.',
                    errorText: _errors['max'],
                  ),
                ),
                PickerField(
                  label: 'Vence el',
                  value: _expiresAt == null ? null : formatExpiry(_expiresAt!),
                  placeholder: 'Sin vencimiento',
                  onTap: _pickExpiry,
                  onClear: () => setState(() => _expiresAt = null),
                ),
                SwitchRow(
                  title: 'Cupón activo',
                  subtitle: _isActive ? 'Los clientes pueden usarlo.' : 'Pausado: nadie puede usarlo.',
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
          label: _edit ? 'Guardar cambios' : 'Crear cupón',
          loading: _busy,
          error: _error,
          onPressed: _dirty ? _save : null,
        ),
      ),
    );
  }
}

class _UpperCaseFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue old, TextEditingValue next) =>
      next.copyWith(text: next.text.toUpperCase());
}

/// Vista previa del cupón tal como lo ve el cliente (se actualiza al tipear).
class CouponPreview extends StatelessWidget {
  const CouponPreview({
    super.key,
    required this.code,
    required this.isPercent,
    required this.value,
    required this.scopeLabel,
    required this.birthdayOnly,
    required this.minPurchase,
    required this.expiresAt,
    required this.isActive,
  });
  final String code;
  final bool isPercent;
  final double value;
  final String scopeLabel;
  final bool birthdayOnly;
  final double minPurchase;
  final DateTime? expiresAt;
  final bool isActive;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final big = value <= 0 ? '—' : (isPercent ? '${plainNumber(value)}%' : formatPrice(value));
    return Opacity(
      opacity: isActive ? 1 : 0.6,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Brand.gold.withValues(alpha: 0.4)),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Brand.gold.withValues(alpha: 0.18), Brand.gold.withValues(alpha: 0.04)],
          ),
        ),
        child: Column(
          children: [
            Text(
              isPercent ? 'DESCUENTO' : 'AHORRÁS',
              style: TextStyle(fontSize: 11, letterSpacing: 2, fontWeight: FontWeight.w700, color: c.textFaint),
            ),
            const SizedBox(height: 2),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                big,
                style: const TextStyle(fontFamily: 'Orbitron', fontWeight: FontWeight.w800, fontSize: 40, color: Brand.gold),
              ),
            ),
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Brand.gold.withValues(alpha: 0.5)),
              ),
              child: Text(
                code.isEmpty ? 'TU-CÓDIGO' : code,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontFamily: 'Orbitron',
                  fontWeight: FontWeight.w700,
                  letterSpacing: 2,
                  fontSize: 15,
                  color: code.isEmpty ? c.textFaint : c.text,
                ),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.sell_outlined, size: 14, color: c.textDim),
                const SizedBox(width: 5),
                Flexible(
                  child: Text(scopeLabel, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: c.textDim)),
                ),
              ],
            ),
            if (birthdayOnly || minPurchase > 0 || expiresAt != null || !isActive) ...[
              const SizedBox(height: 10),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 6,
                runSpacing: 6,
                children: [
                  if (birthdayOnly) const _PreviewTag('Cumpleaños'),
                  if (minPurchase > 0) _PreviewTag('Mínimo ${formatPrice(minPurchase)}'),
                  if (expiresAt != null) _PreviewTag('Vence ${formatExpiry(expiresAt!)}'),
                  if (!isActive) const _PreviewTag('Inactivo'),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PreviewTag extends StatelessWidget {
  const _PreviewTag(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: c.border),
      ),
      child: Text(text, style: TextStyle(fontSize: 11, color: c.textDim, fontWeight: FontWeight.w600)),
    );
  }
}
