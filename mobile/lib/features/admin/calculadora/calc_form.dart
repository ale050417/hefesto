import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_widgets.dart';
import '../analisis/analysis_widgets.dart';
import '../analisis/ar_number.dart';
import '../analisis/number_field.dart';
import '../reportes/reportes_sections.dart' show formatGrams;
import 'calc_logic.dart';
import 'calculadora_api.dart';
import 'calculadora_models.dart';

/// Formulario de un presupuesto con cotización en vivo: cada cambio (con
/// debounce) le pide el costo y el precio al SERVIDOR, que usa el mismo
/// `computeQuote` que la web. La app no calcula nada.
class CalcForm extends ConsumerStatefulWidget {
  const CalcForm({super.key, required this.overview, required this.canSave, this.onSaved});
  final CalcOverview overview;

  /// Permiso `calculadora/crear`.
  final bool canSave;
  final VoidCallback? onSaved;

  @override
  ConsumerState<CalcForm> createState() => _CalcFormState();
}

class _CalcFormState extends ConsumerState<CalcForm> {
  static const _debounce = Duration(milliseconds: 350);

  final _name = TextEditingController();
  final _customer = TextEditingController();
  final _grams = TextEditingController();
  final _hours = TextEditingController();
  final _minutes = TextEditingController();
  final _notes = TextEditingController();

  String? _filamentId;
  String? _presetId;

  CalcQuote? _quote;
  bool _quoting = false;
  String? _quoteError;
  bool _saving = false;
  String? _saveError;
  Timer? _timer;
  int _seq = 0;

  CalcOverview get _o => widget.overview;

  @override
  void initState() {
    super.initState();
    _filamentId = _o.filaments.isEmpty ? null : _o.filaments.first.id;
    _presetId = _o.presetOptions.isEmpty ? null : _o.presetOptions.first.id;
  }

