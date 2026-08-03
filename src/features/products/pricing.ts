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

/** Producto tal como lo necesita `priceRange` (subconjunto de la fila + variantes). */
export type PriceableProduct = {
  /** `products.price` ya numérico. */
  price: number;
  /** `products.sale_price` numérico o null. */
  salePrice: number | null;
  colorMode: "single" | "multi";
  colors: string[];
  /** Solo significa PRECIO en color único (en multi son gramos). */
  colorPrices: Record<string, number>;
  variants: { price: number | null; colorPrices: Record<string, number> }[];
};

/**
 * Rango REAL de precios de un producto: el mínimo y el máximo que un cliente
 * puede llegar a pagar, recorriendo TODAS las combinaciones comprables
 * (tamaño × color) con `saleUnitPrice` — la misma función que cobra el servidor.
 *
 * Por qué existe (bug del casco, 2026-07-29): la tarjeta del catálogo mostraba
 * `products.price` crudo. Si el producto tiene tamaños con precio propio (o
 * precio por color), ese número NO es comprable: el casco figuraba en $1.200
 * y al entrar valía varias veces más. Un precio que el cliente no puede pagar
 * es peor que no mostrar precio.
 *
 * `from` = hay más de un precio posible → la tarjeta muestra "desde". Con un
 * solo precio posible (aunque haya 3 tamaños, todos al mismo valor) NO se
 * muestra "desde", que ahí sería ruido.
 */
export function priceRange(p: PriceableProduct): {
  min: number;
  max: number;
  from: boolean;
} {
  const onSale = p.salePrice != null && p.salePrice < p.price;
  const basePrice = onSale ? (p.salePrice as number) : p.price;

  // Ejes de la combinatoria. `[null]` = "no se elige" (sin tamaños / multicolor
  // o sin colores cargados), que es exactamente lo que manda la página.
  const variants: (PriceableProduct["variants"][number] | null)[] =
    p.variants.length > 0 ? p.variants : [null];
  const colors: (string | null)[] =
    p.colorMode === "single" && p.colors.length > 0 ? p.colors : [null];

  const prices: number[] = [];
  for (const variant of variants) {
    for (const color of colors) {
      prices.push(
        saleUnitPrice({
          basePrice,
          colorMode: p.colorMode,
          productColorPrices: p.colorPrices,
          variant,
          color,
        }),
      );
    }
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min, max, from: max > min };
}
