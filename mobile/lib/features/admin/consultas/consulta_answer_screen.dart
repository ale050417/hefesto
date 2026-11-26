import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../analisis/ar_number.dart';
import '../calculadora/price_estimator_sheet.dart';
import '../filamentos/shared_widgets.dart';
import 'consulta_product_picker.dart';
import 'consultas_api.dart';
import 'consultas_models.dart';
import 'consultas_widgets.dart';

/// Respuesta del operador a una consulta: precio y datos de la pieza. Con eso
/// el servidor arma el mensaje para el cliente; al guardar se muestra cómo
/// quedó, que es lo que va a mandar atención al cliente.
/// (Pantalla y no hoja: son muchos campos.)
///
/// Pedido de Ale (2026-11-17), igual que la web:
/// - El precio sale de la CALCULADORA ("Calcular precio"): gramos, tiempo,
///   filamento y tipo de producto. El operador no ve ni el costo ni el margen,
///   solo el precio; lo calculado queda guardado para costear el pedido.
/// - Con más de una unidad puede tipear el precio POR UNIDAD o POR EL TOTAL;
///   al servidor va siempre el precio por unidad.
/// - Si el producto ya está cargado en la tienda, "Cargar desde un producto"
///   rellena precio, medidas, demora, colores y el costeo (sugerencia de
///   Agustín, 2026-11-19).
class ConsultaAnswerScreen extends ConsumerStatefulWidget {
  const ConsultaAnswerScreen({super.key, required this.consulta});
  final Consulta consulta;

  @override
  ConsumerState<ConsultaAnswerScreen> createState() => _ConsultaAnswerScreenState();
}

class _ConsultaAnswerScreenState extends ConsumerState<ConsultaAnswerScreen> {
  late final TextEditingController _unitPrice;
  late final TextEditingController _delivery;
  late final TextEditingController _bulkPrice;
  late final TextEditingController _bulkFrom;
  late final TextEditingController _dimensions;
  late final TextEditingController _colors;
  late final TextEditingController _note;
  late final TextEditingController _message;

  static const _fixFieldsMessage = 'Revisá los datos marcados en rojo.';

  PriceMode _mode = PriceMode.unit;

  /// Datos de la calculadora: los guardados con la respuesta o los del último
  /// "Calcular precio". Null = respuesta nueva sin calcular, o respuesta vieja
  /// con el costo cargado a mano (ese costo se reenvía tal cual, sin mostrarlo).
  RespuestaCalc? _calc;
  bool _recalculated = false;

  /// Producto de la tienda con el que se rellenó la respuesta (solo aviso).
  String? _loadedFrom;

  bool _saving = false;
  bool _submitted = false;
  String? _serverError;

  /// La consulta ya respondida (con el mensaje armado): al tenerla, la
  /// pantalla pasa a mostrar el resultado.
  Consulta? _result;

  Consulta get _q => widget.consulta;

  @override
  void initState() {
    super.initState();
    final q = _q;
    String money(double? v) => v == null ? '' : arEditText(v);
    _unitPrice = TextEditingController(text: money(q.unitPrice));
    _calc = q.calc;
    _delivery = TextEditingController(text: q.deliveryTime ?? '');
    _bulkPrice = TextEditingController(text: money(q.bulkPrice));
    _bulkFrom = TextEditingController(text: q.bulkFrom?.toString() ?? '');
    _dimensions = TextEditingController(text: q.dimensions ?? '');
    _colors = TextEditingController(text: q.colors ?? '');
    _note = TextEditingController(text: q.answerNote ?? '');
    // Vacío si todavía no hay mensaje (lo arma el servidor); si ya hay uno,
    // se muestra para poder retocarlo.
    _message = TextEditingController(text: q.message ?? '');
  }

  @override
  void dispose() {
    for (final c in [_unitPrice, _delivery, _bulkPrice, _bulkFrom, _dimensions, _colors, _note, _message]) {
      c.dispose();
    }
    super.dispose();
  }

  Map<String, String> get _errors => validateRespuestaForm(
        unitPrice: _unitPrice.text,
        hasCostBasis: _hasCost,
        mode: _mode,
        quantity: _q.quantity,
        bulkPrice: _bulkPrice.text,
        bulkFrom: _bulkFrom.text,
        dimensions: _dimensions.text,
        colors: _colors.text,
        deliveryTime: _delivery.text,
        note: _note.text,
        message: _message.text,
      );

  /// Hay con qué costear el pedido: calculadora, o el costo de una respuesta vieja.
  bool get _hasCost => _calc != null || _q.unitCost != null;

