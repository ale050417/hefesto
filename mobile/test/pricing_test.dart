import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/models.dart';
import 'package:hefesto/features/product/pricing.dart';

// Espejo de src/features/products/pricing.test.ts: la app tiene que mostrar el
// MISMO precio que cobra el servidor.
void main() {
  ProductVariant variant({double? price, Map<String, double> colors = const {}}) =>
      ProductVariant(id: 'v', label: 'L', price: price, colorPrices: colors);

  group('saleUnitPrice', () {
    test('sin variante ni color: precio base', () {
      expect(
        saleUnitPrice(basePrice: 1000, colorMode: 'single', productColorPrices: {}),
        1000,
      );
    });

    test('color único con precio propio: el exacto del color', () {
      expect(
        saleUnitPrice(
          basePrice: 1000,
          colorMode: 'single',
          productColorPrices: {'Dorado': 1500},
          color: 'Dorado',
        ),
        1500,
      );
    });

    test('color único sin precio propio: cae a la base (nunca 0)', () {
      expect(
        saleUnitPrice(
          basePrice: 1000,
          colorMode: 'single',
          productColorPrices: {'Dorado': 1500},
          color: 'Negro',
        ),
        1000,
      );
    });

    test('multicolor: colorPrices son gramos, se ignoran', () {
      expect(
        saleUnitPrice(
          basePrice: 1000,
          colorMode: 'multi',
          productColorPrices: {'Blanco': 12},
          color: 'Blanco',
        ),
        1000,
      );
    });

    test('variante con matriz tamaño x color gana sobre el precio de variante', () {
      expect(
        saleUnitPrice(
          basePrice: 1000,
          colorMode: 'single',
          productColorPrices: {'Dorado': 1500},
          variant: variant(price: 2000, colors: {'Dorado': 2600}),
          color: 'Dorado',
        ),
        2600,
      );
    });

    test('variante sin celda para el color: precio de la variante', () {
      expect(
        saleUnitPrice(
          basePrice: 1000,
          colorMode: 'single',
          productColorPrices: {'Dorado': 1500},
          variant: variant(price: 2000, colors: {'Dorado': 2600}),
          color: 'Negro',
        ),
        2000,
      );
    });

    test('con variante NUNCA se usa el colorPrices del producto', () {
      expect(
        saleUnitPrice(
          basePrice: 1000,
          colorMode: 'single',
          productColorPrices: {'Dorado': 1500},
          variant: variant(),
          color: 'Dorado',
        ),
        1000,
      );
    });
  });
}
