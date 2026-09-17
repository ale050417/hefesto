// Búsqueda por texto en el tablero de ventas (PURA: se testea sin DOM).

/** Lo mínimo que hace falta para buscar una venta (online o manual). */
export type SearchableSale = {
  customerName?: string | null;
  /** Detalle principal / número de pedido según el origen. */
  label?: string | null;
  ref?: string | null;
  detail?: string | null;
  category?: string | null;
  colors?: string[];
};

/** Texto comparable: minúsculas y SIN acentos, para que "Nicolas" encuentre a
 *  "Nicolás" (mismo criterio que la importación de ventas). */
function norm(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * ¿La venta coincide con lo buscado? Mira cliente, detalle, número de pedido,
 * categoría y colores: los datos con los que uno se acuerda de una venta.
 *
 * Cada palabra tiene que aparecer en ALGUNO de esos campos, no todas en el
 * mismo: así "nico rojo" encuentra el pedido de Nicolás que llevaba rojo, que
 * es como se busca de memoria. Búsqueda vacía = no filtra nada.
 */
export function saleMatches(sale: SearchableSale, query: string): boolean {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = norm(
    [
      sale.customerName,
      sale.label,
      sale.ref,
      sale.detail,
      sale.category,
      ...(sale.colors ?? []),
    ].join(" "),
  );
  return words.every((w) => haystack.includes(w));
}
