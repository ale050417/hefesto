import '../filamentos/parse_util.dart';
import '../sale_status.dart';

/// Una tarjeta de la cola de producción (un pedido online o una venta manual).
class BoardCard {
  const BoardCard({
    required this.id,
    required this.source,
    required this.label,
    required this.total,
    required this.status,
    required this.ageHours,
    required this.late,
    this.customerName,
    this.createdAt,
  });

  final String id;

  /// `online` (pedido de la tienda) o `manual` (venta de mostrador).
  final String source;

  /// Qué se imprime: resumen de productos o detalle de la venta.
  final String label;
  final String? customerName;
  final double total;
  final SaleStatus status;
  final DateTime? createdAt;

  /// Horas desde que se creó (calculadas por el servidor).
  final int ageHours;

  /// Demorada: en taller (pago confirmado o en producción) hace 48 h o más.
  final bool late;

  bool get isManual => source == 'manual';

  factory BoardCard.fromJson(Map<String, dynamic> j) => BoardCard(
        id: strOf(j['id']),
        source: strOf(j['source'], 'online'),
        label: strOf(j['label'], 'Sin detalle'),
        customerName: strOrNull(j['customerName']),
        total: numOf(j['total']),
        status: SaleStatus.fromApi(strOf(j['status'])),
        createdAt: dateOf(j['createdAt']),
        ageHours: intOf(j['ageHours']),
        late: boolOf(j['late']),
      );

  /// Etapas a las que se puede pasar desde la cola: las siguientes del flujo
  /// del taller, sin cancelar ni reembolsar (eso se hace desde Ventas).
  List<SaleStatus> get nextStages =>
      status.next.where((s) => !s.isDestructive && SaleStatus.flow.contains(s)).toList();
}

class BoardColumn {
  const BoardColumn({required this.status, required this.count});
  final SaleStatus status;
  final int count;
}

/// Lo que devuelve `GET /admin/produccion`.
class BoardData {
  const BoardData({
    required this.items,
    required this.columns,
    required this.lateCount,
    this.degraded = const [],
  });

  final List<BoardCard> items;
  final List<BoardColumn> columns;
  final int lateCount;

  /// Fuentes que no se pudieron cargar (la cola puede estar incompleta).
  final List<String> degraded;

  List<BoardCard> inStage(SaleStatus s) => items.where((i) => i.status == s).toList();

  factory BoardData.fromJson(Map<String, dynamic> j) {
    final items = [for (final m in mapsOf(j['items'])) BoardCard.fromJson(m)];
    final counts = j['counts'];
    return BoardData(
      items: items,
      columns: [
        for (final s in SaleStatus.flow)
          BoardColumn(status: s, count: items.where((i) => i.status == s).length),
      ],
      lateCount: counts is Map ? intOf(counts['late']) : items.where((i) => i.late).length,
      degraded: stringsOf(j['degraded']),
    );
  }
}
