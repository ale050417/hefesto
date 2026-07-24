/**
 * Precio unitario resolviendo el COLOR en "color único" (el cliente elige uno).
 *
 * El precio cargado por color es el precio EXACTO (absoluto) que paga el cliente
 * al elegir ese color: el mismo producto en Dorado vale distinto que en Amarillo
 * porque el filamento cuesta distinto. Sin precio propio → se cobra la base (el
 * de la calculadora); nunca 0 silencioso.
 *
 * En "multicolor" NO se elige color (la combinación es fija) y la columna
 * `color_prices` guarda GRAMOS por color para descontar stock, NO precios → acá
 * se deja la base tal cual.
 *
 * Función PURA: la usan el servidor (orderService, fuente de verdad del cobro) y
 * la página de producto, así la UI y el cobro nunca divergen.
 */
export function colorUnitPrice(
  base: number,
  colorMode: "single" | "multi",
  colorPrices: Record<string, number>,
  color: string | null,
): number {
  if (colorMode === "single" && color) {
    const own = colorPrices[color];
    if (own && own > 0) return Math.max(0, own); // precio EXACTO del color
  }
  return Math.max(0, base);
}

/**
 * Precio unitario con VARIANTE (tamaño o combinación) elegida — espejo EXACTO
 * de la resolución del cobro online (orderService, testeada):
 *
 *   matriz `variant.colorPrices[color]` → precio de la variante → (sin
 *   variante) precio por color del producto → base.
 *
 * Con variante elegida NUNCA se usa el colorPrices del producto (en multi esa
 * columna guarda gramos, no precios). PURA: la usa la venta manual para que
 * cobrar a mano y cobrar online den el mismo número (2026-07-24, task #188).
 */
export function saleUnitPrice(params: {
  basePrice: number;
  colorMode: "single" | "multi";
  /** `products.color_prices` (solo significa PRECIO en color único). */
  productColorPrices: Record<string, number>;
  variant?: {
    price: number | null;
    colorPrices: Record<string, number>;
  } | null;
  color?: string | null;
}): number {
  const { basePrice, colorMode, productColorPrices, variant, color } = params;
  if (variant) {
    const cell =
      colorMode === "single" && color ? variant.colorPrices[color] : undefined;
    if (cell != null && cell > 0) return Math.max(0, cell);
    if (variant.price != null && variant.price > 0)
      return Math.max(0, variant.price);
    return Math.max(0, basePrice);
  }
  return colorUnitPrice(
    basePrice,
    colorMode,
    productColorPrices,
    color ?? null,
  );
}
