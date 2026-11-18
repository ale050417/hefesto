// Filtro por MES de Ventas (pedido de Agustín, 2026-11-17; mismo criterio que
// `sale-month.ts` de la web). Módulo puro, sin widgets, para poder probar el
// borde de la zona horaria.
//
// El mes de una venta se decide en hora de ARGENTINA, no en la del teléfono ni
// en UTC: una venta del 31 a las 22:30 acá ya es día 1 en UTC, y mirada en UTC
// caería en el mes siguiente.

import 'admin_models.dart';
import 'sale_status.dart';

/// Argentina está en UTC−3 todo el año (no hay horario de verano desde 2009).
const _argentinaOffset = Duration(hours: 3);

const _monthNames = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/// A qué mes (hora de Argentina) pertenece un instante, como "2026-11" (se
/// compara y ordena como texto). No importa si [date] viene en UTC o en la
/// hora del teléfono: es el mismo instante.
String monthKeyOf(DateTime date) {
  final ar = date.toUtc().subtract(_argentinaOffset);
  return '${ar.year.toString().padLeft(4, '0')}-${ar.month.toString().padLeft(2, '0')}';
}

/// Avanza (o retrocede, con [delta] negativo) meses; cruza de año solo.
String stepMonth(String key, int delta) {
  final parts = key.split('-');
  final y = int.tryParse(parts.first) ?? 0;
  final m = parts.length > 1 ? (int.tryParse(parts[1]) ?? 1) : 1;
  final total = y * 12 + (m - 1) + delta;
  final year = total ~/ 12;
  final month = total % 12 + 1;
  return '${year.toString().padLeft(4, '0')}-${month.toString().padLeft(2, '0')}';
}

/// "noviembre 2026": el año va siempre, así se nota al pasar de un año a otro.
String monthLabel(String key) {
  final parts = key.split('-');
  final m = parts.length > 1 ? (int.tryParse(parts[1]) ?? 0) : 0;
  final name = m >= 1 && m <= 12 ? _monthNames[m - 1] : key;
  return '$name ${int.tryParse(parts.first) ?? ''}'.trim();
}

/// "Noviembre 2026": para el botón del mes (en una frase va [monthLabel]).
String monthTitle(String key) {
  final label = monthLabel(key);
  return label.isEmpty ? label : '${label[0].toUpperCase()}${label.substring(1)}';
}

/// Venta todavía abierta: ni entregada, ni cancelada, ni reembolsada.
bool isOpenStatus(SaleStatus s) =>
    s != SaleStatus.delivered && s != SaleStatus.cancelled && s != SaleStatus.refunded;

/// Filtro de estado de la lista: todos, "sin cerrar" o un estado puntual.
class SaleStatusFilter {
  const SaleStatusFilter._(this.open, this.status);

  static const all = SaleStatusFilter._(false, null);

  /// Todo lo que no está entregado, cancelado ni reembolsado.
  static const unclosed = SaleStatusFilter._(true, null);
  const SaleStatusFilter.only(SaleStatus s) : this._(false, s);

  final bool open;
  final SaleStatus? status;

  bool get isAll => !open && status == null;

  bool matches(SaleStatus s) => open ? isOpenStatus(s) : (status == null || status == s);

  @override
  bool operator ==(Object other) => other is SaleStatusFilter && other.open == open && other.status == status;

  @override
  int get hashCode => Object.hash(open, status);
}

/// Lo que muestra Ventas para un mes y un estado elegidos.
class SalesMonthView {
  const SalesMonthView({
    required this.list,
    required this.inMonth,
    required this.counts,
    required this.openCount,
    required this.overdue,
    required this.inOtherMonths,
  });

  /// Las ventas a listar (mes + estado).
  final List<SaleRow> list;

  /// Cuántas hay en el mes elegido, sin mirar el estado (chip "Todos").
  final int inMonth;

  /// Cuántas hay de cada estado en el mes elegido.
  final Map<SaleStatus, int> counts;

  /// Cuántas del mes siguen sin cerrar (chip "Sin cerrar").
  final int openCount;

  /// Ventas SIN CERRAR de meses anteriores al elegido: al mirar un solo mes
  /// dejarían de verse sin que nadie las haya cerrado, así que se avisan.
  final int overdue;

  /// Cuántas quedaron fuera por ser de otro mes (para el aviso al buscar).
  final int inOtherMonths;
}

/// Arma la vista de Ventas: orden del filtrado mes → estado (el tipo y la
/// búsqueda ya vienen aplicados en [rows]). Los contadores salen ANTES del
/// filtro de estado, así cada chip dice cuántas hay en el mes elegido.
/// [month] null = todos los meses.
SalesMonthView buildSalesMonthView(
  List<SaleRow> rows, {
  required String? month,
  SaleStatusFilter status = SaleStatusFilter.all,
}) {
  final byMonth = month == null ? rows : [for (final r in rows) if (monthKeyOf(r.date) == month) r];
  final counts = <SaleStatus, int>{};
  var open = 0;
  for (final r in byMonth) {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
    if (isOpenStatus(r.status)) open++;
  }
  var overdue = 0;
  if (month != null) {
    for (final r in rows) {
      if (isOpenStatus(r.status) && monthKeyOf(r.date).compareTo(month) < 0) overdue++;
    }
  }
  return SalesMonthView(
    list: status.isAll ? byMonth : [for (final r in byMonth) if (status.matches(r.status)) r],
    inMonth: byMonth.length,
    counts: counts,
    openCount: open,
    overdue: overdue,
    inOtherMonths: rows.length - byMonth.length,
  );
}

/// "Hay 1 pedido de meses anteriores sin cerrar" / "Hay 3 pedidos…".
String overdueLabel(int n) =>
    n == 1 ? 'Hay 1 pedido de meses anteriores sin cerrar' : 'Hay $n pedidos de meses anteriores sin cerrar';