  /// Precio por unidad según lo tipeado y el modo (null si no es un número > 0).
  double? get _unitPriceValue {
    final typed = parseArNumber(_unitPrice.text);
    if (typed == null || typed <= 0) return null;
    return unitPriceFrom(typed, _mode, _q.quantity);
  }

  /// "Por unidad" / "Por las N": el mismo precio, expresado de la otra forma.
  void _changeMode(PriceMode next) {
    if (next == _mode) return;
    final typed = parseArNumber(_unitPrice.text);
    if (typed != null && typed > 0) {
      _unitPrice.text = arEditText(convertTypedPrice(typed, to: next, quantity: _q.quantity));
    }
    setState(() {
      _mode = next;
      _serverError = null;
    });
  }

  Future<void> _calculate() async {
    FocusManager.instance.primaryFocus?.unfocus();
    final calc = _calc;
    final result = await showPriceEstimator(
      context,
      initial: calc == null
          ? null
          : EstimatorInitial(
              filamentId: calc.filamentId,
              material: calc.material,
              grams: calc.grams,
              printMinutes: calc.printMinutes,
            ),
    );
    if (result == null || !mounted) return;
    setState(() {
      _unitPrice.text = arEditText(calculatorPriceFor(result.price, _mode, _q.quantity));
      _calc = RespuestaCalc(
        filamentId: result.filamentId,
        material: result.material,
        grams: result.grams,
        printMinutes: result.printMinutes,
      );
      _recalculated = true;
      _serverError = null;
    });
  }

  /// Rellena la respuesta con la ficha de un producto de la tienda.
  Future<void> _loadFromProduct() async {
    FocusManager.instance.primaryFocus?.unfocus();
    final pick = await Navigator.of(context).push<ConsultaProductPick>(
      MaterialPageRoute(builder: (_) => const ConsultaProductPickerScreen()),
    );
    if (pick == null || !mounted) return;
    final p = pick.product;
    String cut(String s, int max) => s.length > max ? s.substring(0, max) : s;
    setState(() {
      _unitPrice.text = arEditText(calculatorPriceFor(pick.option.unitPrice, _mode, _q.quantity));
      // Si la ficha no alcanza para costear, lo calculado antes era de otra
      // pieza: se borra y el operador pasa por la calculadora.
      _calc = p.calcFor(pick.option);
      _recalculated = true;
      if (p.dimensions != null) _dimensions.text = cut(p.dimensions!, 300);
      if (p.colors.isNotEmpty) _colors.text = cut(p.colors, 300);
      if (p.deliveryTime != null) _delivery.text = cut(p.deliveryTime!, 120);
      _loadedFrom = pick.option.label == null ? p.name : '${p.name} · ${pick.option.label}';
      _serverError = null;
    });
  }

  /// ¿Cambió algo respecto de lo guardado? (para preguntar antes de salir)
  bool get _dirty {
    final q = _q;
    String money(double? v) => v == null ? '' : arEditText(v);
    // El precio se compara por unidad: cambiar de modo no es un cambio.
    final unit = _unitPriceValue;
    final priceChanged = unit == null
        ? _unitPrice.text.trim().isNotEmpty || q.unitPrice != null
        : (q.unitPrice == null || (unit - q.unitPrice!).abs() > 0.005);
    return priceChanged ||
        _recalculated ||
        _delivery.text.trim() != (q.deliveryTime ?? '') ||
        _bulkPrice.text.trim() != money(q.bulkPrice) ||
        _bulkFrom.text.trim() != (q.bulkFrom?.toString() ?? '') ||
        _dimensions.text.trim() != (q.dimensions ?? '') ||
        _colors.text.trim() != (q.colors ?? '') ||
        _note.text.trim() != (q.answerNote ?? '') ||
        _message.text.trim() != (q.message ?? '');
  }

