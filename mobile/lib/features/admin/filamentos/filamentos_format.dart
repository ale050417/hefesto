import 'package:intl/intl.dart';

final NumberFormat _int = NumberFormat.decimalPattern('es_AR');

/// "840 g" · "25,5 g" · "1,25 kg" (a partir de 1000 g). Los gramos con
/// decimales no se redondean: 25,5 g no se muestra como 26 g.
String formatGrams(double g) {
  if (g.abs() >= 999.95) {
    return '${(g / 1000).toStringAsFixed(2).replaceAll('.', ',')} kg';
  }
  final whole = g.roundToDouble();
  if ((g - whole).abs() < 0.05) return '${_int.format(whole.toInt())} g';
  return '${g.toStringAsFixed(1).replaceAll('.', ',')} g';
}

/// Cantidad con signo para el historial: "+1.000 g" · "-80 g".
String formatDeltaGrams(double g) {
  final abs = g.abs();
  final txt = abs % 1 == 0
      ? _int.format(abs.round())
      : abs.toStringAsFixed(2).replaceAll('.', ',');
  return '${g < 0 ? '-' : '+'}$txt g';
}

/// Texto de un número para un campo editable: sin ".0" sobrante.
String gramsField(double v) =>
    v % 1 == 0 ? v.round().toString() : v.toString();

/// Lo que el usuario tipeó ("1.5", "1,5", " 250 ") → número, o null si no es uno.
double? parseNumber(String text) {
  final t = text.trim().replaceAll(',', '.');
  if (t.isEmpty) return null;
  final v = double.tryParse(t);
  return (v == null || v.isNaN || v.isInfinite) ? null : v;
}

/// "hace 3 h" · "hace 2 d" · "recién" (para antigüedades).
String formatAgo(int hours) {
  if (hours < 1) return 'recién';
  if (hours < 24) return 'hace $hours h';
  return 'hace ${hours ~/ 24} d';
}

/// Texto listo para pegar a un cliente con los colores que HAY en stock (el
/// mismo de "Copiar colores" en la web). Un color con stock 0 o negativo no
/// entra; sin repetir y en orden alfabético.
String colorsTemplate(Iterable<({String color, double stockGrams})> items) {
  final colors = <String>{
    for (final i in items)
      if (i.stockGrams > 0 && i.color.trim().isNotEmpty) i.color.trim(),
  }.toList()
    ..sort((a, b) => a.toLowerCase().compareTo(b.toLowerCase()));
  if (colors.isEmpty) return 'Por ahora no tenemos colores en stock.';
  return '¡Hola! 🎨 Estos son los colores que tenemos disponibles ahora:\n\n'
      '${colors.map((c) => '• $c').join('\n')}\n\n'
      '¿Con cuál te gustaría tu pieza?';
}
