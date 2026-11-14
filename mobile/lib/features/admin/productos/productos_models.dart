// Modelos de Productos del panel (`/api/v1/admin/productos`). El servidor decide
// y calcula todo (precios, rangos, costos); la app solo lo muestra. Parseo
// defensivo: el `numeric` de Postgres puede llegar como String, y todo puede
// venir null.

import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

double _d(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
double? _dn(dynamic v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));
int _i(dynamic v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
int? _in(dynamic v) => v == null ? null : (v is num ? v.toInt() : int.tryParse('$v'));
DateTime? _tn(dynamic v) => v == null ? null : DateTime.tryParse('$v')?.toLocal();
String? _s(dynamic v) {
  final s = v?.toString().trim();
  return (s == null || s.isEmpty) ? null : s;
}

Map<String, double> _numMap(dynamic v) => v is Map
    ? {for (final e in v.entries) '${e.key}': _d(e.value)}
    : const <String, double>{};

List<Map<String, dynamic>> _list(dynamic v) => v is List
    ? [for (final e in v) if (e is Map) Map<String, dynamic>.from(e)]
    : const [];

/// Estado de publicación de un producto. En el panel: "Activo" = publicado en
/// la tienda; "Borrador" = todavía no salió; "Archivado" = escondido (se puede
/// volver a publicar).
enum ProductState {
  published('published', 'Activo', Icons.check_circle_rounded, Brand.success),
  draft('draft', 'Borrador', Icons.edit_note_rounded, Brand.warning),
  archived('archived', 'Archivado', Icons.inventory_2_outlined, null);

  const ProductState(this.api, this.label, this.icon, this.brandColor);
  final String api;
  final String label;
  final IconData icon;

  /// `null` = neutro (se resuelve con el color de texto del tema).
  final Color? brandColor;

  Color color(BuildContext context) => brandColor ?? context.hc.textDim;

  static ProductState fromApi(String? v) =>
      ProductState.values.firstWhere((s) => s.api == v, orElse: () => ProductState.draft);
}

/// Una fila del listado.
class AdminProductRow {
  AdminProductRow({
    required this.id,
    required this.name,
    required this.slug,
    required this.status,
    required this.price,
    required this.salePrice,
    required this.isOnSale,
    required this.discountPercent,
    required this.isFeatured,
    required this.isNew,
    required this.material,
    required this.categoryId,
    required this.categoryName,
    required this.imageUrl,
    required this.imagePosition,
    required this.imageCount,
    required this.variantCount,
  });

  final String id;
  final String name;
  final String slug;
  final ProductState status;
  final double price;
  final double? salePrice;
  final bool isOnSale;
  final int? discountPercent;
  final bool isFeatured;
  final bool isNew;
  final String? material;
  final String? categoryId;
  final String? categoryName;
  final String? imageUrl;
  final String? imagePosition;
  final int imageCount;
  final int variantCount;

  bool get hasPhotos => imageCount > 0;

  /// Lo que paga el cliente por el producto base (oferta si la hay).
  double get effectivePrice => isOnSale ? (salePrice ?? price) : price;

  factory AdminProductRow.fromJson(Map<String, dynamic> j) => AdminProductRow(
        id: '${j['id']}',
        name: (j['name'] as String?) ?? 'Sin nombre',
        slug: (j['slug'] as String?) ?? '',
        status: ProductState.fromApi(j['status'] as String?),
        price: _d(j['price']),
        salePrice: _dn(j['salePrice']),
        isOnSale: j['isOnSale'] == true,
        discountPercent: _in(j['discountPercent']),
        isFeatured: j['isFeatured'] == true,
        isNew: j['isNew'] == true,
        material: _s(j['material']),
        categoryId: _s(j['categoryId']),
        categoryName: _s(j['categoryName']),
        imageUrl: _s(j['imageUrl']),
        imagePosition: _s(j['imagePosition']),
        imageCount: _i(j['imageCount']),
        variantCount: _i(j['variantCount']),
      );
}

/// Contadores del catálogo completo (no dependen de los filtros).
class ProductCounts {
  const ProductCounts({
    this.total = 0,
    this.published = 0,
    this.draft = 0,
    this.archived = 0,
    this.featured = 0,
    this.onSale = 0,
  });
  final int total;
  final int published;
  final int draft;
  final int archived;
  final int featured;
  final int onSale;

  factory ProductCounts.fromJson(Map<String, dynamic>? j) => j == null
      ? const ProductCounts()
      : ProductCounts(
          total: _i(j['total']),
          published: _i(j['published']),
          draft: _i(j['draft']),
          archived: _i(j['archived']),
          featured: _i(j['featured']),
          onSale: _i(j['onSale']),
        );
}

class AdminProductsPage {
  AdminProductsPage({required this.items, required this.total, required this.counts});
  final List<AdminProductRow> items;

  /// Cuántos hay con los filtros actuales (puede ser más que `items`).
  final int total;
  final ProductCounts counts;

  factory AdminProductsPage.fromJson(Map<String, dynamic> j) => AdminProductsPage(
        items: _list(j['items']).map(AdminProductRow.fromJson).toList(),
        total: _i(j['total']),
        counts: ProductCounts.fromJson(
          j['counts'] is Map ? Map<String, dynamic>.from(j['counts'] as Map) : null,
        ),
      );
}

/// Un tamaño o combinación del producto (solo lectura en la app).
class AdminProductVariant {
  AdminProductVariant({
    required this.label,
    required this.price,
    required this.weightGrams,
    required this.colorGrams,
    required this.colorPrices,
    required this.extrasCost,
  });
  final String label;
  final double? price;
  final double? weightGrams;

  /// Multicolor: gramos por color de este tamaño.
  final Map<String, double> colorGrams;

  /// Matriz tamaño × color: precio exacto por color dentro de este tamaño.
  final Map<String, double> colorPrices;
  final double? extrasCost;

  factory AdminProductVariant.fromJson(Map<String, dynamic> j) => AdminProductVariant(
        label: (j['label'] as String?) ?? '',
        price: _dn(j['price']),
        weightGrams: _dn(j['weightGrams']),
        colorGrams: _numMap(j['colorGrams']),
        colorPrices: _numMap(j['colorPrices']),
        extrasCost: _dn(j['extrasCost']),
      );
}

class AdminProductImage {
  AdminProductImage({
    required this.id,
    required this.url,
    required this.isPrimary,
    required this.color,
    required this.position,
  });
  final String id;
  final String url;
  final bool isPrimary;

  /// Color al que corresponde la foto (la tienda salta a ella al elegirlo).
  final String? color;
  final String? position;

  factory AdminProductImage.fromJson(Map<String, dynamic> j) => AdminProductImage(
        id: '${j['id']}',
        url: (j['url'] as String?) ?? '',
        isPrimary: j['isPrimary'] == true,
        color: _s(j['color']),
        position: _s(j['position']),
      );
}

/// Costos del producto. Solo llegan si el usuario tiene permiso de Ganancias.
class ProductCosts {
  ProductCosts({this.amortization, this.profit, this.extrasCost = 0});
  final double? amortization;
  final double? profit;
  final double extrasCost;

  factory ProductCosts.fromJson(Map<String, dynamic> j) => ProductCosts(
        amortization: _dn(j['amortization']),
        profit: _dn(j['profit']),
        extrasCost: _d(j['extrasCost']),
      );
}

/// Ficha completa de un producto.
class AdminProductDetail {
  AdminProductDetail({
    required this.id,
    required this.name,
    required this.slug,
    required this.description,
    required this.status,
    required this.isFeatured,
    required this.isNew,
    required this.categoryId,
    required this.categoryName,
    required this.categoryPath,
    required this.price,
    required this.salePrice,
    required this.isOnSale,
    required this.discountPercent,
    required this.priceMin,
    required this.priceMax,
    required this.priceFrom,
    required this.material,
    required this.printTimeMinutes,
    required this.weightGrams,
    required this.dimensions,
    required this.layerHeight,
    required this.infillPercent,
    required this.productionTime,
    required this.colorMode,
    required this.colors,
    required this.colorPrices,
    required this.variants,
    required this.images,
    required this.costs,
    required this.updatedAt,
  });

  final String id;
  final String name;
  final String slug;
  final String? description;
  final ProductState status;
  final bool isFeatured;
  final bool isNew;
  final String? categoryId;
  final String? categoryName;
  final String? categoryPath;
  final double price;
  final double? salePrice;
  final bool isOnSale;
  final int? discountPercent;

  /// Rango REAL que paga un cliente (tamaños × colores).
  final double priceMin;
  final double priceMax;
  final bool priceFrom;
  final String? material;
  final int? printTimeMinutes;
  final int? weightGrams;
  final String? dimensions;
  final String? layerHeight;
  final int? infillPercent;
  final String? productionTime;

  /// `single` (el cliente elige UN color) o `multi` (la combinación es fija).
  final String colorMode;
  final List<String> colors;

  /// Color único = precio exacto por color; multicolor = gramos por color.
  final Map<String, double> colorPrices;
  final List<AdminProductVariant> variants;
  final List<AdminProductImage> images;
  final ProductCosts? costs;
  final DateTime? updatedAt;

  bool get isMulti => colorMode == 'multi';
  AdminProductImage? get primaryImage {
    for (final i in images) {
      if (i.isPrimary) return i;
    }
    return images.isEmpty ? null : images.first;
  }

  factory AdminProductDetail.fromJson(Map<String, dynamic> j) {
    final price = _d(j['price']);
    return AdminProductDetail(
      id: '${j['id']}',
      name: (j['name'] as String?) ?? 'Sin nombre',
      slug: (j['slug'] as String?) ?? '',
      description: _s(j['description']),
      status: ProductState.fromApi(j['status'] as String?),
      isFeatured: j['isFeatured'] == true,
      isNew: j['isNew'] == true,
      categoryId: _s(j['categoryId']),
      categoryName: _s(j['categoryName']),
      categoryPath: _s(j['categoryPath']),
      price: price,
      salePrice: _dn(j['salePrice']),
      isOnSale: j['isOnSale'] == true,
      discountPercent: _in(j['discountPercent']),
      priceMin: j['priceMin'] == null ? price : _d(j['priceMin']),
      priceMax: j['priceMax'] == null ? price : _d(j['priceMax']),
      priceFrom: j['priceFrom'] == true,
      material: _s(j['material']),
      printTimeMinutes: _in(j['printTimeMinutes']),
      weightGrams: _in(j['weightGrams']),
      dimensions: _s(j['dimensions']),
      layerHeight: _s(j['layerHeight']),
      infillPercent: _in(j['infillPercent']),
      productionTime: _s(j['productionTime']),
      colorMode: (j['colorMode'] as String?) ?? 'single',
      colors: ((j['colors'] as List?) ?? const []).map((e) => '$e').toList(),
      colorPrices: _numMap(j['colorPrices']),
      variants: _list(j['variants']).map(AdminProductVariant.fromJson).toList(),
      images: _list(j['images']).map(AdminProductImage.fromJson).toList(),
      costs: j['costs'] is Map
          ? ProductCosts.fromJson(Map<String, dynamic>.from(j['costs'] as Map))
          : null,
      updatedAt: _tn(j['updatedAt']),
    );
  }
}

/// Una categoría elegible (con su ruta "Figuras › Funko Pop") para los selectores.
class CategoryOption {
  CategoryOption({
    required this.id,
    required this.name,
    required this.parentId,
    required this.depth,
    required this.path,
  });
  final String id;
  final String name;
  final String? parentId;
  final int depth;
  final String path;

  factory CategoryOption.fromJson(Map<String, dynamic> j) => CategoryOption(
        id: '${j['id']}',
        name: (j['name'] as String?) ?? '',
        parentId: _s(j['parentId']),
        depth: _i(j['depth']),
        path: (j['path'] as String?) ?? (j['name'] as String?) ?? '',
      );
}

/// Lo que necesita el formulario: categorías y materiales con filamento cargado.
class ProductOptions {
  ProductOptions({required this.categories, required this.materials});
  final List<CategoryOption> categories;
  final List<String> materials;

  factory ProductOptions.fromJson(Map<String, dynamic> j) => ProductOptions(
        categories: _list(j['categories']).map(CategoryOption.fromJson).toList(),
        materials: ((j['materials'] as List?) ?? const []).map((e) => '$e').toList(),
      );
}

/// Filtros del listado. Igualdad por valor: sirve de clave del provider (cada
/// combinación de filtros es un pedido distinto al servidor).
class ProductsFilter {
  const ProductsFilter({
    this.q = '',
    this.status = 'all', // all | published | draft | archived
    this.categoryId,
    this.featured = false,
    this.onSale = false,
    this.noImages = false,
    this.sort = 'updated', // updated | newest | name | price_asc | price_desc
    this.limit = 40,
  });

  final String q;
  final String status;
  final String? categoryId;
  final bool featured;
  final bool onSale;
  final bool noImages;
  final String sort;
  final int limit;

  /// Cambia solo lo indicado. `categoryId` se pasa envuelto (`(id: null)`) para
  /// poder distinguir "no tocar" de "sacar el filtro".
  ProductsFilter copyWith({
    String? q,
    String? status,
    ({String? id})? category,
    bool? featured,
    bool? onSale,
    bool? noImages,
    String? sort,
    int? limit,
  }) =>
      ProductsFilter(
        q: q ?? this.q,
        status: status ?? this.status,
        categoryId: category != null ? category.id : categoryId,
        featured: featured ?? this.featured,
        onSale: onSale ?? this.onSale,
        noImages: noImages ?? this.noImages,
        sort: sort ?? this.sort,
        limit: limit ?? this.limit,
      );

  /// ¿Hay algo filtrando (además del orden y la cantidad)?
  bool get isFiltering =>
      q.isNotEmpty || status != 'all' || categoryId != null || featured || onSale || noImages;

  @override
  bool operator ==(Object other) =>
      other is ProductsFilter &&
      other.q == q &&
      other.status == status &&
      other.categoryId == categoryId &&
      other.featured == featured &&
      other.onSale == onSale &&
      other.noImages == noImages &&
      other.sort == sort &&
      other.limit == limit;

  @override
  int get hashCode => Object.hash(q, status, categoryId, featured, onSale, noImages, sort, limit);
}

/// Tope que acepta el servidor por pedido.
const int kProductsMaxLimit = 200;

/// Lo escrito por una persona ("1.500", "1500,50", "$ 2.000") → número. `null`
/// si no se entiende. Los puntos son separador de miles salvo que haya coma.
double? parseMoney(String raw) {
  var s = raw.replaceAll(RegExp(r'[\s$]'), '');
  if (s.isEmpty) return null;
  if (s.contains(',')) {
    s = s.replaceAll('.', '').replaceAll(',', '.');
  } else if (RegExp(r'^\d{1,3}(\.\d{3})+$').hasMatch(s)) {
    s = s.replaceAll('.', '');
  }
  return double.tryParse(s);
}
