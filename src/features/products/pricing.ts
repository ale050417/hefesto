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
