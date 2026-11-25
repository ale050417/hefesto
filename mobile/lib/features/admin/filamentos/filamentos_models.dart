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
    this.typeId,
    this.spoolModelId,
  });

  final String id;
  final String material;
  final String color;
  final String brand;
  final String diameter;

  /// Tipo de filamento (PLA, PETG…) del que sale el precio por kg; null = sin
  /// tipo, precio propio.
  final String? typeId;

  /// Modelo de carrete con el que se pesó la última vez ("Calcular filamento").
  final String? spoolModelId;

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
        typeId: strOrNull(j['typeId']),
        spoolModelId: strOrNull(j['spoolModelId']),
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
    this.typeId,
  });

  final String material;
  final String color;
  final String brand;
  final String diameter;
  final double stockGrams;
  final double spoolGrams;

  /// Con [typeId] el servidor lo ignora y usa el precio del tipo.
  final double costPerKg;
  final double alertThresholdGrams;

  /// Tipo de filamento; null = sin tipo (precio propio). Viaja siempre.
  final String? typeId;

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
        'typeId': typeId,
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

/// Tipo de filamento con su precio por kg (pedido de Agustín, 2026-11-24:
/// "cambiar el precio en un solo lugar y no en los 32 carretes").
class FilamentType {
  const FilamentType({required this.id, required this.name, required this.costPerKg, this.spools = 0});

  final String id;
  final String name;
  final double costPerKg;

  /// Cuántos carretes usan este tipo.
  final int spools;

  factory FilamentType.fromJson(Map<String, dynamic> j) => FilamentType(
        id: strOf(j['id']),
        name: strOf(j['name'], 'Sin nombre'),
        costPerKg: numOf(j['costPerKg']),
        spools: intOf(j['spools']),
      );
}

/// Modelo de carrete con su peso VACÍO (para "Calcular filamento").
class SpoolModel {
  const SpoolModel({required this.id, required this.name, required this.emptyGrams});

  final String id;
  final String name;
  final double emptyGrams;

  factory SpoolModel.fromJson(Map<String, dynamic> j) => SpoolModel(
        id: strOf(j['id']),
        name: strOf(j['name'], 'Sin nombre'),
        emptyGrams: numOf(j['emptyGrams']),
      );
}

/// Lo que devuelve `GET /admin/filaments/types`: los tipos y los modelos de
/// carrete en un solo pedido.
class FilamentTypesData {
  const FilamentTypesData({this.types = const [], this.spoolModels = const []});

  final List<FilamentType> types;
  final List<SpoolModel> spoolModels;

  factory FilamentTypesData.fromJson(Map<String, dynamic> j) => FilamentTypesData(
        types: [
          for (final t in mapsOf(j['types']))
            if (strOf(t['id']).isNotEmpty) FilamentType.fromJson(t),
        ],
        spoolModels: [
          for (final m in mapsOf(j['spoolModels']))
            if (strOf(m['id']).isNotEmpty) SpoolModel.fromJson(m),
        ],
      );

  FilamentType? typeOf(String? id) {
    if (id == null) return null;
    for (final t in types) {
      if (t.id == id) return t;
    }
    return null;
  }

  SpoolModel? spoolModelOf(String? id) {
    if (id == null) return null;
    for (final m in spoolModels) {
      if (m.id == id) return m;
    }
    return null;
  }
}

/// Respuesta de crear / editar un tipo: [spools] = carretes que cambiaron de
/// precio.
class FilamentTypeSaved {
  const FilamentTypeSaved({required this.id, this.spools = 0});

  final String id;
  final int spools;

  factory FilamentTypeSaved.fromJson(Map<String, dynamic> j) =>
      FilamentTypeSaved(id: strOf(j['id']), spools: intOf(j['spools']));
}

/// Resultado de "Calcular filamento" (pesar el carrete).
class WeighResult {
  const WeighResult({
    required this.remainingGrams,
    required this.newStockGrams,
    required this.previousStock,
    required this.changed,
    required this.lowStock,
  });

  /// Filamento que queda en el carrete pesado.
  final double remainingGrams;

  /// Stock total del color: lo pesado + los carretes cerrados aparte.
  final double newStockGrams;
  final double previousStock;

  /// false si el stock ya era ese (no se registró movimiento).
  final bool changed;
  final bool lowStock;

  factory WeighResult.fromJson(Map<String, dynamic> j) => WeighResult(
        remainingGrams: numOf(j['remainingGrams']),
        newStockGrams: numOf(j['newStockGrams']),
        previousStock: numOf(j['previousStock']),
        changed: boolOf(j['changed'], true),
        lowStock: boolOf(j['lowStock']),
      );
}
