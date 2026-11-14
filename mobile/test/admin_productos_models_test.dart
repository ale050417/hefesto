import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/productos/producto_detail_screen.dart' show formatMinutes;
import 'package:hefesto/features/admin/productos/producto_form_logic.dart';
import 'package:hefesto/features/admin/productos/productos_models.dart';

// JSON con la forma REAL de GET /api/v1/admin/productos (ver admin-api.ts).
Map<String, dynamic> row({
  String id = 'p1',
  String name = 'Mate Mario',
  String status = 'published',
  dynamic price = 30000,
  dynamic salePrice,
  bool isOnSale = false,
  int? discountPercent,
  bool isFeatured = false,
  bool isNew = false,
  int imageCount = 2,
  int variantCount = 0,
}) =>
    {
      'id': id,
      'name': name,
      'slug': 'mate-mario',
      'status': status,
      'price': price,
      'salePrice': salePrice,
      'isOnSale': isOnSale,
      'discountPercent': discountPercent,
      'isFeatured': isFeatured,
      'isNew': isNew,
      'material': 'PLA',
      'categoryId': 'c1',
      'categoryName': 'Mates',
      'imageUrl': 'https://cdn/x.webp',
      'imagePosition': '50% 30%',
      'imageCount': imageCount,
      'variantCount': variantCount,
      'updatedAt': '2026-10-31T12:00:00.000Z',
      'createdAt': '2026-10-01T12:00:00.000Z',
    };

Map<String, dynamic> detailJson() => {
      'id': 'p1',
      'name': 'Mate Mario',
      'slug': 'mate-mario',
      'description': 'Un mate para los fanáticos.',
      'status': 'published',
      'isFeatured': true,
      'isNew': false,
      'createdAt': '2026-10-01T12:00:00.000Z',
      'updatedAt': '2026-10-31T12:00:00.000Z',
      'categoryId': 'c-kid',
      'categoryName': 'Funko Pop',
      'categoryPath': 'Figuras › Funko Pop',
      'price': '30000.00', // numeric de Postgres puede venir como String
      'salePrice': 24000,
      'isOnSale': true,
      'discountPercent': 20,
      'priceMin': 20000,
      'priceMax': 38000,
      'priceFrom': true,
      'material': 'PLA',
      'printTimeMinutes': 300,
      'weightGrams': 120,
      'dimensions': '12 cm',
      'layerHeight': '0.2 mm',
      'infillPercent': 15,
      'productionTime': '3 días',
      'colorMode': 'single',
      'colors': ['Rojo', 'Negro'],
      'colorPrices': {'Rojo': 31000, 'Negro': '30000'},
      'variants': [
        {
          'label': 'Chico',
          'price': 20000,
          'colorGrams': {},
          'weightGrams': 80,
          'colorPrices': {},
          'extrasCost': 300,
        },
        {
          'label': 'Grande',
          'price': null,
          'colorGrams': {'Rojo': 40},
          'weightGrams': null,
          'colorPrices': {'Rojo': 38000},
        },
      ],
      'images': [
        {
          'id': 'i1',
          'url': 'https://cdn/a.webp',
          'alt': null,
          'isPrimary': false,
          'sortOrder': 0,
          'color': null,
          'position': '50% 50%',
          'scale': 1,
        },
        {
          'id': 'i2',
          'url': 'https://cdn/b.webp',
          'alt': null,
          'isPrimary': true,
          'sortOrder': 1,
          'color': 'Rojo',
          'position': '50% 50%',
          'scale': 1.5,
        },
      ],
      'costs': {'amortization': 8000, 'profit': 22000, 'extrasCost': 500},
    };

