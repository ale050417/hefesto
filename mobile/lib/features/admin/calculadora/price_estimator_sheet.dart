import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import '../analisis/analysis_widgets.dart';
import '../analisis/ar_number.dart';
import '../analisis/number_field.dart';
import 'calc_form.dart';
import 'calc_logic.dart';
import 'calculadora_api.dart';
import 'calculadora_models.dart';

/// Lo que devuelve "Calcular precio": el precio de UNA pieza y los datos con
/// los que se calculó (el servidor saca de ahí el costo del pedido).
class EstimatorResult {
  const EstimatorResult({
    required this.filamentId,
    required this.material,
    required this.grams,
    required this.printMinutes,
    required this.price,
  });

  final String filamentId;
  final String material;
  final double grams;
  final int printMinutes;

  /// Precio final de una pieza (ya redondeado a $100, como en la web).
  final double price;
}

/// Datos con los que se vuelve a abrir la calculadora ("Volver a calcular").
class EstimatorInitial {
  const EstimatorInitial({this.filamentId, this.material, this.grams, this.printMinutes});
  final String? filamentId;
  final String? material;
  final double? grams;
  final int? printMinutes;
}

/// Abre la calculadora embebida (pedido de Ale, 2026-11-17: el precio de una
/// consulta sale de la calculadora). Devuelve null si se cierra sin usar.
Future<EstimatorResult?> showPriceEstimator(BuildContext context, {EstimatorInitial? initial}) =>
    showAppSheet<EstimatorResult>(context, builder: (_) => PriceEstimatorSheet(initial: initial));

/// Hoja "Calcular precio": filamento, gramos, tiempo y TIPO de producto. El
/// tipo lleva el porcentaje de ganancia que carga el dueño; acá no se muestra
/// ni el costo ni ese porcentaje (ni siquiera al admin: para eso está la
/// Calculadora completa), solo el precio que devuelve el servidor.
class PriceEstimatorSheet extends ConsumerWidget {
  const PriceEstimatorSheet({super.key, this.initial});
  final EstimatorInitial? initial;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(calculadoraProvider);
    return async.when(
      skipLoadingOnRefresh: false,
      loading: () => const SheetBody(
        title: 'Calcular precio',
        children: [
          Padding(padding: EdgeInsets.symmetric(vertical: 32), child: LoadingView()),
        ],
      ),
      error: (e, _) => SheetBody(
        title: 'Calcular precio',
        footer: GoldButton(
          label: 'Reintentar',
          icon: Icons.refresh_rounded,
          onPressed: () => ref.invalidate(calculadoraProvider),
        ),
        children: [
          NoticeBanner(
            errorMessage(e, fallback: 'No pudimos abrir la calculadora. Probá de nuevo.'),
            icon: Icons.error_outline_rounded,
            color: Brand.danger,
          ),
        ],
      ),
      data: (overview) => _EstimatorForm(overview: overview, initial: initial),
    );
  }
}

class _EstimatorForm extends ConsumerStatefulWidget {
  const _EstimatorForm({required this.overview, this.initial});
  final CalcOverview overview;
  final EstimatorInitial? initial;

  @override
  ConsumerState<_EstimatorForm> createState() => _EstimatorFormState();
}

class _EstimatorFormState extends ConsumerState<_EstimatorForm> {
  static const _debounce = Duration(milliseconds: 350);

  late final TextEditingController _grams;
  late final TextEditingController _hours;
  late final TextEditingController _minutes;

  String? _filamentId;

  /// Arranca sin tipo (como en la web): el precio aparece recién cuando el
  /// operador elige qué tipo de producto es.
  String? _presetId;

  double? _price;
  bool _quoting = false;
  String? _error;
  Timer? _timer;
  int _seq = 0;

  CalcOverview get _o => widget.overview;

  @override
  void initState() {
    super.initState();
    final init = widget.initial;
    final g = init?.grams ?? 0;
    final m = init?.printMinutes ?? 0;
    _grams = TextEditingController(text: g > 0 ? arEditText(g) : '');
    _hours = TextEditingController(text: m >= 60 ? '${m ~/ 60}' : '');
    _minutes = TextEditingController(text: m % 60 > 0 ? '${m % 60}' : '');
    _filamentId = _initialFilament(init);
  }

  /// El filamento guardado; si ya no existe, el primero del mismo material; si
  /// no, el primero de la lista.
  String? _initialFilament(EstimatorInitial? init) {
    final list = _o.filaments;
    if (list.isEmpty) return null;
    if (init?.filamentId != null && list.any((f) => f.id == init!.filamentId)) return init!.filamentId;
    if (init?.material != null) {
      for (final f in list) {
        if (f.material == init!.material) return f.id;
      }
    }
    return list.first.id;
  }

