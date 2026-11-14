// Modelos de la API `/api/v1`. El servidor ya calcula precios y flags: la app
// solo los muestra (nunca recalcula un precio).

double _d(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
double? _dn(dynamic v) => v == null ? null : _d(v);

class ProductImage {
  ProductImage({
    required this.url,
    required this.alt,
    required this.position,
    required this.scale,
    this.color,
  });

  final String url;
  final String alt;

  /// Encuadre estilo CSS `background-position` ("50% 30%").
  final String position;
  final double scale;
  final String? color;

  factory ProductImage.fromJson(Map<String, dynamic> j) => ProductImage(
        url: j['url'] as String,
        alt: (j['alt'] as String?) ?? '',
        position: (j['position'] as String?) ?? '50% 50%',
        scale: _d(j['scale'] ?? 1),
        color: j['color'] as String?,
      );
}

class CategoryRef {
  CategoryRef({required this.name, required this.slug});
  final String name;
  final String slug;
  factory CategoryRef.fromJson(Map<String, dynamic> j) =>
      CategoryRef(name: j['name'] as String, slug: j['slug'] as String);
}

class Product {
  Product({
    required this.id,
    required this.name,
    required this.slug,
    required this.price,
    required this.salePrice,
    required this.displayPrice,
    required this.priceFrom,
    required this.saleApplies,
    required this.discountPercent,
    required this.needsChoice,
    required this.lineColor,
    required this.isNew,
    required this.isFeatured,
    required this.material,
    required this.category,
    required this.primaryImage,
  });

  final String id;
  final String name;
  final String slug;
  final double price;
  final double? salePrice;

  /// Precio real más barato que se puede pagar (ya con oferta).
  final double displayPrice;
  final bool priceFrom;
  final bool saleApplies;
  final int? discountPercent;
  final bool needsChoice;
  final String? lineColor;
  final bool isNew;
  final bool isFeatured;
  final String? material;
  final CategoryRef? category;
  final ProductImage? primaryImage;

  factory Product.fromJson(Map<String, dynamic> j) => Product(
        id: j['id'] as String,
        name: j['name'] as String,
        slug: j['slug'] as String,
        price: _d(j['price']),
        salePrice: _dn(j['salePrice']),
        displayPrice: _d(j['displayPrice']),
        priceFrom: j['priceFrom'] == true,
        saleApplies: j['saleApplies'] == true,
        discountPercent: (j['discountPercent'] as num?)?.toInt(),
        needsChoice: j['needsChoice'] == true,
        lineColor: j['lineColor'] as String?,
        isNew: j['isNew'] == true,
        isFeatured: j['isFeatured'] == true,
        material: j['material'] as String?,
        category: j['category'] == null
            ? null
            : CategoryRef.fromJson(j['category'] as Map<String, dynamic>),
        primaryImage: j['primaryImage'] == null
            ? null
            : ProductImage.fromJson(j['primaryImage'] as Map<String, dynamic>),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'slug': slug,
        'price': price,
        'salePrice': salePrice,
        'displayPrice': displayPrice,
        'priceFrom': priceFrom,
        'saleApplies': saleApplies,
        'discountPercent': discountPercent,
        'needsChoice': needsChoice,
        'lineColor': lineColor,
        'isNew': isNew,
        'isFeatured': isFeatured,
        'material': material,
        'category':
            category == null ? null : {'name': category!.name, 'slug': category!.slug},
        'primaryImage': primaryImage == null
            ? null
            : {
                'url': primaryImage!.url,
                'alt': primaryImage!.alt,
                'position': primaryImage!.position,
                'scale': primaryImage!.scale,
              },
      };
}

class ProductVariant {
  ProductVariant({
    required this.id,
    required this.label,
    required this.price,
    required this.colorPrices,
  });
  final String id;
  final String label;
  final double? price;
  final Map<String, double> colorPrices;

  factory ProductVariant.fromJson(Map<String, dynamic> j) => ProductVariant(
        id: j['id'] as String,
        label: j['label'] as String,
        price: _dn(j['price']),
        colorPrices: ((j['colorPrices'] as Map?) ?? {})
            .map((k, v) => MapEntry('$k', _d(v))),
      );
}

class ProductDetail {
  ProductDetail({
    required this.base,
    required this.description,
    required this.printTimeMinutes,
    required this.weightGrams,
    required this.dimensions,
    required this.colorMode,
    required this.colors,
    required this.colorPrices,
    required this.layerHeight,
    required this.infillPercent,
    required this.productionTime,
    required this.images,
    required this.variants,
  });

  final Product base;
  final String? description;
  final int? printTimeMinutes;
  final int? weightGrams;
  final String? dimensions;
  final String colorMode;
  final List<String> colors;
  final Map<String, double> colorPrices;
  final String? layerHeight;
  final int? infillPercent;
  final String? productionTime;
  final List<ProductImage> images;
  final List<ProductVariant> variants;

  factory ProductDetail.fromJson(Map<String, dynamic> j) => ProductDetail(
        base: Product.fromJson(j),
        description: j['description'] as String?,
        printTimeMinutes: (j['printTimeMinutes'] as num?)?.toInt(),
        weightGrams: (j['weightGrams'] as num?)?.toInt(),
        dimensions: j['dimensions'] as String?,
        colorMode: (j['colorMode'] as String?) ?? 'single',
        colors: ((j['colors'] as List?) ?? []).cast<String>(),
        colorPrices: ((j['colorPrices'] as Map?) ?? {})
            .map((k, v) => MapEntry('$k', _d(v))),
        layerHeight: j['layerHeight'] as String?,
        infillPercent: (j['infillPercent'] as num?)?.toInt(),
        productionTime: j['productionTime'] as String?,
        images: ((j['images'] as List?) ?? [])
            .map((e) => ProductImage.fromJson(e as Map<String, dynamic>))
            .toList(),
        variants: ((j['variants'] as List?) ?? [])
            .map((e) => ProductVariant.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class CategoryItem {
  CategoryItem({
    required this.id,
    required this.name,
    required this.slug,
    this.icon,
    this.color,
    this.imageUrl,
    this.parentId,
    this.productCount = 0,
  });
  final String id;
  final String name;
  final String slug;
  final String? icon;
  final String? color;
  final String? imageUrl;
  final String? parentId;
  final int productCount;

  factory CategoryItem.fromJson(Map<String, dynamic> j) => CategoryItem(
        id: j['id'] as String,
        name: j['name'] as String,
        slug: j['slug'] as String,
        icon: j['icon'] as String?,
        color: j['color'] as String?,
        imageUrl: j['imageUrl'] as String?,
        parentId: j['parentId'] as String?,
        productCount: (j['productCount'] as num?)?.toInt() ?? 0,
      );
}

class BannerItem {
  BannerItem({
    required this.id,
    required this.title,
    this.subtitle,
    this.imageUrl,
    this.position = '50% 50%',
    this.align = 'left',
    this.ctaText,
    this.ctaHref,
  });
  final String id;
  final String title;
  final String? subtitle;
  final String? imageUrl;
  final String position;
  final String align;
  final String? ctaText;
  final String? ctaHref;

  factory BannerItem.fromJson(Map<String, dynamic> j) => BannerItem(
        id: j['id'] as String,
        title: j['title'] as String,
        subtitle: j['subtitle'] as String?,
        imageUrl: j['imageUrl'] as String?,
        position: (j['position'] as String?) ?? '50% 50%',
        align: (j['align'] as String?) ?? 'left',
        ctaText: j['ctaText'] as String?,
        ctaHref: j['ctaHref'] as String?,
      );
}

class BrandInfo {
  BrandInfo({
    this.storeName,
    this.slogan,
    this.logoUrl,
    this.whatsapp,
    this.instagram,
    this.contactEmail,
    this.businessMode = 'checkout',
    this.bannerIntervalSec = 5,
  });
  final String? storeName;
  final String? slogan;
  final String? logoUrl;
  final String? whatsapp;
  final String? instagram;
  final String? contactEmail;

  /// "checkout" = tienda con pago online · "vidriera" = catálogo que consulta
  /// por WhatsApp (sin carrito, login de clientes ni pedidos).
  final String businessMode;
  final int bannerIntervalSec;

  bool get isVidriera => businessMode == 'vidriera';

  factory BrandInfo.fromJson(Map<String, dynamic> j) => BrandInfo(
        storeName: j['storeName'] as String?,
        slogan: j['slogan'] as String?,
        logoUrl: j['logoUrl'] as String?,
        whatsapp: j['whatsapp'] as String?,
        instagram: j['instagram'] as String?,
        contactEmail: j['contactEmail'] as String?,
        businessMode: (j['businessMode'] as String?) ?? 'checkout',
        bannerIntervalSec: (j['bannerIntervalSec'] as num?)?.toInt() ?? 5,
      );
}

class HomeData {
  HomeData({
    required this.brand,
    required this.banners,
    required this.categories,
    required this.featured,
    required this.latest,
    required this.onSale,
    required this.pieces,
    required this.customers,
  });
  final BrandInfo brand;
  final List<BannerItem> banners;
  final List<CategoryItem> categories;
  final List<Product> featured;
  final List<Product> latest;
  final List<Product> onSale;
  final int pieces;
  final int customers;

  static List<Product> _products(dynamic l) => ((l as List?) ?? [])
      .map((e) => Product.fromJson(e as Map<String, dynamic>))
      .toList();

  factory HomeData.fromJson(Map<String, dynamic> j) => HomeData(
        brand: j['brand'] == null
            ? BrandInfo()
            : BrandInfo.fromJson(j['brand'] as Map<String, dynamic>),
        banners: ((j['banners'] as List?) ?? [])
            .map((e) => BannerItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        categories: ((j['categories'] as List?) ?? [])
            .map((e) => CategoryItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        featured: _products(j['featured']),
        latest: _products(j['latest']),
        onSale: _products(j['onSale']),
        pieces: ((j['stats'] as Map?)?['pieces'] as num?)?.toInt() ?? 0,
        customers: ((j['stats'] as Map?)?['customers'] as num?)?.toInt() ?? 0,
      );
}

class CatalogPage {
  CatalogPage({
    required this.items,
    required this.total,
    required this.page,
    required this.totalPages,
    this.categories = const [],
    this.materials = const [],
    this.priceMax,
  });
  final List<Product> items;
  final int total;
  final int page;
  final int totalPages;
  final List<CategoryItem> categories;
  final List<String> materials;

  /// Precio del producto más caro del catálogo (solo viene con `facets`): es
  /// el tope del filtro de precio. Null si el servidor no lo informa.
  final double? priceMax;

  factory CatalogPage.fromJson(Map<String, dynamic> j) {
    final facets = j['facets'] as Map<String, dynamic>?;
    return CatalogPage(
      items: ((j['items'] as List?) ?? [])
          .map((e) => Product.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: (j['total'] as num?)?.toInt() ?? 0,
      page: (j['page'] as num?)?.toInt() ?? 1,
      totalPages: (j['totalPages'] as num?)?.toInt() ?? 1,
      categories: ((facets?['categories'] as List?) ?? [])
          .map((e) => CategoryItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      materials: ((facets?['materials'] as List?) ?? []).cast<String>(),
      priceMax: _dn(facets?['priceMax']),
    );
  }
}

class MeInfo {
  MeInfo({
    required this.id,
    this.email,
    this.fullName,
    required this.role,
    required this.isStaff,
    this.permissions = const {},
  });
  final String id;
  final String? email;
  final String? fullName;
  final String role;
  final bool isStaff;

  /// módulo → acciones permitidas (`ver`, `crear`, `editar`, `eliminar`).
  /// Vienen del servidor; sirven para mostrar u ocultar botones, pero cada
  /// endpoint del panel vuelve a verificarlos por su cuenta.
  final Map<String, Set<String>> permissions;

  bool get isAdmin => role == 'admin';

  bool can(String module, String action) =>
      isStaff && (permissions[module]?.contains(action) ?? false);

  factory MeInfo.fromJson(Map<String, dynamic> j) {
    final raw = (j['permissions'] as Map?) ?? const {};
    return MeInfo(
      id: j['id'] as String,
      email: j['email'] as String?,
      fullName: j['fullName'] as String?,
      role: (j['role'] as String?) ?? 'customer',
      isStaff: j['isStaff'] == true,
      permissions: {
        for (final e in raw.entries)
          '${e.key}': {
            if (e.value is Map)
              for (final a in (e.value as Map).entries)
                if (a.value == true) '${a.key}',
          },
      },
    );
  }
}
