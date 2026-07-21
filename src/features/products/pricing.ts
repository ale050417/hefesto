/**
 * Precio unitario resolviendo el COLOR (modo "color único").
 *
 * Modelo de precio por color (decisión del negocio, 2026-07):
 * el precio que se carga por color es el precio EXACTO (absoluto) que paga el
 * cliente al elegir ese color — NO un ajuste (+/-) sobre una base. Si un color
 * no tiene precio propio, se cobra la base (nunca 0 silencioso).
 *
 * En "multicolor (combinación fija)" no hay elección de color: la pieza ya tiene
 * su precio (la suma de sus colores + insumos se calcula al cargar el producto),
 * así que este helper deja la base tal cual.
 *
 * Es una función PURA para que la use tanto el servidor (orderService, fuente de
 * verdad del cobro) como la UI (página de producto) y nunca diverjan.
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
  return Math.max(0, base); // sin precio propio → base (nunca 0)
}
