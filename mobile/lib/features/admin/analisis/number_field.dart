import 'package:flutter/material.dart';

import 'ar_number.dart';

/// Cierra el teclado al tocar fuera de un campo (2026-11-14, pedido de Ale: que
/// todo funcione en el teléfono). El teclado numérico del iPhone no trae tecla
/// "listo" y, en el teléfono, Flutter no lo cierra solo: sin esto quedaba
/// abierto tapando media pantalla. Va en `onTapOutside` de los campos de
/// Reportes, Ganancias y Calculadora (tocar OTRO campo no lo cierra).
void closeKeyboardOnTapOutside(PointerDownEvent _) => FocusManager.instance.primaryFocus?.unfocus();

/// Campo numérico con teclado numérico, formato argentino y validación en línea.
/// Al salir del campo normaliza lo escrito ("1234,5" -> "1.234,5"), así se ve
/// cómo lo interpretó la app. `onChanged` recibe el número ya parseado (o null
/// si está vacío o inválido) en cada cambio.
class ArNumberField extends StatefulWidget {
  const ArNumberField({
    super.key,
    required this.controller,
    required this.label,
    this.prefix,
    this.suffix,
    this.hint,
    this.helper,
    this.maxDecimals = 2,
    this.min = 0,
    this.max,
    this.required = true,
    this.enabled = true,
    this.onChanged,
    this.textInputAction = TextInputAction.next,
  });

  final TextEditingController controller;
  final String label;
  final String? prefix;
  final String? suffix;
  final String? hint;
  final String? helper;

  /// 0 = solo enteros.
  final int maxDecimals;
  final double? min;
  final double? max;
  final bool required;
  final bool enabled;
  final ValueChanged<double?>? onChanged;
  final TextInputAction textInputAction;

  @override
  State<ArNumberField> createState() => _ArNumberFieldState();
}

class _ArNumberFieldState extends State<ArNumberField> {
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(_onFocus);
  }

  @override
  void dispose() {
    _focus.removeListener(_onFocus);
    _focus.dispose();
    super.dispose();
  }

  void _onFocus() {
    if (_focus.hasFocus) return;
    final v = parseArNumber(widget.controller.text);
    if (v == null) return;
    final normalized = formatArNumber(v, maxDecimals: widget.maxDecimals);
    if (normalized != widget.controller.text) {
      widget.controller.text = normalized;
    }
  }

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: widget.controller,
      focusNode: _focus,
      enabled: widget.enabled,
      textInputAction: widget.textInputAction,
      keyboardType: TextInputType.numberWithOptions(decimal: widget.maxDecimals > 0),
      onTapOutside: closeKeyboardOnTapOutside,
      inputFormatters: [ArNumberInputFormatter(maxDecimals: widget.maxDecimals)],
      autovalidateMode: AutovalidateMode.onUserInteraction,
      validator: (t) => validateArNumber(
        t,
        required: widget.required,
        min: widget.min,
        max: widget.max,
        integer: widget.maxDecimals == 0,
        maxDecimals: widget.maxDecimals,
      ),
      onChanged: (t) => widget.onChanged?.call(parseArNumber(t)),
      decoration: InputDecoration(
        labelText: widget.label,
        hintText: widget.hint,
        helperText: widget.helper,
        helperMaxLines: 2,
        errorMaxLines: 2,
        prefixText: widget.prefix == null ? null : '${widget.prefix} ',
        suffixText: widget.suffix,
      ),
    );
  }
}
