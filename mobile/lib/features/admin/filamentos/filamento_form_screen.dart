import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import 'catalog_picker.dart';
import 'filamentos_api.dart';
import 'filamentos_format.dart';
import 'filamentos_models.dart';
import 'shared_widgets.dart';

/// Validación del formulario (mismas reglas que `filamentSchema` del servidor,
/// que igual vuelve a validar). Devuelve el mensaje por campo; vacío = válido.
/// Pura para poder probarla sin dibujar nada.
Map<String, String> validateFilamentoForm({
  required String material,
  required String color,
  required String brand,
  required String diameter,
  required String stock,
  required String spool,
  required String cost,
  required String threshold,
  required bool isCreate,
}) {
  final errors = <String, String>{};
  if (material.trim().isEmpty) errors['material'] = 'Elegí el material.';
  if (color.trim().isEmpty) errors['color'] = 'Elegí el color.';
  if (brand.trim().isEmpty) errors['brand'] = 'Elegí la marca.';
  if (diameter.trim().isEmpty) errors['diameter'] = 'Elegí el diámetro.';
  if (isCreate) {
    final v = parseNumber(stock.isEmpty ? '0' : stock);
    if (v == null) {
      errors['stock'] = 'Ingresá un número.';
    } else if (v < 0) {
      errors['stock'] = 'El stock no puede ser negativo.';
    }
  }
  final s = parseNumber(spool);
  if (s == null || s <= 0) errors['spool'] = 'El tamaño del carrete tiene que ser mayor a 0.';
  final c = parseNumber(cost.isEmpty ? '0' : cost);
  if (c == null) {
    errors['cost'] = 'Ingresá un número.';
  } else if (c < 0) {
    errors['cost'] = 'El costo no puede ser negativo.';
  }
  final t = parseNumber(threshold.isEmpty ? '0' : threshold);
  if (t == null) {
    errors['threshold'] = 'Ingresá un número.';
  } else if (t < 0) {
    errors['threshold'] = 'El umbral no puede ser negativo.';
  }
  return errors;
}

/// Alta o edición de un carrete. Con [filament] edita (sin stock: el stock se
/// mueve con "Ajustar stock" para que quede en el historial); sin él, da de alta
/// con su stock inicial. Al guardar se cierra devolviendo `true`.
class FilamentoFormScreen extends ConsumerStatefulWidget {
  const FilamentoFormScreen({super.key, this.filament});
  final Filamento? filament;

  @override
  ConsumerState<FilamentoFormScreen> createState() => _FilamentoFormScreenState();
}

class _FilamentoFormScreenState extends ConsumerState<FilamentoFormScreen> {
  late String _material;
  late String _color;
  late String _brand;
  late String _diameter;
  late final TextEditingController _stock;
  late final TextEditingController _spool;
  late final TextEditingController _cost;
  late final TextEditingController _threshold;

  bool _saving = false;
  bool _submitted = false;
  String? _serverError;

  bool get _isEdit => widget.filament != null;

  @override
  void initState() {
    super.initState();
    final f = widget.filament;
    // Mismos valores por defecto que el alta de la web.
    _material = f?.material ?? 'PLA';
    _color = f?.color ?? 'Negro';
    _brand = f?.brand ?? 'Grilon3';
    _diameter = (f?.diameter.isNotEmpty ?? false) ? f!.diameter : '1.75';
    _stock = TextEditingController(text: f == null ? '0' : gramsField(f.stockGrams));
    _spool = TextEditingController(text: gramsField(f?.spoolGrams ?? 1000));
    _cost = TextEditingController(text: gramsField(f?.costPerKg ?? 18000));
    _threshold = TextEditingController(text: gramsField(f?.alertThresholdGrams ?? 1000));
  }

  @override
  void dispose() {
    _stock.dispose();
    _spool.dispose();
    _cost.dispose();
    _threshold.dispose();
    super.dispose();
  }

  Map<String, String> get _errors => validateFilamentoForm(
        material: _material,
        color: _color,
        brand: _brand,
        diameter: _diameter,
        stock: _stock.text,
        spool: _spool.text,
        cost: _cost.text,
        threshold: _threshold.text,
        isCreate: !_isEdit,
      );

  /// ¿Cambió algo respecto de lo cargado? (en el alta siempre se puede guardar)
  bool get _dirty {
    final f = widget.filament;
    if (f == null) return true;
    return _material != f.material ||
        _color != f.color ||
        _brand != f.brand ||
        _diameter != f.diameter ||
        parseNumber(_spool.text) != f.spoolGrams ||
        parseNumber(_cost.text) != f.costPerKg ||
        parseNumber(_threshold.text) != f.alertThresholdGrams;
  }

