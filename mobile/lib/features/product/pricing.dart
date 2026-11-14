import '../../core/api/models.dart';

/// Port EXACTO de `saleUnitPrice` (src/features/products/pricing.ts):
///
///   matriz `variant.colorPrices[color]` → precio de la variante →
///   (sin variante) precio por color del producto → base.
///
/// Con variante elegida NUNCA se usa el colorPrices del producto (en
/// multicolor esa columna guarda gramos, no precios). El servidor sigue siendo
/// la fuente de verdad del cobro: esto solo muestra el mismo número.
double saleUnitPrice({
  required double basePrice,
  required String colorMode,
  required Map<String, double> productColorPrices,
  ProductVariant? variant,
  String? color,
}) {
  double clamp(double v) => v < 0 ? 0 : v;
  if (variant != null) {
    final cell =
        (colorMode == 'single' && color != null) ? variant.colorPrices[color] : null;
    if (cell != null && cell > 0) return clamp(cell);
    if (variant.price != null && variant.price! > 0) return clamp(variant.price!);
    return clamp(basePrice);
  }
  if (colorMode == 'single' && color != null) {
    final own = productColorPrices[color];
    if (own != null && own > 0) return clamp(own);
  }
  return clamp(basePrice);
}

/// Precio base del producto: el de oferta si baja el precio.
double effectiveBase(ProductDetail p) {
  final sale = p.base.salePrice;
  final onSale = sale != null && sale < p.base.price;
  return onSale ? sale : p.base.price;
}
