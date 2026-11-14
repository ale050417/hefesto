// Lógica PURA del formulario de producto (sin widgets): valores, validación y
// armado del body que se manda al servidor. Se prueba sin dibujar nada.

import 'productos_models.dart';

/// Número para mostrar en un campo de texto: sin decimales si es entero.
String numberToField(num? v) {
  if (v == null) return '';
  if (v == v.roundToDouble()) return '${v.round()}';
  var s = v.toStringAsFixed(2);
  if (s.endsWith('0')) s = s.substring(0, s.length - 1);
  return s;
}

/// Precio más alto que entra en la base (`numeric(12,2)`). Con uno mayor el
/// servidor no contesta "precio inválido" sino el error genérico de "probá de
/// nuevo en unos segundos", así que se frena acá con un mensaje claro.
const double kMaxProductPrice = 9999999999.99;

/// Lo que hay cargado en el formulario (ya interpretado). Igualdad por valor:
/// "hay cambios" = `current != initial`.
class ProductFormValues {
  const ProductFormValues({
    this.name = '',
    this.description = '',
    this.categoryId,
    this.price,
    this.salePrice,
    this.material,
    this.weightGrams,
    this.printMinutes,
    this.dimensions = '',
    this.productionTime = '',
    this.featured = false,
    this.badPrice = false,
    this.badSalePrice = false,
    this.badWeight = false,
    this.badMinutes = false,
  });

  final String name;
  final String description;
  final String? categoryId;
  final double? price;
  final double? salePrice;
  final String? material;
  final int? weightGrams;
  final int? printMinutes;
  final String dimensions;
  final String productionTime;
  final bool featured;

  /// El texto del campo está escrito pero no es un número válido.
  final bool badPrice;
  final bool badSalePrice;
  final bool badWeight;
  final bool badMinutes;

  /// Desde lo que escribió la persona en los campos.
  factory ProductFormValues.fromRaw({
    String name = '',
    String description = '',
    String? categoryId,
    String? material,
    String priceText = '',
    String saleText = '',
    String weightText = '',
    String minutesText = '',
    String dimensions = '',
    String productionTime = '',
    bool featured = false,
  }) {
    double? money(String t) => parseMoney(t);
    int? whole(String t) {
      final n = int.tryParse(t.trim());
      return n != null && n >= 0 ? n : null;
    }

    final price = money(priceText);
    final sale = money(saleText);
    final weight = whole(weightText);
    final minutes = whole(minutesText);
    return ProductFormValues(
      name: name.trim(),
      description: description.trim(),
      categoryId: categoryId,
      price: price,
      salePrice: sale,
      material: (material == null || material.trim().isEmpty) ? null : material.trim(),
      weightGrams: weight,
      printMinutes: minutes,
      dimensions: dimensions.trim(),
      productionTime: productionTime.trim(),
      featured: featured,
      badPrice: priceText.trim().isNotEmpty && price == null,
      badSalePrice: saleText.trim().isNotEmpty && sale == null,
      badWeight: weightText.trim().isNotEmpty && weight == null,
      badMinutes: minutesText.trim().isNotEmpty && minutes == null,
    );
  }

  /// Desde un producto ya guardado (los valores iniciales de la edición).
  factory ProductFormValues.fromDetail(AdminProductDetail p) => ProductFormValues.fromRaw(
        name: p.name,
        description: p.description ?? '',
        categoryId: p.categoryId,
        material: p.material,
        priceText: numberToField(p.price),
        saleText: numberToField(p.salePrice),
        weightText: p.weightGrams?.toString() ?? '',
        minutesText: p.printTimeMinutes?.toString() ?? '',
        dimensions: p.dimensions ?? '',
        productionTime: p.productionTime ?? '',
        featured: p.isFeatured,
      );

  /// Errores por campo (vacío = se puede guardar). Las mismas reglas que el
  /// servidor; él igual vuelve a validar todo.
  Map<String, String> validate() {
    final e = <String, String>{};
    if (name.isEmpty) e['name'] = 'Poné un nombre.';
    if (name.length > 120) e['name'] = 'El nombre es muy largo (máximo 120 letras).';
    if (categoryId == null) e['category'] = 'Elegí una categoría.';
    if (badPrice || price == null || price! <= 0) {
      e['price'] = 'Poné un precio mayor a 0.';
    } else if (price! > kMaxProductPrice) {
      e['price'] = 'El precio es demasiado alto.';
    }
    if (badSalePrice || (salePrice != null && salePrice! <= 0)) {
      e['salePrice'] = 'El precio de oferta no es válido.';
    } else if (salePrice != null && price != null && salePrice! >= price!) {
      e['salePrice'] = 'La oferta tiene que ser menor al precio.';
    }
    if (badWeight) e['weight'] = 'Poné los gramos como número entero.';
    if (badMinutes) e['minutes'] = 'Poné los minutos como número entero.';
    if (description.length > 2000) e['description'] = 'La descripción es muy larga (máximo 2000).';
    if (dimensions.length > 120) e['dimensions'] = 'Máximo 120 letras.';
    if (productionTime.length > 120) e['productionTime'] = 'Máximo 120 letras.';
    return e;
  }

  /// Body del alta: solo lo que tiene valor.
  Map<String, dynamic> toCreateBody() => {
        'name': name,
        'categoryId': ?categoryId,
        'price': ?price,
        'salePrice': ?salePrice,
        if (description.isNotEmpty) 'description': description,
        'material': ?material,
        'weightGrams': ?weightGrams,
        'printTimeMinutes': ?printMinutes,
        if (dimensions.isNotEmpty) 'dimensions': dimensions,
        if (productionTime.isNotEmpty) 'productionTime': productionTime,
        'isFeatured': featured,
      };

  /// Body de la edición: SOLO los campos que cambiaron respecto de [initial]
  /// (así no se recalculan costos ni se pisa nada que la persona no tocó).
  /// Borrar un valor opcional manda `null` / `''`, que el servidor interpreta
  /// como "dejar vacío".
  Map<String, dynamic> diffAgainst(ProductFormValues initial) {
    final b = <String, dynamic>{};
    if (name != initial.name) b['name'] = name;
    if (description != initial.description) b['description'] = description;
    if (categoryId != initial.categoryId) b['categoryId'] = categoryId;
    if (price != initial.price) b['price'] = price;
    if (salePrice != initial.salePrice) b['salePrice'] = salePrice;
    if (material != initial.material) b['material'] = material;
    if (weightGrams != initial.weightGrams) b['weightGrams'] = weightGrams;
    if (printMinutes != initial.printMinutes) b['printTimeMinutes'] = printMinutes;
    if (dimensions != initial.dimensions) b['dimensions'] = dimensions;
    if (productionTime != initial.productionTime) b['productionTime'] = productionTime;
    if (featured != initial.featured) b['isFeatured'] = featured;
    return b;
  }

  @override
  bool operator ==(Object other) =>
      other is ProductFormValues &&
      other.name == name &&
      other.description == description &&
      other.categoryId == categoryId &&
      other.price == price &&
      other.salePrice == salePrice &&
      other.material == material &&
      other.weightGrams == weightGrams &&
      other.printMinutes == printMinutes &&
      other.dimensions == dimensions &&
      other.productionTime == productionTime &&
      other.featured == featured &&
      other.badPrice == badPrice &&
      other.badSalePrice == badSalePrice &&
      other.badWeight == badWeight &&
      other.badMinutes == badMinutes;

  @override
  int get hashCode => Object.hash(name, description, categoryId, price, salePrice, material,
      weightGrams, printMinutes, dimensions, productionTime, featured);
}