  @override
  void didUpdateWidget(CalcForm old) {
    super.didUpdateWidget(old);
    // Si el filamento o el tipo elegido desaparecieron del servidor, se re-elige.
    if (_filamentId != null && !_o.filaments.any((f) => f.id == _filamentId)) {
      _filamentId = _o.filaments.isEmpty ? null : _o.filaments.first.id;
    }
    if (_presetId != null && !_o.presetOptions.any((p) => p.id == _presetId)) {
      _presetId = _o.presetOptions.isEmpty ? null : _o.presetOptions.first.id;
    }
    if (old.overview.config != widget.overview.config) _scheduleQuote();
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in [_name, _customer, _grams, _hours, _minutes, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  CalcFilament? get _filament {
    for (final f in _o.filaments) {
      if (f.id == _filamentId) return f;
    }
    return null;
  }

  bool get _fieldsOk =>
      validateArNumber(_grams.text, required: false, min: 0) == null &&
      validateArNumber(_hours.text, required: false, min: 0, maxDecimals: 0) == null &&
      validateArNumber(_minutes.text, required: false, min: 0, max: 59, maxDecimals: 0) == null;

  double get _gramsValue => parseArNumber(_grams.text) ?? 0;
  double get _hoursValue => totalHours(parseArNumber(_hours.text), parseArNumber(_minutes.text));
  bool get _hasData => hasQuoteData(_gramsValue, _hoursValue);

  QuoteRequest? _request() {
    if (_filamentId == null || _presetId == null || !_fieldsOk || !_hasData) return null;
    return QuoteRequest(
      presetId: _presetId!,
      filamentId: _filamentId!,
      grams: _gramsValue,
      hours: _hoursValue,
    );
  }

  void _scheduleQuote() {
    _timer?.cancel();
    final req = _request();
    if (req == null) {
      _seq++; // descarta lo que esté en vuelo
      setState(() {
        _quote = null;
        _quoting = false;
        _quoteError = null;
      });
      return;
    }
    setState(() {
      _quoting = true;
      _quoteError = null;
    });
    _timer = Timer(_debounce, () async {
      final seq = ++_seq;
      try {
        final q = await ref.read(calculadoraApiProvider).quote(req);
        if (!mounted || seq != _seq) return;
        setState(() {
          _quote = q;
          _quoting = false;
        });
      } catch (e) {
        if (!mounted || seq != _seq) return;
        setState(() {
          _quote = null;
          _quoting = false;
          _quoteError = errorMessage(e);
        });
      }
    });
  }

  bool get _canSaveNow =>
      widget.canSave &&
      !_saving &&
      _name.text.trim().isNotEmpty &&
      _request() != null &&
      _quote != null &&
      !_quoting;

  Future<void> _save() async {
    final req = _request();
    if (req == null || !_canSaveNow) return;
    setState(() {
      _saving = true;
      _saveError = null;
    });
    try {
      await ref.read(calculadoraApiProvider).saveCalc(
            name: _name.text.trim(),
            customer: _customer.text.trim(),
            filamentId: req.filamentId,
            grams: req.grams,
            hours: req.hours,
            presetId: req.presetId,
            notes: _notes.text.trim(),
          );
      ref.invalidate(calculadoraProvider);
      if (!mounted) return;
      showSnack(context, 'Presupuesto guardado en el historial');
      _name.clear();
      _customer.clear();
      _grams.clear();
      _hours.clear();
      _minutes.clear();
      _notes.clear();
      _seq++;
      setState(() {
        _quote = null;
        _quoting = false;
      });
      widget.onSaved?.call();
    } catch (e) {
      if (mounted) setState(() => _saveError = errorMessage(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickFilament() async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => FilamentPickerSheet(filaments: _o.filaments, selectedId: _filamentId),
    );
    if (picked != null && picked != _filamentId) {
      setState(() => _filamentId = picked);
      _scheduleQuote();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final f = _filament;
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            children: [
              AdminCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const CardHeader('Nuevo presupuesto', subtitle: 'El precio se actualiza solo mientras cargás los datos.'),
                    TextField(
                      controller: _name,
                      onChanged: (_) => setState(() {}),
                      textCapitalization: TextCapitalization.sentences,
                      maxLength: 120,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Nombre de la pieza',
                        hintText: 'Ej: Soporte auriculares',
                        counterText: '',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _customer,
                      textCapitalization: TextCapitalization.words,
                      maxLength: 120,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(labelText: 'Cliente (opcional)', counterText: ''),
                    ),
                    const SizedBox(height: 16),
                    if (_o.filaments.isEmpty)
                      const NoticeBanner(
                        'No hay filamentos cargados. Cargá uno en Filamentos para poder cotizar.',
                        icon: Icons.warning_amber_rounded,
                        color: Brand.warning,
                      )
                    else
                      _FilamentField(filament: f, onTap: _pickFilament),
                    const SizedBox(height: 16),
                    ArNumberField(
                      controller: _grams,
                      label: 'Gramos utilizados',
                      suffix: 'g',
                      required: false,
                      hint: '0',
                      onChanged: (_) => _scheduleQuote(),
                    ),
                    const SizedBox(height: 14),
                    Text('Tiempo de impresión',
                        style: TextStyle(fontSize: 12.5, color: c.textDim, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: ArNumberField(
                            controller: _hours,
                            label: 'Horas',
                            suffix: 'h',
                            maxDecimals: 0,
                            required: false,
                            hint: '0',
                            onChanged: (_) => _scheduleQuote(),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ArNumberField(
                            controller: _minutes,
                            label: 'Minutos',
                            suffix: 'min',
                            maxDecimals: 0,
                            max: 59,
                            required: false,
                            hint: '0',
                            onChanged: (_) => _scheduleQuote(),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text('Tipo de producto',
                        style: TextStyle(fontSize: 12.5, color: c.textDim, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    if (_o.presetOptions.isEmpty)
                      Text(
                        _o.isAdmin
                            ? 'No hay tipos cargados. Creá uno desde "Tipos y márgenes".'
                            : 'No hay tipos disponibles. Avisale al administrador.',
                        style: TextStyle(fontSize: 12.5, color: c.textFaint),
                      )
                    else
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        children: [
                          for (final p in _o.presetOptions)
                            ChoiceChip(
                              label: Text(_presetLabel(p)),
                              selected: p.id == _presetId,
                              onSelected: (_) {
                                setState(() => _presetId = p.id);
                                _scheduleQuote();
                              },
                            ),
                        ],
                      ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _notes,
                      minLines: 2,
                      maxLines: 4,
                      maxLength: 500,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: const InputDecoration(
                        labelText: 'Observaciones (opcional)',
                        hintText: 'Notas internas del presupuesto…',
                        counterText: '',
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              if (_o.isAdmin && _quote != null && _quote!.detail)
                BreakdownCard(quote: _quote!, grams: _gramsValue, hours: _hoursValue),
              if (_quoteError != null) NoticeBanner(_quoteError!, icon: Icons.error_outline_rounded, color: Brand.danger),
              if (_saveError != null) ...[
                const SizedBox(height: 10),
                NoticeBanner(_saveError!, icon: Icons.error_outline_rounded, color: Brand.danger),
              ],
              if (!widget.canSave)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text('Solo podés cotizar: tu rol no puede guardar en el historial.',
                      style: TextStyle(fontSize: 12, color: c.textFaint)),
                ),
            ],
          ),
        ),
        _PriceBar(
          quote: _quote,
          quoting: _quoting,
          hasData: _request() != null,
          canSave: widget.canSave,
          saving: _saving,
          onSave: _canSaveNow ? _save : null,
          hint: _hintForBar(),
        ),
      ],
    );
  }

  String _presetLabel(CalcPreset p) {
    if (!_o.isAdmin) return p.name;
    for (final full in _o.presets) {
      if (full.id == p.id && full.marginPct != null) {
        return '${p.name} · ${formatArNumber(full.marginPct!, maxDecimals: 2)}%';
      }
    }
    return p.name;
  }

  String? _hintForBar() {
    if (_filamentId == null) return 'Elegí un filamento.';
    if (_presetId == null) return 'Elegí un tipo de producto.';
    if (!_fieldsOk) return 'Revisá los números marcados.';
    if (!_hasData) return 'Cargá gramos u horas.';
    if (widget.canSave && _name.text.trim().isEmpty && _quote != null) return 'Poné un nombre para guardarlo.';
    return null;
  }
}

class _FilamentField extends StatelessWidget {
  const _FilamentField({required this.filament, required this.onTap});
  final CalcFilament? filament;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final f = filament;
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: InputDecorator(
        decoration: const InputDecoration(labelText: 'Filamento', suffixIcon: Icon(Icons.expand_more_rounded)),
        child: f == null
            ? Text('Elegí un filamento', style: TextStyle(color: c.textFaint))
            : Row(
                children: [
                  _Swatch(f.hex),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(f.label, maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                        Text(
                          f.costPerKg > 0
                              ? '${formatArMoney(f.costPerKg, decimals: 0)} por kg'
                              : 'Sin costo por kg (editalo en Filamentos)',
                          style: TextStyle(fontSize: 11.5, color: f.costPerKg > 0 ? c.textFaint : Brand.warning),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

Color _hexOr(String? hex, Color fallback) {
  final h = (hex ?? '').replaceFirst('#', '').trim();
  if (h.length != 6) return fallback;
  final v = int.tryParse(h, radix: 16);
  return v == null ? fallback : Color(0xFF000000 | v);
}

class _Swatch extends StatelessWidget {
  const _Swatch(this.hex);
  final String? hex;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Container(
      width: 26,
      height: 26,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: _hexOr(hex, c.surface3),
        border: Border.all(color: c.border, width: 1.5),
      ),
      child: Center(child: Container(width: 8, height: 8, decoration: BoxDecoration(shape: BoxShape.circle, color: c.bg))),
    );
  }
}

/// Selector de filamento (con búsqueda): cada uno muestra SU costo por kg.
class FilamentPickerSheet extends StatefulWidget {
  const FilamentPickerSheet({super.key, required this.filaments, this.selectedId});
  final List<CalcFilament> filaments;
  final String? selectedId;

  @override
  State<FilamentPickerSheet> createState() => _FilamentPickerSheetState();
}

class _FilamentPickerSheetState extends State<FilamentPickerSheet> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final term = _q.trim().toLowerCase();
    final list = widget.filaments.where((f) => term.isEmpty || f.label.toLowerCase().contains(term)).toList();
    final height = MediaQuery.sizeOf(context).height * 0.7;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: height,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: TextField(
                onChanged: (v) => setState(() => _q = v),
                decoration: const InputDecoration(hintText: 'Buscar material, color o marca…', prefixIcon: Icon(Icons.search_rounded)),
              ),
            ),
            Expanded(
              child: list.isEmpty
                  ? Center(child: Text('Sin resultados', style: TextStyle(color: c.textDim)))
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(8, 0, 8, 16),
                      itemCount: list.length,
                      itemBuilder: (_, i) {
                        final f = list[i];
                        final sel = f.id == widget.selectedId;
                        return ListTile(
                          leading: _Swatch(f.hex),
                          title: Text(f.label, maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                          subtitle: Text(f.costPerKg > 0 ? '${formatArMoney(f.costPerKg, decimals: 0)} por kg' : 'Sin costo por kg'),
                          trailing: sel ? const Icon(Icons.check_circle_rounded, color: Brand.gold) : null,
                          onTap: () => Navigator.of(context).pop(f.id),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Desglose del costo (solo admin): material, luz, desgaste y margen de error.
class BreakdownCard extends StatelessWidget {
  const BreakdownCard({super.key, required this.quote, required this.grams, required this.hours});
  final CalcQuote quote;
  final double grams;
  final double hours;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final q = quote;
    final rows = <(String, IconData, Color, double, String?)>[
      ('Costo del material', Icons.inventory_2_outlined, Brand.info, q.material,
          q.costPerKg > 0 ? '${formatArMoney(q.costPerKg, decimals: 0)}/kg' : null),
      ('Electricidad', Icons.bolt_rounded, Brand.warning, q.electricidad, null),
      ('Desgaste de la impresora', Icons.print_outlined, Color.lerp(Brand.info, Brand.danger, 0.5)!, q.desgaste, null),
      ('Margen de error', Icons.warning_amber_rounded, Brand.danger, q.margenError, null),
    ];
    final maxV = rows.fold<double>(1, (a, r) => r.$4 > a ? r.$4 : a);
    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CardHeader('Desglose del costo', subtitle: '${formatGrams(grams)} · ${formatDuration(hours)} de impresión'),
          for (final r in rows)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(color: r.$3.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(9)),
                        child: Icon(r.$2, size: 16, color: r.$3),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(r.$1, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                            if (r.$5 != null) Text(r.$5!, style: TextStyle(color: c.textFaint, fontSize: 11.5)),
                          ],
                        ),
                      ),
                      Text(formatArMoney(r.$4), style: const TextStyle(fontFamily: 'Orbitron', fontWeight: FontWeight.w700, fontSize: 13)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: Stack(
                      children: [
                        Container(height: 5, color: c.surface3),
                        FractionallySizedBox(
                          widthFactor: (r.$4 / maxV).clamp(0.03, 1.0),
                          child: Container(height: 5, color: r.$3),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          Divider(color: c.border, height: 20),
          Row(
            children: [
              Expanded(child: Text('Costo total de producción', style: TextStyle(fontSize: 13.5, color: c.textDim, fontWeight: FontWeight.w600))),
              Text(formatArMoney(q.costoTotal),
                  style: const TextStyle(fontFamily: 'Orbitron', fontWeight: FontWeight.w800, fontSize: 16)),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Ganancia ${formatArMoney(q.ganancia)} · margen ${formatArNumber(q.marginPct, maxDecimals: 2)}%',
            style: const TextStyle(fontSize: 12.5, color: Brand.success, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

/// Barra fija de abajo: precio final sugerido + guardar.
class _PriceBar extends StatelessWidget {
  const _PriceBar({
    required this.quote,
    required this.quoting,
    required this.hasData,
    required this.canSave,
    required this.saving,
    required this.onSave,
    required this.hint,
  });

  final CalcQuote? quote;
  final bool quoting;
  final bool hasData;
  final bool canSave;
  final bool saving;
  final VoidCallback? onSave;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final q = quote;
    final status = quoting
        ? 'Calculando…'
        : (hint ?? (q != null ? 'Precio listo para cotizar al cliente.' : 'Completá los datos.'));
    return Material(
      color: c.surface1,
      child: Container(
        decoration: BoxDecoration(border: Border(top: BorderSide(color: c.border))),
        child: SafeArea(
          top: false,
          minimum: const EdgeInsets.only(bottom: 8),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('PRECIO FINAL SUGERIDO',
                          style: TextStyle(fontFamily: 'Orbitron', fontSize: 9.5, letterSpacing: 1.4, fontWeight: FontWeight.w700, color: c.textFaint)),
                      const SizedBox(height: 2),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Text(
                          q == null ? '—' : formatArMoney(q.precioFinal),
                          style: TextStyle(
                            fontFamily: 'Orbitron',
                            fontWeight: FontWeight.w800,
                            fontSize: 26,
                            color: q == null ? c.textFaint : Brand.gold,
                          ),
                        ),
                      ),
                      Text(status, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11.5, color: c.textFaint)),
                    ],
                  ),
                ),
                if (canSave) ...[
                  const SizedBox(width: 12),
                  GoldButton(
                    label: 'Guardar',
                    icon: Icons.save_alt_rounded,
                    expand: false,
                    loading: saving,
                    onPressed: onSave,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
