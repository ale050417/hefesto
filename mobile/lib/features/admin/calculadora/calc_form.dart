import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import '../admin_widgets.dart';
import '../analisis/analysis_widgets.dart';
import '../analisis/ar_number.dart';
import '../analisis/number_field.dart';
import '../reportes/reportes_sections.dart' show formatGrams;
import 'calc_extras_api.dart';
import 'calc_logic.dart';
import 'calculadora_api.dart';
import 'calculadora_models.dart';
import 'filament_choices.dart';
import 'new_preset_dialog.dart';

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

  /// Lo elegido en "Filamento": un carrete sin tipo o, si se eligió un TIPO,
  /// el carrete que lo representa (ver `filament_choices.dart`).
  String? _filamentId;
  String? _presetId;

  /// Tipo recién creado con "Nuevo tipo": se muestra y queda elegido aunque la
  /// lista del servidor todavía no lo traiga.
  CalcPreset? _createdPreset;

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
    _filamentId = firstChoiceValue(_o.filaments);
    _presetId = _o.presetOptions.isEmpty ? null : _o.presetOptions.first.id;
  }

  List<CalcPreset> get _presetOptions => presetOptionsWith(_o.presetOptions, _createdPreset);

  @override
  void didUpdateWidget(CalcForm old) {
    super.didUpdateWidget(old);
    // Si el filamento o el tipo elegido desaparecieron del servidor, se re-elige.
    // (Si al carrete elegido le pusieron un tipo, queda elegido ese tipo.)
    if (_filamentId != null) {
      _filamentId = choiceValueFor(_o.filaments, _filamentId) ?? firstChoiceValue(_o.filaments);
    }
    if (_createdPreset != null && _o.presetOptions.any((p) => p.id == _createdPreset!.id)) {
      _createdPreset = null; // ya vino del servidor
    }
    if (_presetId != null && !_presetOptions.any((p) => p.id == _presetId)) {
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

  /// El TIPO de filamento elegido (null si se eligió un carrete sin tipo).
  TypeChoice? get _typeChoice => typeChoiceOf(_o.filaments, _filamentId);

  /// "＋ Nuevo tipo": un tipo de producto que se cobra como otro.
  Future<void> _newPreset() async {
    final created = await showNewPresetDialog(context, options: _presetOptions);
    if (created == null || !mounted) return;
    setState(() {
      _createdPreset = created;
      _presetId = created.id;
    });
    showSnack(context, 'Tipo «${created.name}» creado');
    _scheduleQuote();
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
        _saveError = null;
      });
      return;
    }
    setState(() {
      _quoting = true;
      _quoteError = null;
      // Al cambiar los datos, el error del guardado anterior ya no aplica.
      _saveError = null;
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
      if (_typeChoice != null) {
        // Se eligió un TIPO de filamento: el historial guarda el nombre del
        // tipo y ningún color (el carrete solo lo representa).
        await ref.read(calcExtrasApiProvider).saveCalcByType(
              name: _name.text.trim(),
              customer: _customer.text.trim(),
              filamentId: req.filamentId,
              grams: req.grams,
              hours: req.hours,
              presetId: req.presetId,
              notes: _notes.text.trim(),
            );
      } else {
        await ref.read(calculadoraApiProvider).saveCalc(
              name: _name.text.trim(),
              customer: _customer.text.trim(),
              filamentId: req.filamentId,
              grams: req.grams,
              hours: req.hours,
              presetId: req.presetId,
              notes: _notes.text.trim(),
            );
      }
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
    final picked = await showAppSheet<String>(
      context,
      builder: (_) => FilamentPickerSheet(filaments: _o.filaments, selectedId: _filamentId),
    );
    if (!mounted) return;
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
                      onChanged: (_) => setState(() => _saveError = null),
                      onTapOutside: closeKeyboardOnTapOutside,
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
                      onTapOutside: closeKeyboardOnTapOutside,
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
                      CalcFilamentField(filament: f, type: _typeChoice, onTap: _pickFilament),
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
                    if (_presetOptions.isEmpty)
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
                          for (final p in _presetOptions)
                            ChoiceChip(
                              label: Text(_presetLabel(p)),
                              selected: p.id == _presetId,
                              onSelected: (_) {
                                setState(() => _presetId = p.id);
                                _scheduleQuote();
                              },
                            ),
                          // Con permiso de crear, el operador suma un tipo sin
                          // pedírselo al dueño (y sin ver ningún margen).
                          if (widget.canSave) NewPresetChip(onPressed: _newPreset),
                        ],
                      ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _notes,
                      // Campo de varias líneas: su teclado no trae "listo".
                      onTapOutside: closeKeyboardOnTapOutside,
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
          // El error (no se pudo cotizar / guardar) también se ve acá: el cartel
          // de la lista puede quedar fuera de la vista mientras se tipea, y la
          // barra decía "Completá los datos." aunque estuviera todo cargado.
          error: _saveError ?? _quoteError,
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

/// Campo "Filamento" (abre el selector). Lo usan la calculadora y el
/// "Calcular precio" de las consultas.
class CalcFilamentField extends StatelessWidget {
  const CalcFilamentField({super.key, required this.filament, required this.onTap, this.type});
  final CalcFilament? filament;
  final VoidCallback onTap;

  /// Si se eligió un TIPO (PLA, PETG…), se muestra el tipo y no el carrete que
  /// lo representa.
  final TypeChoice? type;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final f = filament;
    final t = type;
    if (f != null && t != null) {
      return InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: InputDecorator(
          decoration: const InputDecoration(labelText: 'Filamento', suffixIcon: Icon(Icons.expand_more_rounded)),
          child: _TypeLine(t),
        ),
      );
    }
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

/// "PLA" + "$26.000 por kg · 32 carretes".
class _TypeLine extends StatelessWidget {
  const _TypeLine(this.type);
  final TypeChoice type;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final t = type;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(t.name, maxLines: 1, overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        Text(
          typeChoiceSubtitle(t),
          style: TextStyle(fontSize: 11.5, color: t.costPerKg > 0 ? c.textFaint : Brand.warning),
        ),
      ],
    );
  }
}

