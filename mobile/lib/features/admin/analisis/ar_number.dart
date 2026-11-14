// Números a la argentina para los módulos de análisis (Reportes, Ganancias y
// Calculadora): miles con punto, decimales con coma ($1.234,50). Lógica pura,
// sin dependencias del locale del teléfono, así se comporta igual en cualquier
// dispositivo y se puede testear.
//
// Parseo tolerante, porque el teclado numérico de Android escribe "," o "." como
// separador decimal según el teléfono:
//   "1.234,5"  -> 1234.5   (coma decimal, puntos de miles)
//   "2,5"      -> 2.5
//   "2.5"      -> 2.5      (un punto con 1-2 dígitos detrás es decimal)
//   "25.000"   -> 25000    (un punto con 3 dígitos detrás es de miles, como en AR)
//   "0.250"    -> 0.25     (después de un 0 solo puede ser decimal)
//   "1,234.5"  -> null     (formato inglés: se rechaza, no se adivina)

import 'package:flutter/services.dart';

/// Máximo de dígitos enteros que aceptamos (evita desbordes absurdos).
const int _maxDigits = 15;

String _groupThousands(String digits) {
  final buf = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buf.write('.');
    buf.write(digits[i]);
  }
  return buf.toString();
}

/// "1234567.5" -> "1.234.567,5". Redondea a [maxDecimals] y quita los ceros de
/// más hasta [minDecimals]. Un valor que redondea a cero no lleva signo.
String formatArNumber(num value, {int minDecimals = 0, int maxDecimals = 2}) {
  if (value.isNaN || value.isInfinite) return '0';
  final negative = value < 0;
  final fixed = value.abs().toStringAsFixed(maxDecimals);
  final parts = fixed.split('.');
  var frac = parts.length > 1 ? parts[1] : '';
  while (frac.length > minDecimals && frac.endsWith('0')) {
    frac = frac.substring(0, frac.length - 1);
  }
  final body = frac.isEmpty
      ? _groupThousands(parts[0])
      : '${_groupThousands(parts[0])},$frac';
  final isZero = !RegExp(r'[1-9]').hasMatch(body);
  return negative && !isZero ? '-$body' : body;
}

/// "$1.234,50". Por defecto siempre con 2 decimales (centavos importan en el
/// costo de una pieza); con `decimals: 0` queda como el `formatPrice` de la tienda.
String formatArMoney(num value, {int decimals = 2}) {
  final body = formatArNumber(value.abs(), minDecimals: decimals, maxDecimals: decimals);
  final isZero = !RegExp(r'[1-9]').hasMatch(body);
  return value < 0 && !isZero ? '-\$$body' : '\$$body';
}

/// "12,5%". Sin decimales de más.
String formatArPercent(num value, {int maxDecimals = 1}) =>
    '${formatArNumber(value, maxDecimals: maxDecimals)}%';

/// Monto corto para ejes y chips: "$850", "$12,5 mil", "$1,2 M".
String formatArCompactMoney(num value) {
  final a = value.abs();
  final sign = value < 0 ? '-' : '';
  if (a >= 1e6) return '$sign\$${formatArNumber(a / 1e6, maxDecimals: 1)} M';
  if (a >= 1e4) return '$sign\$${formatArNumber(a / 1e3, maxDecimals: 1)} mil';
  return '$sign\$${formatArNumber(a, maxDecimals: 0)}';
}

/// Texto de un campo de edición a partir de un número ("1.234,5").
String arEditText(num value, {int maxDecimals = 2}) =>
    formatArNumber(value, maxDecimals: maxDecimals);

bool _validGrouping(String intPart) {
  if (!intPart.contains('.')) return true;
  final groups = intPart.split('.');
  if (groups.first.isEmpty || groups.first.length > 3) return false;
  return groups.skip(1).every((g) => g.length == 3);
}

bool _digits(String s) => s.isEmpty || RegExp(r'^[0-9]+$').hasMatch(s);

