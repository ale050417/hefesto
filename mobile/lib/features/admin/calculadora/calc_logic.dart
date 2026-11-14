// Lógica chica de la pantalla de la calculadora, sin widgets (testeable). OJO:
// acá NO está la matemática del costo ni del precio: eso lo calcula el servidor
// (`computeQuote`). Esto solo prepara los datos y ordena / filtra el historial.

import 'calculadora_models.dart';

/// Horas + minutos tipeados -> horas totales (la web hace `h + m / 60`).
double totalHours(double? hours, double? minutes) => (hours ?? 0) + (minutes ?? 0) / 60;

/// ¿Hay algo para cotizar? (la web pide gramos u horas).
bool hasQuoteData(double? grams, double hours) => (grams ?? 0) > 0 || hours > 0;

/// "3 h 30 min" / "45 min" / "2 h".
String formatDuration(double hours) {
  final totalMin = (hours * 60).round();
  final h = totalMin ~/ 60;
  final m = totalMin % 60;
  if (h == 0) return '$m min';
  return m == 0 ? '$h h' : '$h h $m min';
}

enum HistorySort {
  recent('Más recientes'),
  price('Mayor precio'),
  name('Nombre');

  const HistorySort(this.label);
  final String label;
}

/// Filtra por nombre o cliente y ordena (igual que el historial de la web).
List<CalcHistoryItem> filterHistory(
  List<CalcHistoryItem> items, {
  String query = '',
  HistorySort sort = HistorySort.recent,
}) {
  final term = query.trim().toLowerCase();
  final list = items
      .where((h) =>
          term.isEmpty ||
          h.name.toLowerCase().contains(term) ||
          (h.customer ?? '').toLowerCase().contains(term))
      .toList();
  switch (sort) {
    case HistorySort.price:
      list.sort((a, b) => b.precioFinal.compareTo(a.precioFinal));
    case HistorySort.name:
      list.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    case HistorySort.recent:
      list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
  }
  return list;
}