/// "$ 26.000 por kg · 32 carretes".
String typeChoiceSubtitle(TypeChoice t) => [
      t.costPerKg > 0 ? '${formatArMoney(t.costPerKg, decimals: 0)} por kg' : 'Sin precio por kg',
      t.spools == 1 ? '1 carrete' : '${t.spools} carretes',
    ].join(' · ');

const looseSpoolsHeading = 'Carretes sin tipo (precio propio)';

/// Selector de filamento (con búsqueda). Por defecto agrupa por TIPO
/// (sugerencia de Agustín, 2026-11-24): "PLA — $26.000/kg" en vez de los 50
/// carretes con el precio repetido; los carretes sin tipo van abajo, de a uno.
/// Con `byType: false` (o si ningún carrete tiene tipo) lista cada carrete con
/// SU costo por kg. Devuelve el id de un carrete: el elegido, o el que
/// representa al tipo elegido.
class FilamentPickerSheet extends StatefulWidget {
  const FilamentPickerSheet({super.key, required this.filaments, this.selectedId, this.byType = true});
  final List<CalcFilament> filaments;
  final String? selectedId;
  final bool byType;

  @override
  State<FilamentPickerSheet> createState() => _FilamentPickerSheetState();
}

class _FilamentPickerSheetState extends State<FilamentPickerSheet> {
  final _scroll = ScrollController();
  String _q = '';

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _search(String value) {
    setState(() => _q = value);
    // Cada búsqueda arranca desde arriba: si la lista había quedado desplazada,
    // los primeros resultados aparecían cortados o fuera de la vista.
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final term = _q.trim().toLowerCase();
    bool matches(String text) => term.isEmpty || text.toLowerCase().contains(term);
    final choices = filamentChoices(widget.filaments);
    final grouped = widget.byType && choices.grouped;
    // Renglones: los tipos, el rótulo de los sueltos y los carretes sin tipo.
    final types = grouped ? choices.types.where((t) => matches(t.name)).toList() : const <TypeChoice>[];
    final spools = (grouped ? choices.loose : widget.filaments).where((f) => matches(f.label)).toList();
    final list = <Object>[
      ...types,
      if (grouped && spools.isNotEmpty) looseSpoolsHeading,
      ...spools,
    ];
    final selected = grouped ? choiceValueFor(widget.filaments, widget.selectedId) : widget.selectedId;
    final height = MediaQuery.sizeOf(context).height * 0.7;
    // Lista con buscador (2026-11-14, pedido de Ale: que los modales se vean
    // bien): abajo deja el teclado o la barra del sistema (`sheetBottomInset`)
    // y, si con el teclado abierto el 70 % no entra, la hoja se achica sola.
    return Padding(
      padding: EdgeInsets.only(bottom: sheetBottomInset(context)),
      child: SizedBox(
        height: height,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
              child: Text('Elegí el filamento', style: Theme.of(context).textTheme.titleLarge),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: TextField(
                onChanged: _search,
                onTapOutside: closeKeyboardOnTapOutside,
                textInputAction: TextInputAction.search,
                decoration: const InputDecoration(hintText: 'Buscar material, color o marca…', prefixIcon: Icon(Icons.search_rounded)),
              ),
            ),
            Expanded(
              child: list.isEmpty
                  ? Center(child: Text('Sin resultados', style: TextStyle(color: c.textDim)))
                  : ListView.builder(
                      controller: _scroll,
                      padding: const EdgeInsets.fromLTRB(8, 0, 8, 16),
                      // Al recorrer los resultados se cierra el teclado (con él
                      // abierto en un teléfono chico se ven dos filas).
                      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                      itemCount: list.length,
                      itemBuilder: (_, i) {
                        final row = list[i];
                        if (row is String) {
                          return Padding(
                            padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
                            child: Text(
                              row.toUpperCase(),
                              style: TextStyle(
                                fontFamily: 'Orbitron',
                                fontSize: 10.5,
                                letterSpacing: 1.6,
                                fontWeight: FontWeight.w700,
                                color: c.textFaint,
                              ),
                            ),
                          );
                        }
                        if (row is TypeChoice) {
                          return ListTile(
                            leading: Icon(Icons.layers_outlined, color: c.textDim),
                            title: Text(row.name, maxLines: 2, overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                            subtitle: Text(typeChoiceSubtitle(row)),
                            trailing:
                                row.value == selected ? const Icon(Icons.check_circle_rounded, color: Brand.gold) : null,
                            onTap: () => Navigator.of(context).pop(row.value),
                          );
                        }
                        final f = row as CalcFilament;
                        final sel = f.id == selected;
                        return ListTile(
                          leading: _Swatch(f.hex),
                          // Dos líneas: con una sola, dos filamentos del mismo
                          // material con nombre largo se veían iguales (el color
                          // y la marca van al final).
                          title: Text(f.label, maxLines: 2, overflow: TextOverflow.ellipsis,
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
    this.error,
  });

  final CalcQuote? quote;
  final bool quoting;
  final bool hasData;
  final bool canSave;
  final bool saving;
  final VoidCallback? onSave;
  final String? hint;

  /// Error del servidor al cotizar o al guardar (va en rojo en lugar del estado).
  final String? error;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final q = quote;
    final showError = error != null && !quoting;
    final status = quoting
        ? 'Calculando…'
        : (error ?? hint ?? (q != null ? 'Precio listo para cotizar al cliente.' : 'Completá los datos.'));
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
                      Text(
                        status,
                        maxLines: showError ? 3 : 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 11.5, color: showError ? Brand.danger : c.textFaint),
                      ),
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
