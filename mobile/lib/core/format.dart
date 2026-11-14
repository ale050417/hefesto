import 'package:intl/intl.dart';

// El patrón por defecto de es_AR pone el símbolo DESPUÉS ("32.500 $"); la web
// muestra "$32.500", así que se fija el patrón.
final NumberFormat _ars = NumberFormat.currency(
  locale: 'es_AR',
  symbol: '\$',
  decimalDigits: 0,
  customPattern: '¤#,##0',
);

/// $33.600 (pesos argentinos, sin decimales; igual que `formatPrice` de la web).
String formatPrice(num value) => _ars.format(value);

/// "hace 2 h", "ayer", "12/10" para fechas de pedidos/notificaciones.
String formatShortDate(DateTime d) => DateFormat('dd/MM/yyyy', 'es_AR').format(d);
