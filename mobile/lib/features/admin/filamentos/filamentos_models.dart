import '../admin_models.dart' show FilamentStock;
import 'parse_util.dart';

/// Un carrete completo (con costo), tal como lo devuelve `/admin/filaments/:id`.
/// El modelo compartido `FilamentStock` no trae el costo por kg; este sí.
class Filamento {
  const Filamento({
    required this.id,
    required this.material,
    required this.color,
    required this.brand,
    required this.diameter,
    required this.stockGrams,
    required this.spoolGrams,
    required this.costPerKg,
    required this.alertThresholdGrams,
    required this.status,
    this.hex,
  });

  final String id;
  final String material;
  final String color;
  final String brand;
  final String diameter;

  /// Puede ser NEGATIVO: se vendió más de lo cargado (deuda de filamento).
  final double stockGrams;
  final double spoolGrams;
  final double costPerKg;
  final double alertThresholdGrams;

  /// `ok` · `bajo` · `agotado` (lo calcula el servidor).
  final String status;
  final String? hex;

  bool get isOut => status == 'agotado';
  bool get isLow => status == 'bajo';

  /// Gramos que se deben (stock negativo); 0 si no hay deuda.
  double get debtGrams => stockGrams < 0 ? -stockGrams : 0;

  /// Valor del stock disponible (la deuda no resta).
  double get stockValue => (stockGrams < 0 ? 0 : stockGrams) / 1000 * costPerKg;

  /// "PLA · Rojo · Grilon3" (la marca desambigua carretes del mismo color).
  String get tag => [material, color, if (brand.isNotEmpty) brand].join(' · ');

  factory Filamento.fromJson(Map<String, dynamic> j) => Filamento(
        id: strOf(j['id']),
        material: strOf(j['material']),
        color: strOf(j['color']),
        brand: strOf(j['brand']),
        diameter: strOf(j['diameter']),
        stockGrams: numOf(j['stockGrams']),
        spoolGrams: numOf(j['spoolGrams']),
        costPerKg: numOf(j['costPerKg']),
        alertThresholdGrams: numOf(j['alertThresholdGrams']),
        status: strOf(j['status'], 'ok'),
        hex: strOrNull(j['hex']),
      );

  /// Para reusar `FilamentTile` (el modelo del listado compartido).
  FilamentStock toStock() => FilamentStock(
        id: id,
        material: material,
        color: color,
        brand: brand,
        diameter: diameter,
        stockGrams: stockGrams,
        spoolGrams: spoolGrams,
        alertThresholdGrams: alertThresholdGrams,
        status: status,
        hex: hex,
      );
}

/// Los datos que se cargan en el formulario de un carrete.
class FilamentoDraft {
  const FilamentoDraft({
    required this.material,
    required this.color,
    required this.brand,
    required this.diameter,
    required this.stockGrams,
    required this.spoolGrams,
    required this.costPerKg,
    required this.alertThresholdGrams,
  });

  final String material;
  final String color;
  final String brand;
  final String diameter;
  final double stockGrams;
  final double spoolGrams;
  final double costPerKg;
  final double alertThresholdGrams;

  /// Alta: el carrete nace con su stock inicial.
  Map<String, dynamic> toCreateJson() => {...toUpdateJson(), 'stockGrams': stockGrams};

  /// Edición: SIN stock (el stock se mueve solo con un ajuste, que queda en el
  /// historial).
  Map<String, dynamic> toUpdateJson() => {
        'material': material,
        'color': color,
        'brand': brand,
        'diameter': diameter,
        'spoolGrams': spoolGrams,
        'costPerKg': costPerKg,
        'alertThresholdGrams': alertThresholdGrams,
      };
}

/// Un movimiento del ledger de filamento (venta, falla, ajuste, reposición).
class FilamentMovement {
  const FilamentMovement({
    required this.id,
    required this.material,
    required this.color,
    required this.deltaGrams,
    required this.reason,
    required this.reasonLabel,
    this.filamentId,
    this.ref,
    this.createdAt,
  });

  final String id;
  final String? filamentId;
  final String material;
  final String color;

  /// Con signo: negativo = consumo, positivo = reposición.
  final double deltaGrams;
  final String reason;
  final String reasonLabel;

  /// Origen legible: nº de pedido, cliente de la venta o pieza de la falla.
  final String? ref;
  final DateTime? createdAt;

  bool get isDown => deltaGrams < 0;

  factory FilamentMovement.fromJson(Map<String, dynamic> j) => FilamentMovement(
        id: strOf(j['id']),
        filamentId: strOrNull(j['filamentId']),
        material: strOf(j['material']),
        color: strOf(j['color']),
        deltaGrams: numOf(j['deltaGrams']),
        reason: strOf(j['reason']),
        reasonLabel: strOf(j['reasonLabel'], strOf(j['reason'])),
        ref: strOrNull(j['ref']),
        createdAt: dateOf(j['createdAt']),
      );
}

class CatalogColor {
  const CatalogColor(this.name, this.hex);
  final String name;
  final String? hex;
}

/// Colores, marcas y materiales para los selectores del formulario.
class FilamentCatalog {
  const FilamentCatalog({
    this.colors = const [],
    this.brands = const [],
    this.materials = const [],
    this.diameters = const ['1.75', '2.85', '—'],
  });

  final List<CatalogColor> colors;
  final List<String> brands;
  final List<String> materials;
  final List<String> diameters;

  factory FilamentCatalog.fromJson(Map<String, dynamic> j) {
    final diameters = stringsOf(j['diameters']);
    return FilamentCatalog(
      colors: [
        for (final c in mapsOf(j['colors']))
          if (strOf(c['name']).isNotEmpty) CatalogColor(strOf(c['name']), strOrNull(c['hex'])),
      ],
      brands: [
        for (final b in mapsOf(j['brands']))
          if (strOf(b['name']).isNotEmpty) strOf(b['name']),
      ],
      materials: [
        for (final m in mapsOf(j['materials']))
          if (strOf(m['name']).isNotEmpty) strOf(m['name']),
      ],
      diameters: diameters.isEmpty ? const ['1.75', '2.85', '—'] : diameters,
    );
  }

  String? hexOf(String color) {
    final k = color.trim().toLowerCase();
    for (final c in colors) {
      if (c.name.trim().toLowerCase() == k) return c.hex;
    }
    return null;
  }
}

/// Resultado de un ajuste de stock.
class StockAdjustResult {
  const StockAdjustResult({
    required this.deltaGrams,
    required this.previousStock,
    required this.newStock,
    required this.lowStock,
  });

  final double deltaGrams;
  final double previousStock;
  final double newStock;
  final bool lowStock;

  factory StockAdjustResult.fromJson(Map<String, dynamic> j) => StockAdjustResult(
        deltaGrams: numOf(j['deltaGrams']),
        previousStock: numOf(j['previousStock']),
        newStock: numOf(j['newStock']),
        lowStock: boolOf(j['lowStock']),
      );
}
