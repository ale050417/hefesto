import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../analisis/ar_number.dart';
import '../filamentos/shared_widgets.dart';
import 'consultas_api.dart';
import 'consultas_models.dart';
import 'consultas_widgets.dart';

/// Respuesta del operador a una consulta: precio y datos de la pieza. Con eso
/// el servidor arma el mensaje para el cliente; al guardar se muestra cómo
/// quedó, que es lo que va a mandar atención al cliente.
/// (Pantalla y no hoja: son muchos campos.)
class ConsultaAnswerScreen extends ConsumerStatefulWidget {
  const ConsultaAnswerScreen({super.key, required this.consulta});
  final Consulta consulta;

  @override
  ConsumerState<ConsultaAnswerScreen> createState() => _ConsultaAnswerScreenState();
}

class _ConsultaAnswerScreenState extends ConsumerState<ConsultaAnswerScreen> {
  late final TextEditingController _unitPrice;
  late final TextEditingController _unitCost;
  late final TextEditingController _delivery;
  late final TextEditingController _bulkPrice;
  late final TextEditingController _bulkFrom;
  late final TextEditingController _dimensions;
  late final TextEditingController _colors;
  late final TextEditingController _note;
  late final TextEditingController _message;

  static const _fixFieldsMessage = 'Revisá los datos marcados en rojo.';

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
    _unitCost = TextEditingController(text: money(q.unitCost));
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
    for (final c in [_unitPrice, _unitCost, _delivery, _bulkPrice, _bulkFrom, _dimensions, _colors, _note, _message]) {
      c.dispose();
    }
    super.dispose();
  }

  Map<String, String> get _errors => validateRespuestaForm(
        unitPrice: _unitPrice.text,
        unitCost: _unitCost.text,
        bulkPrice: _bulkPrice.text,
        bulkFrom: _bulkFrom.text,
        dimensions: _dimensions.text,
        colors: _colors.text,
        deliveryTime: _delivery.text,
        note: _note.text,
        message: _message.text,
      );

  /// ¿Cambió algo respecto de lo guardado? (para preguntar antes de salir)
  bool get _dirty {
    final q = _q;
    String money(double? v) => v == null ? '' : arEditText(v);
    return _unitPrice.text.trim() != money(q.unitPrice) ||
        _unitCost.text.trim() != money(q.unitCost) ||
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
      message: 'La respuesta no se guardó.',
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
              unitPrice: parseArNumber(_unitPrice.text)!,
              unitCost: parseArNumber(_unitCost.text)!,
              bulkPrice: parseArNumber(_bulkPrice.text),
              bulkFrom: int.tryParse(_bulkFrom.text.trim()),
              dimensions: _dimensions.text,
              colors: _colors.text,
              deliveryTime: _delivery.text,
              note: _note.text,
              message: messageToSend(typed: _message.text, saved: _q.message),
            ),
          );
      invalidateConsultas(container);
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
    final price = parseArNumber(_unitPrice.text);

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
      appBar: AppBar(title: Text(hadMessage ? 'Cambiar respuesta' : 'Responder')),
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
                  const SizedBox(height: 16),
                  moneyField(
                    _unitPrice,
                    'Precio por unidad (\$)',
                    'unitPrice',
                    helper: (q.quantity > 1 && price != null && price > 0)
                        ? 'Total por ${q.quantity}: ${formatConsultaMoney(price * q.quantity)}'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  // El costo va pegado al precio, pero es interno: no entra en
                  // el mensaje ni se le muestra al cliente.
                  moneyField(
                    _unitCost,
                    'Costo por unidad (\$)',
                    'unitCost',
                    helper: 'No se le muestra al cliente. Con esto se registra el pedido cuando se confirma.',
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
                    label: 'Guardar respuesta',
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

/// Resultado de responder: el mensaje tal cual lo va a mandar atención al
/// cliente, para que el operador lo revise antes de irse.
class _AnswerSaved extends StatelessWidget {
  const _AnswerSaved({required this.consulta});
  final Consulta consulta;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Scaffold(
      appBar: AppBar(title: const Text('Respuesta guardada')),
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
                          'Listo. Este es el mensaje que atención al cliente le va a mandar a '
                          '${consulta.customerName}.',
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