void main() {
  group('AdminProductsPage', () {
    test('parsea items, total y contadores', () {
      final page = AdminProductsPage.fromJson({
        'items': [
          row(),
          row(
            id: 'p2',
            name: 'Cartel',
            status: 'draft',
            price: '12000.00',
            salePrice: 9000,
            isOnSale: true,
            discountPercent: 25,
            isFeatured: true,
            isNew: true,
            imageCount: 0,
            variantCount: 3,
          ),
        ],
        'total': 57,
        'page': 1,
        'pageSize': 40,
        'totalPages': 2,
        'counts': {
          'total': 57,
          'published': 40,
          'draft': 12,
          'archived': 5,
          'featured': 6,
          'onSale': 3,
        },
      });
      expect(page.items, hasLength(2));
      expect(page.total, 57);
      expect(page.counts.published, 40);
      expect(page.counts.archived, 5);

      final a = page.items[0];
      expect(a.status, ProductState.published);
      expect(a.price, 30000);
      expect(a.isOnSale, isFalse);
      expect(a.effectivePrice, 30000);
      expect(a.hasPhotos, isTrue);
      expect(a.imagePosition, '50% 30%');

      final b = page.items[1];
      expect(b.status, ProductState.draft);
      expect(b.price, 12000, reason: 'el numeric llega como String');
      expect(b.isOnSale, isTrue);
      expect(b.effectivePrice, 9000);
      expect(b.discountPercent, 25);
      expect(b.hasPhotos, isFalse);
      expect(b.variantCount, 3);
    });

    test('datos faltantes o raros no rompen', () {
      final page = AdminProductsPage.fromJson({
        'items': [
          {'id': 'x', 'price': 'abc', 'status': 'algo_nuevo', 'imageUrl': ''},
          'basura', // se ignora
        ],
      });
      expect(page.items, hasLength(1));
      final r = page.items.first;
      expect(r.name, 'Sin nombre');
      expect(r.price, 0);
      expect(r.status, ProductState.draft, reason: 'estado desconocido = borrador');
      expect(r.imageUrl, isNull);
      expect(r.imageCount, 0);
      expect(page.total, 0);
      expect(page.counts.total, 0);
    });
  });

  group('AdminProductDetail', () {
    final d = AdminProductDetail.fromJson(detailJson());

    test('datos, precios y rango real', () {
      expect(d.price, 30000);
      expect(d.salePrice, 24000);
      expect(d.discountPercent, 20);
      expect(d.priceMin, 20000);
      expect(d.priceMax, 38000);
      expect(d.priceFrom, isTrue);
      expect(d.categoryPath, 'Figuras › Funko Pop');
      expect(d.printTimeMinutes, 300);
      expect(d.weightGrams, 120);
      expect(d.isFeatured, isTrue);
      expect(d.isMulti, isFalse);
    });

    test('colores y precios por color (numéricos aunque lleguen como String)', () {
      expect(d.colors, ['Rojo', 'Negro']);
      expect(d.colorPrices, {'Rojo': 31000, 'Negro': 30000});
    });

    test('tamaños con matriz tamaño × color', () {
      expect(d.variants, hasLength(2));
      expect(d.variants[0].label, 'Chico');
      expect(d.variants[0].price, 20000);
      expect(d.variants[0].weightGrams, 80);
      expect(d.variants[0].extrasCost, 300);
      expect(d.variants[1].price, isNull, reason: 'sin precio propio = precio base');
      expect(d.variants[1].colorPrices, {'Rojo': 38000});
      expect(d.variants[1].colorGrams, {'Rojo': 40});
      expect(d.variants[1].extrasCost, isNull, reason: 'sin permiso de ganancias no viene');
    });

    test('imágenes: la portada es la marcada; sin marcar, la primera', () {
      expect(d.images, hasLength(2));
      expect(d.primaryImage!.id, 'i2');
      expect(d.primaryImage!.color, 'Rojo');
      final sinMarca = AdminProductDetail.fromJson({
        ...detailJson(),
        'images': [
          {'id': 'a', 'url': 'u', 'isPrimary': false},
          {'id': 'b', 'url': 'u2', 'isPrimary': false},
        ],
      });
      expect(sinMarca.primaryImage!.id, 'a');
      final sinFotos = AdminProductDetail.fromJson({...detailJson(), 'images': <dynamic>[]});
      expect(sinFotos.primaryImage, isNull);
    });

    test('costos: solo si el servidor los manda', () {
      expect(d.costs!.amortization, 8000);
      expect(d.costs!.profit, 22000);
      expect(d.costs!.extrasCost, 500);
      final sin = AdminProductDetail.fromJson({...detailJson(), 'costs': null});
      expect(sin.costs, isNull);
    });

    test('multicolor: colorPrices son gramos', () {
      final m = AdminProductDetail.fromJson({
        ...detailJson(),
        'colorMode': 'multi',
        'colorPrices': {'Rojo': 40, 'Negro': 20},
      });
      expect(m.isMulti, isTrue);
      expect(m.colorPrices['Rojo'], 40);
    });
  });

  group('ProductOptions', () {
    test('categorías con ruta y materiales', () {
      final o = ProductOptions.fromJson({
        'categories': [
          {'id': 'f', 'name': 'Figuras', 'parentId': null, 'depth': 0, 'path': 'Figuras'},
          {'id': 'fp', 'name': 'Funko Pop', 'parentId': 'f', 'depth': 1, 'path': 'Figuras › Funko Pop'},
        ],
        'materials': ['PETG', 'PLA'],
      });
      expect(o.categories[1].depth, 1);
      expect(o.categories[1].parentId, 'f');
      expect(o.categories[1].path, 'Figuras › Funko Pop');
      expect(o.materials, ['PETG', 'PLA']);
    });
  });

  group('ProductsFilter', () {
    test('igualdad por valor: sirve de clave del provider', () {
      expect(const ProductsFilter(), const ProductsFilter());
      expect(const ProductsFilter().hashCode, const ProductsFilter().hashCode);
      expect(const ProductsFilter(q: 'a') == const ProductsFilter(q: 'b'), isFalse);
    });

    test('copyWith cambia solo lo pedido y puede sacar la categoría', () {
      final f = const ProductsFilter().copyWith(status: 'draft', category: (id: 'c1'));
      expect(f.status, 'draft');
      expect(f.categoryId, 'c1');
      expect(f.copyWith(featured: true).categoryId, 'c1', reason: 'no tocar = se conserva');
      expect(f.copyWith(category: (id: null)).categoryId, isNull);
      expect(f.isFiltering, isTrue);
      expect(const ProductsFilter(sort: 'name', limit: 80).isFiltering, isFalse,
          reason: 'el orden y la cantidad no son filtros');
    });
  });

  group('parseMoney', () {
    test('entiende como escribe la gente', () {
      expect(parseMoney('1500'), 1500);
      expect(parseMoney('1.500'), 1500, reason: 'punto de miles');
      expect(parseMoney('12.500.000'), 12500000);
      expect(parseMoney('1.500,50'), 1500.5);
      expect(parseMoney('1500,5'), 1500.5);
      expect(parseMoney('12.5'), 12.5);
      expect(parseMoney(r'$ 2.000'), 2000);
      expect(parseMoney(' 99 '), 99);
    });

    test('lo que no es número → null', () {
      expect(parseMoney(''), isNull);
      expect(parseMoney('abc'), isNull);
      expect(parseMoney('1,2,3'), isNull);
    });
  });

  group('formatMinutes / numberToField', () {
    test('minutos legibles', () {
      expect(formatMinutes(45), '45 min');
      expect(formatMinutes(60), '1 h');
      expect(formatMinutes(300), '5 h');
      expect(formatMinutes(90), '1 h 30 min');
    });

    test('número a campo de texto', () {
      expect(numberToField(null), '');
      expect(numberToField(30000), '30000');
      expect(numberToField(1500.5), '1500.5');
      expect(numberToField(99.99), '99.99');
    });
  });

  group('ProductFormValues', () {
    ProductFormValues ok({String? categoryId = 'c1'}) => ProductFormValues.fromRaw(
          name: '  Mate Mario ',
          categoryId: categoryId,
          material: 'PLA',
          priceText: '30.000',
          weightText: '120',
          minutesText: '300',
        );

    test('un formulario completo valida y normaliza', () {
      final v = ok();
      expect(v.validate(), isEmpty);
      expect(v.name, 'Mate Mario');
      expect(v.price, 30000);
      expect(v.weightGrams, 120);
    });

    test('errores por campo', () {
      expect(ProductFormValues.fromRaw().validate().keys, containsAll(['name', 'category', 'price']));
      expect(ok(categoryId: null).validate().keys, ['category']);
      expect(ProductFormValues.fromRaw(name: 'x', categoryId: 'c', priceText: '0').validate()['price'],
          isNotNull);
      expect(ProductFormValues.fromRaw(name: 'x', categoryId: 'c', priceText: 'abc').validate()['price'],
          isNotNull);
      expect(
        ProductFormValues.fromRaw(name: 'x', categoryId: 'c', priceText: '1000', weightText: '1,5')
            .validate()['weight'],
        isNotNull,
        reason: 'los gramos son enteros',
      );
    });

    test('montos: 9 cifras valen; más de lo que entra en la base, no', () {
      String? err(String price) =>
          ProductFormValues.fromRaw(name: 'x', categoryId: 'c', priceText: price).validate()['price'];
      expect(err('123.456.789'), isNull);
      expect(err('9.999.999.999,99'), isNull, reason: 'el tope de numeric(12,2)');
      expect(err('10.000.000.000'), 'El precio es demasiado alto.');
      expect(err('99999999999999'), 'El precio es demasiado alto.');
    });

    test('la oferta tiene que ser menor al precio', () {
      String? err(String sale) => ProductFormValues.fromRaw(
            name: 'x',
            categoryId: 'c',
            priceText: '1000',
            saleText: sale,
          ).validate()['salePrice'];
      expect(err(''), isNull, reason: 'sin oferta está bien');
      expect(err('800'), isNull);
      expect(err('1000'), isNotNull);
      expect(err('1500'), isNotNull);
      expect(err('xx'), isNotNull);
    });

    test('body del alta: solo lo que tiene valor', () {
      final body = ok().toCreateBody();
      expect(body, {
        'name': 'Mate Mario',
        'categoryId': 'c1',
        'price': 30000.0,
        'material': 'PLA',
        'weightGrams': 120,
        'printTimeMinutes': 300,
        'isFeatured': false,
      });
    });

    test('edición: sin cambios no hay diferencia (y el botón queda apagado)', () {
      final initial = ProductFormValues.fromDetail(AdminProductDetail.fromJson(detailJson()));
      final same = ProductFormValues.fromDetail(AdminProductDetail.fromJson(detailJson()));
      expect(same, initial);
      expect(same.diffAgainst(initial), isEmpty);
    });

    test('edición: el diff manda SOLO lo que cambió', () {
      final initial = ProductFormValues.fromDetail(AdminProductDetail.fromJson(detailJson()));
      final edited = ProductFormValues.fromRaw(
        name: 'Mate Mario Bros',
        description: 'Un mate para los fanáticos.',
        categoryId: 'c-kid',
        material: 'PLA',
        priceText: '35000',
        saleText: '', // se saca la oferta
        weightText: '120',
        minutesText: '300',
        dimensions: '12 cm',
        productionTime: '3 días',
        featured: false,
      );
      expect(edited == initial, isFalse);
      expect(edited.diffAgainst(initial), {
        'name': 'Mate Mario Bros',
        'price': 35000.0,
        'salePrice': null,
        'isFeatured': false,
      });
    });

    test('edición: vaciar un opcional manda null / vacío', () {
      final initial = ProductFormValues.fromDetail(AdminProductDetail.fromJson(detailJson()));
      final edited = ProductFormValues.fromRaw(
        name: initial.name,
        description: '',
        categoryId: initial.categoryId,
        material: null,
        priceText: '30000',
        saleText: '24000',
        weightText: '',
        minutesText: '300',
        dimensions: '12 cm',
        productionTime: '3 días',
        featured: true,
      );
      expect(edited.diffAgainst(initial), {
        'description': '',
        'material': null,
        'weightGrams': null,
      });
    });
  });
}
