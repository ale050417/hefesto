import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/format.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import 'catalog_picker.dart';
import 'filament_type_picker.dart';
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

  /// Tipo de filamento del que sale el precio; null = sin tipo (precio propio).
  String? _typeId;
  late final TextEditingController _stock;
  late final TextEditingController _spool;
  late final TextEditingController _cost;
  late final TextEditingController _threshold;

  static const _fixFieldsMessage = 'Revisá los datos marcados en rojo.';

  bool _saving = false;
  bool _submitted = false;

  /// Aviso sobre el botón de guardar: el rechazo del servidor o, si no pasó la
  /// validación, que hay campos para corregir.
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
    _typeId = f?.typeId;
    _stock = TextEditingController(text: f == null ? '0' : gramsField(f.stockGrams));
    _spool = TextEditingController(text: gramsField(f?.spoolGrams ?? 1000));
    _cost = TextEditingController(text: gramsField(f?.costPerKg ?? 18000));
    _threshold = TextEditingController(text: gramsField(f?.alertThresholdGrams ?? 1000));
    _initial = _snapshot();
  }

  /// Lo cargado en el formulario, para saber si se tocó algo.
  late final String _initial;
  String _snapshot() =>
      [_material, _color, _brand, _diameter, _typeId ?? '', _stock.text, _spool.text, _cost.text, _threshold.text]
          .join('|');

  /// ¿Hay algo cambiado que se perdería al salir?
  bool get _hasUnsaved => !_saving && _snapshot() != _initial;

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
        // Con tipo, el costo no se tipea (lo pone el tipo): no se valida.
        cost: _typeId != null ? '0' : _cost.text,
        threshold: _threshold.text,
        isCreate: !_isEdit,
      );

  /// El tipo elegido, si la lista de tipos ya llegó.
  FilamentType? get _type => ref.read(filamentTypesProvider).value?.typeOf(_typeId);

  /// ¿Cambió algo respecto de lo cargado? (en el alta siempre se puede guardar)
  bool get _dirty {
    final f = widget.filament;
    if (f == null) return true;
    return _material != f.material ||
        _color != f.color ||
        _brand != f.brand ||
        _diameter != f.diameter ||
        _typeId != f.typeId ||
        parseNumber(_spool.text) != f.spoolGrams ||
        (_typeId == null && parseNumber(_cost.text) != f.costPerKg) ||
        parseNumber(_threshold.text) != f.alertThresholdGrams;
  }

  FilamentoDraft _draft() => FilamentoDraft(
        material: _material.trim(),
        color: _color.trim(),
        brand: _brand.trim(),
        diameter: _diameter.trim(),
        stockGrams: parseNumber(_stock.text.isEmpty ? '0' : _stock.text) ?? 0,
        spoolGrams: parseNumber(_spool.text) ?? 0,
        // Con tipo el servidor ignora este costo y usa el del tipo.
        costPerKg: _typeId != null
            ? (_type?.costPerKg ?? widget.filament?.costPerKg ?? 0)
            : (parseNumber(_cost.text.isEmpty ? '0' : _cost.text) ?? 0),
        alertThresholdGrams: parseNumber(_threshold.text.isEmpty ? '0' : _threshold.text) ?? 0,
        typeId: _typeId,
      );

  Future<void> _pickType() async {
    final picked = await showFilamentTypePicker(context, current: _typeId);
    if (picked == null || !mounted) return;
    setState(() {
      _typeId = picked.typeId;
      _serverError = null;
    });
  }

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
      final api = ref.read(filamentosApiProvider);
      if (_isEdit) {
        await api.update(widget.filament!.id, _draft());
      } else {
        await api.create(_draft());
      }
      invalidateFilamentos(container);
      if (mounted) popIfCurrent(context, true);
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
    final type = ref.watch(filamentTypesProvider).value?.typeOf(_typeId);
    final diameters = catalog?.diameters ?? const ['1.75', '2.85', '—'];
    final diaOptions = {...diameters, if (_diameter.isNotEmpty) _diameter}.toList();
    final canSave = _dirty && !_saving;

    final scaffold = Scaffold(
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
                  // El precio se carga una vez por tipo (pedido de Agustín,
                  // 2026-11-24): con tipo, el costo de este carrete es el suyo.
                  FilamentTypeField(type: type, hasType: _typeId != null, onTap: _pickType),
                  const SizedBox(height: 14),
                  if (_typeId != null)
                    InputDecorator(
                      key: const ValueKey('cost-from-type'),
                      decoration: InputDecoration(
                        labelText: 'Costo por kg',
                        enabled: false,
                        helperText: type != null
                            ? 'Lo pone el tipo «${type.name}». Se cambia en «Tipos y precios».'
                            : 'Lo pone el tipo de este carrete.',
                        helperMaxLines: 3,
                        helperStyle: TextStyle(color: c.textFaint, fontSize: 11.5),
                      ),
                      child: Text(
                        formatPrice(type?.costPerKg ?? widget.filament?.costPerKg ?? 0),
                        style: TextStyle(color: c.textDim, fontSize: 15),
                      ),
                    )
                  else
                    _numberField(
                      _cost,
                      'Costo por kg',
                      'cost',
                      prefix: r'$ ',
                      helper: 'Sirve para valorizar el stock y calcular lo que cuestan las fallas.',
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
                    label: _isEdit ? 'Guardar cambios' : 'Agregar filamento',
                    icon: Icons.check_rounded,
                    loading: _saving,
                    onPressed: canSave ? _save : null,
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