  @override
  void dispose() {
    _timer?.cancel();
    _grams.dispose();
    _hours.dispose();
    _minutes.dispose();
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
  int get _minutesValue => totalMinutes(parseArNumber(_hours.text), parseArNumber(_minutes.text));
  bool get _hasData => hasQuoteData(_gramsValue, _hoursValue);

  QuoteRequest? _request() {
    if (_filamentId == null || _presetId == null || !_fieldsOk || !_hasData) return null;
    return QuoteRequest(presetId: _presetId!, filamentId: _filamentId!, grams: _gramsValue, hours: _hoursValue);
  }

  void _scheduleQuote() {
    _timer?.cancel();
    final req = _request();
    if (req == null) {
      _seq++; // descarta lo que esté en vuelo
      setState(() {
        _price = null;
        _quoting = false;
        _error = null;
      });
      return;
    }
    setState(() {
      _quoting = true;
      _error = null;
    });
    _timer = Timer(_debounce, () async {
      final seq = ++_seq;
      try {
        final q = await ref.read(calculadoraApiProvider).quote(req);
        if (!mounted || seq != _seq) return;
        setState(() {
          _price = roundQuotePrice(q.precioFinal);
          _quoting = false;
        });
      } catch (e) {
        if (!mounted || seq != _seq) return;
        setState(() {
          _price = null;
          _quoting = false;
          _error = errorMessage(e);
        });
      }
    });
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

  String? get _hint {
    if (_o.filaments.isEmpty) return null; // ya lo dice el cartel
    if (!_fieldsOk) return 'Revisá los números marcados.';
    if (!_hasData) return 'Cargá los gramos o el tiempo de impresión.';
    if (_presetId == null) return 'Elegí el tipo de producto.';
    return null;
  }

  void _use() {
    final price = _price;
    final f = _filament;
    if (price == null || price <= 0 || f == null || _quoting) return;
    Navigator.of(context).pop(
      EstimatorResult(
        filamentId: f.id,
        material: f.material,
        grams: _gramsValue,
        printMinutes: _minutesValue,
        price: price,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final price = _price;
    final ready = price != null && price > 0 && !_quoting;
    final status = _quoting ? 'Calculando…' : (_error ?? _hint ?? (ready ? 'Precio de una pieza.' : 'Completá los datos.'));
    final label = TextStyle(fontSize: 12.5, color: c.textDim, fontWeight: FontWeight.w600);

    return SheetBody(
      title: 'Calcular precio',
      subtitle: 'Cargá los datos de UNA pieza. El precio sale del tipo de producto.',
      footer: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text(
                  status,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: _error != null && !_quoting ? Brand.danger : c.textFaint),
                ),
              ),
              const SizedBox(width: 12),
              Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerRight,
                  child: Text(
                    ready ? formatArMoney(price, decimals: 0) : '—',
                    key: const ValueKey('estimator-price'),
                    style: TextStyle(
                      fontFamily: 'Orbitron',
                      fontWeight: FontWeight.w800,
                      fontSize: 24,
                      color: ready ? Brand.gold : c.textFaint,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          GoldButton(
            label: 'Usar este precio',
            icon: Icons.check_rounded,
            onPressed: ready ? _use : null,
          ),
        ],
      ),
      children: [
        if (_o.filaments.isEmpty)
          const NoticeBanner(
            'No hay filamentos cargados. Cargá uno en Filamentos para poder calcular.',
            icon: Icons.warning_amber_rounded,
            color: Brand.warning,
          )
        else
          CalcFilamentField(filament: _filament, onTap: _pickFilament),
        const SizedBox(height: 16),
        ArNumberField(
          controller: _grams,
          label: 'Gramos por unidad',
          suffix: 'g',
          required: false,
          hint: '0',
          onChanged: (_) => _scheduleQuote(),
        ),
        const SizedBox(height: 14),
        Text('Tiempo de impresión por unidad', style: label),
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
                // Último campo: su teclado cierra en vez de saltar al botón.
                textInputAction: TextInputAction.done,
                onChanged: (_) => _scheduleQuote(),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Text('Tipo de producto', style: label),
        const SizedBox(height: 8),
        if (_o.presetOptions.isEmpty)
          Text(
            _o.isAdmin
                ? 'No hay tipos cargados. Creá uno en Calculadora → "Tipos y márgenes".'
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
                  // Solo el nombre: el porcentaje no se muestra acá.
                  label: Text(p.name),
                  selected: p.id == _presetId,
                  onSelected: (_) {
                    setState(() => _presetId = p.id);
                    _scheduleQuote();
                  },
                ),
            ],
          ),
      ],
    );
  }
}
