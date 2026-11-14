// Modelos de la carga / edición de ventas manuales (`/api/v1/admin/manual-sales`).
// Igual que en el resto del panel, el servidor decide y calcula todo (precio de
// la tienda, carretes, costos, stock); la app arma el borrador y lo muestra.

import '../sale_status.dart';

double _d(Object? v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
int _i(Object? v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
DateTime? _t(Object? v) => v == null ? null : DateTime.tryParse('$v')?.toLocal();
String? _s(Object? v) {
  final s = v?.toString().trim();
  return (s == null || s.isEmpty) ? null : s;
}

double _round2(double n) => (n * 100).round() / 100;

/// Lee un monto tipeado: "2500", "2.500", "2.500,50", "2500,5", "$ 2.500".
/// Devuelve null si está vacío o no se entiende.
double? parseMoney(String? raw) {
  var t = (raw ?? '').replaceAll(RegExp(r'[\s$]'), '');
  if (t.isEmpty) return null;
  final hasComma = t.contains(',');
  final hasDot = t.contains('.');
  if (hasComma && hasDot) {
    // El último separador es el decimal; el otro agrupa miles.
    final decimalIsComma = t.lastIndexOf(',') > t.lastIndexOf('.');
    t = decimalIsComma
        ? t.replaceAll('.', '').replaceAll(',', '.')
        : t.replaceAll(',', '');
  } else if (hasComma) {
    t = t.replaceAll(',', '.');
  } else if (hasDot && RegExp(r'^\d{1,3}(\.\d{3})+$').hasMatch(t)) {
    t = t.replaceAll('.', ''); // "2.500" = dos mil quinientos
  }
  final v = double.tryParse(t);
  return (v == null || v.isNaN || v.isInfinite) ? null : v;
}

/// Un monto para mostrar en un campo de texto: 2500 → "2500", 2500.5 → "2500.5".
String moneyText(double? v) {
  if (v == null) return '';
  if (v == v.roundToDouble()) return v.round().toString();
  return _round2(v).toString();
}

String _ymd(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// Fecha "YYYY-MM-DD" que viaja a la API (sin zona horaria).
String saleDateParam(DateTime d) => _ymd(d);

// ---------------------------------------------------------------------------
// Catálogo (qué se puede vender y a qué precio)
// ---------------------------------------------------------------------------

class SaleCatalogColor {
  SaleCatalogColor({required this.name, this.hex});
  final String name;

  /// "#CC2200" del catálogo de colores; null = el color no tiene hex cargado.
  final String? hex;

  factory SaleCatalogColor.fromJson(Map<String, dynamic> j) =>
      SaleCatalogColor(name: _s(j['name']) ?? '', hex: _s(j['hex']));
}

/// Una combinación vendible (tamaño × color) con el precio que cobra la tienda.
class SaleCatalogOption {
  SaleCatalogOption({
    this.variantLabel,
    this.color,
    required this.unitPrice,
    this.weightGrams = 0,
    this.extrasCost = 0,
    this.hasStock = false,
  });

  final String? variantLabel;
  final String? color;
  final double unitPrice;
  final double weightGrams;
  final double extrasCost;

  /// false = el producto no tiene carrete/gramos cargados: no descuenta stock
  /// ni permite calcular el costo (hay que cargarlo a mano).
  final bool hasStock;

  factory SaleCatalogOption.fromJson(Map<String, dynamic> j) => SaleCatalogOption(
        variantLabel: _s(j['variantLabel']),
        color: _s(j['color']),
        unitPrice: _d(j['unitPrice']),
        weightGrams: _d(j['weightGrams']),
        extrasCost: _d(j['extrasCost']),
        hasStock: j['hasStock'] == true,
      );
}

class SaleCatalogProduct {
  SaleCatalogProduct({
    required this.id,
    required this.name,
    this.categoryName,
    required this.price,
    this.isMulti = false,
    this.colors = const [],
    this.variants = const [],
    this.options = const [],
  });

  final String id;
  final String name;
  final String? categoryName;
  final double price;

  /// Multicolor: la combinación es fija y no se elige color.
  final bool isMulti;
  final List<SaleCatalogColor> colors;
  final List<String> variants;
  final List<SaleCatalogOption> options;

  String? get defaultVariant => variants.isEmpty ? null : variants.first;
  String? get defaultColor =>
      (!isMulti && colors.isNotEmpty) ? colors.first.name : null;

  /// La opción de una elección; si el servidor no la mandó, la más parecida.
  SaleCatalogOption? optionFor(String? variant, String? color) {
    for (final o in options) {
      if (o.variantLabel == variant && o.color == color) return o;
    }
    for (final o in options) {
      if (o.variantLabel == variant) return o;
    }
    return options.isEmpty ? null : options.first;
  }

  /// Rango de precios entre todas las combinaciones (para la lista).
  ({double min, double max}) get priceRange {
    if (options.isEmpty) return (min: price, max: price);
    var lo = options.first.unitPrice;
    var hi = lo;
    for (final o in options) {
      if (o.unitPrice < lo) lo = o.unitPrice;
      if (o.unitPrice > hi) hi = o.unitPrice;
    }
    return (min: lo, max: hi);
  }

  /// Ninguna combinación descuenta stock.
  bool get noneHasStock => options.isNotEmpty && options.every((o) => !o.hasStock);

  factory SaleCatalogProduct.fromJson(Map<String, dynamic> j) => SaleCatalogProduct(
        id: j['id'] as String,
        name: _s(j['name']) ?? 'Producto',
        categoryName: _s(j['categoryName']),
        price: _d(j['price']),
        isMulti: j['colorMode'] == 'multi',
        colors: ((j['colors'] as List?) ?? [])
            .whereType<Map>()
            .map((e) => SaleCatalogColor.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
        variants: ((j['variants'] as List?) ?? []).map((e) => '$e').toList(),
        options: ((j['options'] as List?) ?? [])
            .whereType<Map>()
            .map((e) => SaleCatalogOption.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
      );
}

class SaleCatalogPage {
  SaleCatalogPage({required this.items, required this.total});
  final List<SaleCatalogProduct> items;
  final int total;

  factory SaleCatalogPage.fromJson(Map<String, dynamic> j) => SaleCatalogPage(
        items: ((j['items'] as List?) ?? [])
            .whereType<Map>()
            .map((e) => SaleCatalogProduct.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
        total: _i(j['total']),
      );
}

/// Ayudas del formulario: categorías del catálogo y clientes anteriores.
class SaleFormData {
  SaleFormData({this.categories = const [], this.recentCustomers = const []});
  final List<String> categories;
  final List<String> recentCustomers;

  factory SaleFormData.fromJson(Map<String, dynamic> j) => SaleFormData(
        categories: ((j['categories'] as List?) ?? []).map((e) => '$e').toList(),
        recentCustomers:
            ((j['recentCustomers'] as List?) ?? []).map((e) => '$e').toList(),
      );
}

// ---------------------------------------------------------------------------
// Borrador de la venta (lo que se arma en el formulario)
// ---------------------------------------------------------------------------

const Object _keep = Object();

/// `copyWith` distingue "no tocar" ([_keep]) de "dejar vacío" (null).
double? _numOrNull(Object? v) => v == null ? null : (v as num).toDouble();

int _uidSeed = 0;

/// Identificador local para las líneas e insumos del borrador.
int nextDraftUid() => ++_uidSeed;

/// Una línea de la venta: un producto del catálogo (con su tamaño y color) o un
/// texto libre.
class SaleDraftLine {
  SaleDraftLine({
    required this.uid,
    this.productId,
    required this.name,
    this.variantLabel,
    this.color,
    this.colorHex,
    this.quantity = 1,
    this.unitPrice,
    this.catalogPrice,
    this.hasStock = false,
    this.unitCost,
  });

  /// Identificador local (para las claves de los widgets); no viaja al servidor.
  final int uid;
  final String? productId;
  final String name;
  final String? variantLabel;
  final String? color;
  final String? colorHex;
  final int quantity;

  /// Precio unitario que cobra el dueño; null mientras el campo está vacío.
  final double? unitPrice;

  /// Precio de la tienda para esa elección (para volver a él).
  final double? catalogPrice;

  /// El producto tiene carrete y gramos: descuenta stock y el costo sale del
  /// filamento. Sin esto hay que cargar el costo a mano.
  final bool hasStock;

  /// Costo por unidad cargado a mano (solo cuando no hay stock calculable).
  final double? unitCost;

  bool get isCatalog => productId != null;
  bool get needsCost => !hasStock;

  /// Misma elección = misma línea (se suman las cantidades).
  String get mergeKey =>
      '${productId ?? 'libre$uid'}|${variantLabel ?? ''}|${color ?? ''}';

  double get lineTotal => _round2((unitPrice ?? 0) * quantity);

  /// "Grande · Rojo" (lo que se muestra debajo del nombre).
  String? get subtitle {
    final parts = [variantLabel, color].whereType<String>().toList();
    return parts.isEmpty ? null : parts.join(' · ');
  }

  SaleDraftLine copyWith({
    int? quantity,
    Object? unitPrice = _keep,
    Object? unitCost = _keep,
  }) =>
      SaleDraftLine(
        uid: uid,
        productId: productId,
        name: name,
        variantLabel: variantLabel,
        color: color,
        colorHex: colorHex,
        quantity: quantity ?? this.quantity,
        unitPrice:
            identical(unitPrice, _keep) ? this.unitPrice : _numOrNull(unitPrice),
        catalogPrice: catalogPrice,
        hasStock: hasStock,
        unitCost:
            identical(unitCost, _keep) ? this.unitCost : _numOrNull(unitCost),
      );

  Map<String, dynamic> toJson() => {
        'productId': ?productId,
        'productName': name,
        'variantLabel': ?variantLabel,
        'color': ?color,
        'quantity': quantity,
        'unitPrice': ?unitPrice,
        if (needsCost) 'unitCost': ?unitCost,
      };
}

/// Insumo cargado a mano (argollas, vaso…): se cobra y suma al costo.
class SaleDraftExtra {
  SaleDraftExtra({required this.uid, this.name = '', this.cost, this.qty = 1});
  final int uid;
  final String name;
  final double? cost;
  final int qty;

  bool get isBlank => name.trim().isEmpty && cost == null;
  double get total => _round2((cost ?? 0) * qty);

  SaleDraftExtra copyWith({String? name, Object? cost = _keep, int? qty}) =>
      SaleDraftExtra(
        uid: uid,
        name: name ?? this.name,
        cost: identical(cost, _keep) ? this.cost : _numOrNull(cost),
        qty: qty ?? this.qty,
      );
}

/// La venta completa que arma el formulario. Lógica PURA (testeable): el total
/// que se muestra, qué falta y el cuerpo que se manda al servidor.
class SaleDraft {
  SaleDraft({
    this.customer = '',
    DateTime? date,
    this.detail = '',
    this.category,
    this.paymentMethod = 'cash',
    this.status = SaleStatus.pendingPayment,
    List<SaleDraftLine>? lines,
    List<SaleDraftExtra>? extras,
  })  : date = date ?? DateTime.now(),
        lines = lines ?? [],
        extras = extras ?? [];

  String customer;
  DateTime date;
  String detail;
  String? category;
  String paymentMethod;
  SaleStatus status;
  final List<SaleDraftLine> lines;
  final List<SaleDraftExtra> extras;

  int get units => lines.fold(0, (s, l) => s + l.quantity);

  /// Insumos cargados a mano (se cobran).
  double get extrasTotal => _round2(
        extras.where((e) => !e.isBlank).fold(0.0, (s, e) => s + e.total),
      );

  /// Lo que se le cobra al cliente: las líneas más los insumos a mano.
  double get total =>
      _round2(lines.fold(0.0, (s, l) => s + l.lineTotal) + extrasTotal);

  /// ¿Se cargó algo? (para avisar antes de descartar).
  bool get isDirty =>
      customer.trim().isNotEmpty ||
      detail.trim().isNotEmpty ||
      lines.isNotEmpty ||
      extras.any((e) => !e.isBlank);

  /// Lo primero que falta para poder registrar la venta; null = lista.
  String? get problem {
    if (customer.trim().isEmpty) return 'Falta el nombre del cliente.';
    if (lines.isEmpty) return 'Agregá al menos un producto.';
    for (final l in lines) {
      if (l.name.trim().isEmpty) return 'Poné el nombre del producto.';
      if (l.unitPrice == null) return 'Poné el precio de "${l.name}".';
      if (l.needsCost && l.unitCost == null) {
        return 'Cargá el costo de "${l.name}" (poné 0 si no tuvo).';
      }
    }
    for (final e in extras) {
      if (!e.isBlank && e.cost == null) return 'Completá el costo del insumo.';
    }
    if (!(total > 0)) return 'El total tiene que ser mayor a 0.';
    return null;
  }

  Map<String, dynamic> toJson() => {
        'saleDate': _ymd(date),
        'customerName': customer.trim(),
        if (detail.trim().isNotEmpty) 'detail': detail.trim(),
        if (category != null && category!.isNotEmpty) 'category': category,
        'paymentMethod': paymentMethod,
        'status': status.api,
        'items': [for (final l in lines) l.toJson()],
        if (extras.any((e) => !e.isBlank))
          'extras': [
            for (final e in extras.where((e) => !e.isBlank))
              {
                if (e.name.trim().isNotEmpty) 'name': e.name.trim(),
                'cost': e.cost ?? 0,
                'qty': e.qty,
              },
          ],
      };
}

/// Respuesta de crear una venta.
class CreatedSale {
  CreatedSale({required this.id, required this.total});
  final String id;
  final double total;

  factory CreatedSale.fromJson(Map<String, dynamic> j) =>
      CreatedSale(id: j['id'] as String, total: _d(j['total']));
}

// ---------------------------------------------------------------------------
// Edición de una venta manual ya cargada
// ---------------------------------------------------------------------------

/// Lo que se puede cambiar de una venta cargada (el servidor recalcula la
/// ganancia y no toca stock ni estado).
class ManualSaleEditData {
  ManualSaleEditData({
    required this.id,
    required this.saleDate,
    required this.customerName,
    this.detail,
    this.category,
    required this.paymentMethod,
    required this.total,
    this.amortization,
    this.profit,
    required this.status,
    this.quantity = 1,
  });

  final String id;
  final DateTime saleDate;
  final String customerName;
  final String? detail;
  final String? category;
  final String paymentMethod;
  final double total;

  /// Costo (material + insumos). Null en ventas viejas o si el rol no lo ve.
  final double? amortization;
  final double? profit;
  final SaleStatus status;
  final int quantity;

  factory ManualSaleEditData.fromJson(Map<String, dynamic> j) =>
      ManualSaleEditData(
        id: j['id'] as String,
        saleDate: _t(j['saleDate']) ?? DateTime.now(),
        customerName: _s(j['customerName']) ?? '',
        detail: _s(j['detail']),
        category: _s(j['category']),
        paymentMethod: (j['paymentMethod'] as String?) ?? 'cash',
        total: _d(j['total']),
        amortization: j['amortization'] == null ? null : _d(j['amortization']),
        profit: j['profit'] == null ? null : _d(j['profit']),
        status: SaleStatus.fromApi(j['status'] as String?),
        quantity: _i(j['quantity']) < 1 ? 1 : _i(j['quantity']),
      );
}

/// Cuerpo del PATCH de edición.
Map<String, dynamic> manualSaleEditBody({
  required DateTime date,
  required String customer,
  required String detail,
  required String category,
  required double total,
  required double amortization,
  required String paymentMethod,
}) =>
    {
      'saleDate': _ymd(date),
      'customerName': customer.trim(),
      'detail': detail.trim(),
      'category': category.trim(),
      'total': total,
      'amortization': amortization,
      'paymentMethod': paymentMethod,
    };

/// Ganancia que calcula el servidor al editar: max(0, total − costo).
double editedProfit(double total, double amortization) {
  final cost = amortization < 0 ? 0.0 : amortization;
  final p = total - cost;
  return _round2(p < 0 ? 0 : p);
}