  FilamentoDraft _draft() => FilamentoDraft(
        material: _material.trim(),
        color: _color.trim(),
        brand: _brand.trim(),
        diameter: _diameter.trim(),
        stockGrams: parseNumber(_stock.text.isEmpty ? '0' : _stock.text) ?? 0,
        spoolGrams: parseNumber(_spool.text) ?? 0,
        costPerKg: parseNumber(_cost.text.isEmpty ? '0' : _cost.text) ?? 0,
        alertThresholdGrams: parseNumber(_threshold.text.isEmpty ? '0' : _threshold.text) ?? 0,
      );

  Future<void> _pick(CatalogKind kind) async {
    final current = switch (kind) {
      CatalogKind.color => _color,
      CatalogKind.brand => _brand,
      CatalogKind.material => _material,
    };
    final picked = await showCatalogPicker(context, kind: kind, current: current);
    if (picked == null || !mounted) return;
    setState(() {
      switch (kind) {
        case CatalogKind.color:
          _color = picked;
        case CatalogKind.brand:
          _brand = picked;
        case CatalogKind.material:
          _material = picked;
      }
      _serverError = null;
    });
  }

  Future<void> _save() async {
    setState(() {
      _submitted = true;
      _serverError = null;
    });
    if (_errors.isNotEmpty) return;
    setState(() => _saving = true);
    try {
      final api = ref.read(filamentosApiProvider);
      if (_isEdit) {
        await api.update(widget.filament!.id, _draft());
      } else {
        await api.create(_draft());
      }
      invalidateFilamentos(ref);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _serverError = e.message);
    } catch (_) {
      if (mounted) setState(() => _serverError = 'No pudimos guardar. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _numberField(
    TextEditingController ctl,
    String label,
    String errorKey, {
    String? suffix,
    String? prefix,
    String? helper,
  }) {
    final err = _submitted ? _errors[errorKey] : null;
    return TextField(
      controller: ctl,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
      onChanged: (_) => setState(() => _serverError = null),
      decoration: InputDecoration(
        labelText: label,
        suffixText: suffix,
        prefixText: prefix,
        helperText: helper,
        helperMaxLines: 2,
        helperStyle: TextStyle(color: context.hc.textFaint, fontSize: 11.5),
        errorText: err,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final catalog = ref.watch(filamentCatalogProvider).value;
    final diameters = catalog?.diameters ?? const ['1.75', '2.85', '—'];
    final diaOptions = {...diameters, if (_diameter.isNotEmpty) _diameter}.toList();
    final canSave = _dirty && !_saving;

    return Scaffold(
      appBar: AppBar(title: Text(_isEdit ? 'Editar filamento' : 'Nuevo filamento')),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  CatalogField(
                    kind: CatalogKind.material,
                    value: _material,
                    errorText: _submitted ? _errors['material'] : null,
                    onTap: () => _pick(CatalogKind.material),
                  ),
                  const SizedBox(height: 14),
                  CatalogField(
                    kind: CatalogKind.color,
                    value: _color,
                    hex: catalog?.hexOf(_color) ?? widget.filament?.hex,
                    errorText: _submitted ? _errors['color'] : null,
                    onTap: () => _pick(CatalogKind.color),
                  ),
                  const SizedBox(height: 14),
                  CatalogField(
                    kind: CatalogKind.brand,
                    value: _brand,
                    errorText: _submitted ? _errors['brand'] : null,
                    onTap: () => _pick(CatalogKind.brand),
                  ),
                  const SizedBox(height: 18),
                  Text('Diámetro (mm)', style: TextStyle(fontSize: 12.5, color: c.textDim)),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final d in diaOptions)
                        PickChip(
                          label: d,
                          selected: _diameter == d,
                          onTap: () => setState(() => _diameter = d),
                        ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  if (_isEdit)
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: c.surface2,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: c.border),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.info_outline_rounded, size: 18, color: c.textDim),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Hoy hay ${formatGrams(widget.filament!.stockGrams)}. Para cambiar el '
                              'stock usá «Ajustar stock» en el detalle: así queda en el historial.',
                              style: TextStyle(fontSize: 12.5, color: c.textDim, height: 1.35),
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    _numberField(
                      _stock,
                      'Stock inicial',
                      'stock',
                      suffix: 'g',
                      helper: 'Lo que hay hoy en este carrete.',
                    ),
                  const SizedBox(height: 14),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: _numberField(_spool, 'Carrete', 'spool', suffix: 'g')),
                      const SizedBox(width: 12),
                      Expanded(child: _numberField(_threshold, 'Alerta', 'threshold', suffix: 'g')),
                    ],
                  ),
                  const SizedBox(height: 14),
                  _numberField(
                    _cost,
                    'Costo por kg',
                    'cost',
                    prefix: r'$ ',
                    helper: 'Sirve para valorizar el stock y calcular lo que cuestan las fallas.',
                  ),
                  if (_serverError != null) ...[
                    const SizedBox(height: 16),
                    InlineError(_serverError!),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: GoldButton(
                label: _isEdit ? 'Guardar cambios' : 'Agregar filamento',
                icon: Icons.check_rounded,
                loading: _saving,
                onPressed: canSave ? _save : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
