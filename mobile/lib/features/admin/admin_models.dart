// Modelos del panel de administración (`/api/v1/admin/*`). Igual que en la
// tienda, el servidor decide y calcula todo; la app solo lo muestra.

import 'sale_status.dart';

double _d(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
int _i(dynamic v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
DateTime _t(dynamic v) => DateTime.tryParse('$v')?.toLocal() ?? DateTime.now();
DateTime? _tn(dynamic v) => v == null ? null : DateTime.tryParse('$v')?.toLocal();
String? _s(dynamic v) {
  final s = v?.toString().trim();
  return (s == null || s.isEmpty) ? null : s;
}

/// Una fila del listado de ventas (pedido online o venta manual de mostrador).
class SaleRow {
  SaleRow({
    required this.id,
    required this.source,
    required this.date,
    required this.customerName,
    required this.label,
    required this.ref,
    required this.paymentMethod,
    required this.status,
    required this.total,
  });

  final String id;

  /// `online` (tienda) o `manual` (mostrador).
  final String source;
  final DateTime date;
  final String? customerName;
  final String label;
  final String? ref;
  final String paymentMethod;
  final SaleStatus status;
  final double total;

  bool get isManual => source == 'manual';

  factory SaleRow.fromJson(Map<String, dynamic> j) => SaleRow(
        id: j['id'] as String,
        source: (j['source'] as String?) ?? 'online',
        date: _t(j['date']),
        customerName: _s(j['customerName']),
        label: (j['label'] as String?) ?? '',
        ref: _s(j['ref']),
        paymentMethod: (j['paymentMethod'] as String?) ?? '',
        status: SaleStatus.fromApi(j['status'] as String?),
        total: _d(j['total']),
      );

  /// Los "últimos pedidos" del inicio llegan con la forma de `OrderListItem`.
  factory SaleRow.fromOrderItem(Map<String, dynamic> j) => SaleRow(
        id: j['id'] as String,
        source: 'online',
        date: _t(j['createdAt']),
        customerName: _s(j['customerName']),
        label: (j['itemsSummary'] as String?) ?? '',
        ref: _s(j['orderNumber']),
        paymentMethod: (j['paymentMethod'] as String?) ?? '',
        status: SaleStatus.fromApi(j['status'] as String?),
        total: _d(j['total']),
      );
}

class SalesPage {
  SalesPage({required this.items, required this.total});
  final List<SaleRow> items;
  final int total;

  factory SalesPage.fromJson(Map<String, dynamic> j) => SalesPage(
        items: ((j['items'] as List?) ?? [])
            .map((e) => SaleRow.fromJson(e as Map<String, dynamic>))
            .toList(),
        total: _i(j['total']),
      );
}

/// Filtros del listado (con igualdad por valor: sirven de clave del provider).
typedef SalesFilter = ({String type, String? status, String q});

class RevenuePoint {
  RevenuePoint(this.date, this.total);
  final DateTime date;
  final double total;
}

class FilamentStock {
  FilamentStock({
    required this.id,
    required this.material,
    required this.color,
    required this.brand,
    required this.diameter,
    required this.stockGrams,
    required this.spoolGrams,
    required this.alertThresholdGrams,
    required this.status,
    this.hex,
  });

  final String id;
  final String material;
  final String color;
  final String brand;
  final String diameter;
  final double stockGrams;
  final double spoolGrams;
  final double alertThresholdGrams;

  /// `ok` · `bajo` · `agotado` (lo calcula el servidor).
  final String status;
  final String? hex;

  bool get isOut => status == 'agotado';
  bool get isLow => status == 'bajo';

  factory FilamentStock.fromJson(Map<String, dynamic> j) => FilamentStock(
        id: j['id'] as String,
        material: (j['material'] as String?) ?? '',
        color: (j['color'] as String?) ?? '',
        brand: (j['brand'] as String?) ?? '',
        diameter: (j['diameter'] as String?) ?? '',
        stockGrams: _d(j['stockGrams']),
        spoolGrams: _d(j['spoolGrams']),
        alertThresholdGrams: _d(j['alertThresholdGrams']),
        status: (j['status'] as String?) ?? 'ok',
        hex: _s(j['hex']),
      );
}

class StockPage {
  StockPage({required this.items, required this.low, required this.out});
  final List<FilamentStock> items;
  final int low;
  final int out;

  factory StockPage.fromJson(Map<String, dynamic> j) {
    final counts = (j['counts'] as Map?) ?? const {};
    return StockPage(
      items: ((j['items'] as List?) ?? [])
          .map((e) => FilamentStock.fromJson(e as Map<String, dynamic>))
          .toList(),
      low: _i(counts['low']),
      out: _i(counts['out']),
    );
  }
}

class AdminDashboard {
  AdminDashboard({
    required this.greetingName,
    required this.revenue,
    required this.salesCount,
    required this.pendingCount,
    required this.lowStockCount,
    required this.series,
    required this.last7,
    required this.last30,
    required this.pendingPayment,
    required this.inProduction,
    required this.ready,
    required this.recent,
    required this.lowStock,
    required this.degraded,
  });

  final String? greetingName;
  final double revenue;
  final int salesCount;
  final int pendingCount;
  final int lowStockCount;
  final List<RevenuePoint> series;
  final double last7;
  final double last30;
  final int pendingPayment;
  final int inProduction;
  final int ready;
  final List<SaleRow> recent;
  final List<FilamentStock> lowStock;

  /// Fuentes que fallaron en el servidor ("los KPIs", …): el panel avisa que
  /// los datos son parciales en vez de mostrar ceros que parecen reales.
  final List<String> degraded;

  factory AdminDashboard.fromJson(Map<String, dynamic> j) {
    final kpis = (j['kpis'] as Map?) ?? const {};
    final counts = (j['counts'] as Map?) ?? const {};
    return AdminDashboard(
      greetingName: _s(j['greetingName']),
      revenue: _d(kpis['revenue']),
      salesCount: _i(kpis['salesCount']),
      pendingCount: _i(kpis['pendingCount']),
      lowStockCount: _i(kpis['lowStockCount']),
      series: ((j['revenueSeries'] as List?) ?? [])
          .map((e) => RevenuePoint(_t((e as Map)['date']), _d(e['total'])))
          .toList(),
      last7: _d(j['last7']),
      last30: _d(j['last30']),
      pendingPayment: _i(counts['pendingPayment']),
      inProduction: _i(counts['inProduction']),
      ready: _i(counts['ready']),
      recent: ((j['recentOrders'] as List?) ?? [])
          .map((e) => SaleRow.fromOrderItem(e as Map<String, dynamic>))
          .toList(),
      lowStock: ((j['lowStock'] as List?) ?? [])
          .map((e) => FilamentStock.fromJson(e as Map<String, dynamic>))
          .toList(),
      degraded: ((j['degraded'] as List?) ?? []).map((e) => '$e').toList(),
    );
  }
}

class SaleLine {
  SaleLine({
    required this.name,
    this.variant,
    required this.unitPrice,
    required this.quantity,
    required this.lineTotal,
  });
  final String name;
  final String? variant;
  final double unitPrice;
  final int quantity;
  final double lineTotal;
}

class StatusEvent {
  StatusEvent({required this.from, required this.to, required this.note, required this.at});
  final SaleStatus? from;
  final SaleStatus to;
  final String? note;
  final DateTime at;
}

/// Detalle de una venta, unificado: el pedido online y la venta manual se ven
/// con la misma pantalla (lo que no existe en uno de los dos mundos queda null).
class SaleDetail {
  SaleDetail({
    required this.source,
    required this.id,
    required this.title,
    required this.status,
    required this.paymentMethod,
    required this.total,
    required this.subtotal,
    required this.discount,
    required this.shipping,
    required this.date,
    this.paidAt,
    this.customerName,
    this.customerPhone,
    this.address,
    this.trackingCode,
    this.internalNote,
    this.cancelReason,
    this.detail,
    this.category,
    this.quantity = 1,
    this.items = const [],
    this.history = const [],
  });

  final String source;
  final String id;
  final String title;
  final SaleStatus status;
  final String paymentMethod;
  final double total;
  final double subtotal;
  final double discount;
  final double shipping;
  final DateTime date;
  final DateTime? paidAt;
  final String? customerName;
  final String? customerPhone;
  final Map<String, dynamic>? address;
  final String? trackingCode;
  final String? internalNote;
  final String? cancelReason;
  final String? detail;
  final String? category;
  final int quantity;
  final List<SaleLine> items;
  final List<StatusEvent> history;

  bool get isManual => source == 'manual';

  /// "Av. Siempreviva 742 · Centro, Posadas, Misiones (3300)" o el tipo de
  /// entrega si no hay dirección (retiro en el taller).
  String? get addressText {
    final a = address;
    if (a == null) return null;
    final type = a['deliveryType'];
    if (type == 'pickup') return 'Retira en el taller';
    final street = _s(a['street']);
    final zone = _s(a['zone']);
    final place = [
      _s(a['city']),
      _s(a['province']),
    ].whereType<String>().join(', ');
    final cp = _s(a['postalCode']);
    final parts = [
      street,
      ?zone,
      if (place.isNotEmpty) cp == null ? place : '$place ($cp)',
    ].whereType<String>();
    return parts.isEmpty ? null : parts.join(' · ');
  }

  String? get addressNotes => _s(address?['notes']);

  static String? deliveryLabel(Map<String, dynamic>? a) => switch (a?['deliveryType']) {
        'pickup' => 'Retiro en el taller',
        'local' => 'Envío local',
        'national' => 'Envío al resto del país',
        _ => null,
      };

  factory SaleDetail.online(Map<String, dynamic> j) {
    final customer = j['customer'] as Map?;
    final address = j['shippingAddress'] is Map
        ? Map<String, dynamic>.from(j['shippingAddress'] as Map)
        : null;
    return SaleDetail(
      source: 'online',
      id: j['id'] as String,
      title: _s(j['orderNumber']) ?? 'Pedido',
      status: SaleStatus.fromApi(j['status'] as String?),
      paymentMethod: (j['paymentMethod'] as String?) ?? '',
      total: _d(j['total']),
      subtotal: _d(j['subtotal']),
      discount: _d(j['discountAmount']),
      shipping: _d(j['shippingCost']),
      date: _t(j['createdAt']),
      paidAt: _tn(j['paidAt']),
      customerName: _s(customer?['fullName']) ?? _s(address?['fullName']),
      customerPhone: _s(customer?['phone']) ?? _s(address?['phone']),
      address: address,
      trackingCode: _s(j['trackingCode']),
      internalNote: _s(j['internalNote']),
      cancelReason: _s(j['cancelReason']),
      items: ((j['items'] as List?) ?? [])
          .map((e) => e as Map<String, dynamic>)
          .map((i) => SaleLine(
                name: (i['productName'] as String?) ?? 'Producto',
                variant: _s(i['variantLabel']),
                unitPrice: _d(i['unitPrice']),
                quantity: _i(i['quantity']),
                lineTotal: _d(i['lineTotal']),
              ))
          .toList(),
      history: ((j['history'] as List?) ?? [])
          .map((e) => e as Map<String, dynamic>)
          .map((h) => StatusEvent(
                from: h['fromStatus'] == null
                    ? null
                    : SaleStatus.fromApi(h['fromStatus'] as String?),
                to: SaleStatus.fromApi(h['toStatus'] as String?),
                note: _s(h['note']),
                at: _t(h['createdAt']),
              ))
          .toList(),
    );
  }

  factory SaleDetail.manual(Map<String, dynamic> j) {
    final total = _d(j['total']);
    final qty = _i(j['quantity']);
    final lines = ((j['items'] as List?) ?? [])
        .map((e) => e as Map<String, dynamic>)
        .map((i) {
      final variant = [_s(i['variantLabel']), _s(i['color'])].whereType<String>().join(' · ');
      return SaleLine(
        name: _s(i['productName']) ?? _s(j['detail']) ?? 'Producto',
        variant: variant.isEmpty ? null : variant,
        unitPrice: _d(i['unitPrice']),
        quantity: _i(i['quantity']),
        lineTotal: _d(i['lineTotal']),
      );
    }).toList();
    return SaleDetail(
      source: 'manual',
      id: j['id'] as String,
      title: 'Venta manual',
      status: SaleStatus.fromApi(j['status'] as String?),
      paymentMethod: (j['paymentMethod'] as String?) ?? '',
      total: total,
      subtotal: total,
      discount: 0,
      shipping: 0,
      date: _t(j['saleDate']),
      customerName: _s(j['customerName']),
      cancelReason: _s(j['cancelReason']),
      detail: _s(j['detail']),
      category: _s(j['category']),
      quantity: qty < 1 ? 1 : qty,
      // Venta simple (sin desglose): una sola línea con el detalle cargado.
      items: lines.isNotEmpty
          ? lines
          : [
              SaleLine(
                name: _s(j['detail']) ?? 'Venta de mostrador',
                unitPrice: qty > 0 ? total / qty : total,
                quantity: qty < 1 ? 1 : qty,
                lineTotal: total,
              ),
            ],
    );
  }
}