/// Texto -> número, o `null` si está vacío o no se entiende (nunca adivina).
double? parseArNumber(String input) {
  var t = input.replaceAll(RegExp(r'[\s $%]'), '');
  if (t.isEmpty) return null;
  var negative = false;
  if (t.startsWith('-')) {
    negative = true;
    t = t.substring(1);
  }
  if (t.isEmpty || !RegExp(r'^[0-9.,]+$').hasMatch(t)) return null;

  String intPart;
  var frac = '';
  final comma = t.indexOf(',');
  if (comma >= 0) {
    // Con coma: la coma es el decimal y los puntos son de miles.
    if (t.indexOf(',', comma + 1) >= 0) return null;
    intPart = t.substring(0, comma);
    frac = t.substring(comma + 1);
    if (!_validGrouping(intPart)) return null;
    intPart = intPart.replaceAll('.', '');
  } else if (t.contains('.')) {
    final parts = t.split('.');
    final thousands = parts.length >= 2 &&
        parts.first.isNotEmpty &&
        parts.first.length <= 3 &&
        !parts.first.startsWith('0') &&
        parts.skip(1).every((p) => p.length == 3);
    if (thousands) {
      intPart = parts.join();
    } else if (parts.length == 2) {
      intPart = parts[0];
      frac = parts[1];
    } else {
      return null;
    }
  } else {
    intPart = t;
  }

  if (intPart.isEmpty) intPart = '0';
  if (!_digits(intPart) || !_digits(frac)) return null;
  if (intPart.length > _maxDigits) return null;
  final value = double.tryParse(frac.isEmpty ? intPart : '$intPart.$frac');
  if (value == null) return null;
  return negative ? -value : value;
}

/// Mensaje de error (en voseo) para un campo numérico, o `null` si está bien.
String? validateArNumber(
  String? text, {
  bool required = true,
  double? min,
  double? max,
  bool integer = false,
  int maxDecimals = 2,
}) {
  final raw = (text ?? '').trim();
  if (raw.isEmpty) return required ? 'Ingresá un número.' : null;
  final v = parseArNumber(raw);
  if (v == null) return 'No entiendo ese número. Ejemplo: 1.234,50';
  if (integer && v != v.truncateToDouble()) return 'Tiene que ser un número entero.';
  if (!integer) {
    final comma = raw.indexOf(',');
    if (comma >= 0 && raw.length - comma - 1 > maxDecimals) {
      return maxDecimals == 0
          ? 'Sin decimales.'
          : 'Máximo $maxDecimals decimales.';
    }
  }
  if (min != null && v < min) {
    return min == 0 ? 'No puede ser negativo.' : 'Mínimo ${formatArNumber(min)}.';
  }
  if (max != null && v > max) return 'Máximo ${formatArNumber(max)}.';
  return null;
}

/// Limita lo que se puede tipear en un campo numérico: solo dígitos, una coma y
/// los decimales permitidos. No reescribe lo que escribe la persona (la
/// normalización "1234" -> "1.234" se hace al salir del campo).
class ArNumberInputFormatter extends TextInputFormatter {
  ArNumberInputFormatter({this.maxDecimals = 2, this.allowNegative = false});
  final int maxDecimals;
  final bool allowNegative;

  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final t = newValue.text;
    if (t.isEmpty) return newValue;
    final pattern = allowNegative ? r'^-?[0-9.,]*$' : r'^[0-9.,]*$';
    if (!RegExp(pattern).hasMatch(t)) return oldValue;
    if (','.allMatches(t).length > 1) return oldValue;
    final comma = t.indexOf(',');
    if (comma >= 0) {
      if (t.length - comma - 1 > maxDecimals) return oldValue;
      // Con coma decimal, un punto después de la coma no tiene sentido.
      if (t.substring(comma).contains('.')) return oldValue;
    }
    if (t.length > _maxDigits + 6) return oldValue;
    return newValue;
  }
}