  Future<void> _confirmLeave() async {
    final leave = await confirmDialog(
      context,
      title: '¿Descartar los cambios?',
      message: 'La cotización no se guardó.',
      confirmLabel: 'Descartar',
      cancelLabel: 'Seguir editando',
      destructive: true,
    );
    if (leave && mounted) Navigator.of(context).pop();
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() {
      _submitted = true;
      _serverError = _errors.isEmpty ? null : _fixFieldsMessage;
    });
    if (_errors.isNotEmpty) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() => _saving = true);
    final container = ProviderScope.containerOf(context, listen: false);
    try {
      final answered = await ref.read(consultasApiProvider).answer(
            _q.id,
            RespuestaDraft(
              unitPrice: _unitPriceValue!,
              calc: _calc,
              // Respuesta vieja con el costo a mano: se conserva.
              legacyUnitCost: _q.unitCost,
              bulkPrice: parseArNumber(_bulkPrice.text),
              bulkFrom: int.tryParse(_bulkFrom.text.trim()),
              dimensions: _dimensions.text,
              colors: _colors.text,
              deliveryTime: _delivery.text,
              note: _note.text,
              message: messageToSend(typed: _message.text, saved: _q.message),
            ),
          );
      // La cotización crea (o reemplaza) el pedido en pendiente de pago:
      // además de las consultas se refresca Ventas.
      invalidateConsultaConfirmed(container);
      if (mounted) setState(() => _result = answered);
    } on ApiException catch (e) {
      if (mounted) setState(() => _serverError = e.message);
    } catch (_) {
      if (mounted) setState(() => _serverError = 'No pudimos guardar. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _touched(String _) => setState(() => _serverError = null);

  @override
  Widget build(BuildContext context) {
    final result = _result;
    if (result != null) return _AnswerSaved(consulta: result);

    final c = context.hc;
    final q = _q;
    final errors = _submitted ? _errors : const <String, String>{};
    final hadMessage = q.message != null;
    final unit = _unitPriceValue;
    final qty = q.quantity;
    final totalMode = _mode == PriceMode.total && qty > 1;

    Widget moneyField(TextEditingController ctl, String label, String key, {String? helper}) => TextField(
          controller: ctl,
          enabled: !_saving,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          textInputAction: TextInputAction.next,
          inputFormatters: [ArNumberInputFormatter()],
          onChanged: _touched,
          decoration: InputDecoration(
            labelText: label,
            helperText: helper,
            helperMaxLines: 3,
            errorText: errors[key],
            errorMaxLines: 2,
          ),
        );

    Widget textField(
      TextEditingController ctl,
      String label,
      String key, {
      String? hint,
      int max = 300,
      int lines = 1,
    }) =>
        TextField(
          controller: ctl,
          enabled: !_saving,
          minLines: lines,
          maxLines: lines == 1 ? 1 : lines + 3,
          textCapitalization: TextCapitalization.sentences,
          textInputAction: lines == 1 ? TextInputAction.next : TextInputAction.newline,
          inputFormatters: [LengthLimitingTextInputFormatter(max)],
          onChanged: _touched,
          decoration: InputDecoration(
            labelText: label,
            hintText: hint,
            alignLabelWithHint: lines > 1,
            errorText: errors[key],
          ),
        );

    final scaffold = Scaffold(
      appBar: AppBar(title: Text(hadMessage ? 'Cambiar cotización' : 'Crear cotización')),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  // Qué se está cotizando, siempre a la vista arriba.
                  Text(q.heading, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 2),
                  Text(
                    'Para ${q.customerName}',
                    style: TextStyle(fontSize: 12.5, color: c.textDim),
                  ),
                  const SizedBox(height: 14),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: OutlinedButton.icon(
                      onPressed: _saving ? null : _loadFromProduct,
                      icon: const Icon(Icons.inventory_2_outlined, size: 18),
                      label: const Text('Cargar desde un producto'),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _loadedFrom != null
                        ? 'Datos cargados desde $_loadedFrom. Podés cambiar lo que haga falta.'
                        : 'Si ya está cargado en la tienda, elegilo y se rellenan el precio, las '
                            'medidas, la demora y los colores.',
                    style: TextStyle(fontSize: 12, height: 1.35, color: c.textFaint),
                  ),
                  const SizedBox(height: 16),
                  if (qty > 1) ...[
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      children: [
                        ChoiceChip(
                          label: const Text('Por unidad'),
                          selected: !totalMode,
                          onSelected: _saving ? null : (_) => _changeMode(PriceMode.unit),
                        ),
                        ChoiceChip(
                          label: Text('Por las $qty'),
                          selected: totalMode,
                          onSelected: _saving ? null : (_) => _changeMode(PriceMode.total),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                  ],
                  moneyField(
                    _unitPrice,
                    totalMode ? 'Precio por las $qty (\$)' : 'Precio por unidad (\$)',
                    'unitPrice',
                    helper: (qty > 1 && unit != null)
                        ? '${formatConsultaMoney(unit)} c/u · ${formatConsultaMoney(unit * qty)} por las $qty'
                        : null,
                  ),
                  const SizedBox(height: 10),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: OutlinedButton.icon(
                      onPressed: _saving ? null : _calculate,
                      icon: const Icon(Icons.calculate_outlined, size: 18),
                      label: Text(_calc != null ? 'Volver a calcular' : 'Calcular precio'),
                    ),
                  ),
                  const SizedBox(height: 6),
                  // El costo no se muestra nunca: solo si ya quedó guardado.
                  if (errors['calc'] != null)
                    Text(
                      errors['calc']!,
                      style: TextStyle(fontSize: 12, height: 1.35, color: Theme.of(context).colorScheme.error),
                    )
                  else
                    Text(
                      _hasCost
                          ? 'Costo guardado. Podés ajustar el precio a mano.'
                          : 'Calculá el precio con la calculadora: elegís el tipo de producto y queda '
                              'guardado el costo para cuando se confirme el pedido.',
                      style: TextStyle(fontSize: 12, height: 1.35, color: c.textFaint),
                    ),
                  const SizedBox(height: 14),
                  textField(_delivery, 'Demora', 'deliveryTime', hint: 'Ej: 5 días hábiles', max: 120),
                  const SizedBox(height: 18),
                  const SectionLabel('Precio por cantidad (opcional)'),
                  const SizedBox(height: 10),
                  moneyField(_bulkPrice, 'Precio por unidad comprando más', 'bulkPrice'),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _bulkFrom,
                    enabled: !_saving,
                    keyboardType: TextInputType.number,
                    textInputAction: TextInputAction.next,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(4),
                    ],
                    onChanged: _touched,
                    decoration: InputDecoration(
                      labelText: 'A partir de cuántas unidades',
                      suffixText: 'u.',
                      errorText: errors['bulkFrom'],
                      errorMaxLines: 2,
                    ),
                  ),
                  const SizedBox(height: 18),
                  const SectionLabel('Datos de la pieza (opcional)'),
                  const SizedBox(height: 10),
                  textField(_dimensions, 'Medidas', 'dimensions', hint: 'Ej: 12 × 8 × 5 cm'),
                  const SizedBox(height: 14),
                  textField(_colors, 'Colores', 'colors', hint: 'Ej: negro, blanco, rojo'),
                  const SizedBox(height: 14),
                  textField(_note, 'Nota', 'note', hint: 'Algo más que tenga que saber el cliente', max: 1000, lines: 2),
                  const SizedBox(height: 18),
                  const SectionLabel('Mensaje para el cliente'),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _message,
                    enabled: !_saving,
                    minLines: 4,
                    maxLines: 12,
                    textCapitalization: TextCapitalization.sentences,
                    inputFormatters: [LengthLimitingTextInputFormatter(6000)],
                    onChanged: _touched,
                    decoration: InputDecoration(
                      labelText: 'Mensaje para el cliente',
                      alignLabelWithHint: true,
                      helperText: hadMessage
                          // Con mensaje guardado: dejarlo igual lo rearma con
                          // los datos nuevos; cambiarlo lo deja fijo.
                          ? 'Si no lo tocás, se vuelve a armar solo con estos datos. '
                              'Cambialo solo si querés otro texto.'
                          : 'Se arma solo con estos datos. Escribí acá solo si querés cambiarlo.',
                      helperMaxLines: 4,
                      errorText: errors['message'],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // El aviso va pegado al botón (fijo): al final de la lista,
                  // con el teclado abierto, quedaba fuera de la pantalla.
                  if (_serverError != null) ...[
                    InlineError(_serverError!),
                    const SizedBox(height: 10),
                  ],
                  GoldButton(
                    label: hadMessage ? 'Cambiar cotización' : 'Crear cotización',
                    icon: Icons.check_rounded,
                    loading: _saving,
                    onPressed: _saving ? null : _save,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
    return PopScope(
      canPop: !_saving && !_dirty,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && !_saving) _confirmLeave();
      },
      child: scaffold,
    );
  }
}

/// Resultado de cotizar: el pedido quedó en pendiente de pago y este es el
/// mensaje tal cual lo va a mandar atención al cliente, para que el operador
/// lo revise antes de irse. Se cierra con `true` (también con "atrás"): quien
/// abrió la pantalla avisa "Cotización creada…".
class _AnswerSaved extends StatelessWidget {
  const _AnswerSaved({required this.consulta});
  final Consulta consulta;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.of(context).pop(true);
      },
      child: _body(context, c),
    );
  }

  Widget _body(BuildContext context, HefestoColors c) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cotización creada')),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.check_circle_rounded, color: Brand.success),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Listo: el pedido quedó pendiente de pago. Este es el mensaje que '
                          'atención al cliente le va a mandar a ${consulta.customerName}.',
                          style: TextStyle(fontSize: 13.5, color: c.textDim, height: 1.4),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Text(consulta.heading, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 10),
                  // Entero (sin "Ver más"): acá el operador lo revisa.
                  ConsultaMessageBlock(consulta: consulta, expanded: true),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: GoldButton(
                label: 'Listo',
                icon: Icons.check_rounded,
                onPressed: () => Navigator.of(context).pop(true),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
