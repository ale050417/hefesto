import type { OrderStatus } from "./types";

/**
 * Filtro por MES del tablero de Pedidos (pedido de Agustín, 2026-11-17): con
 * todas las ventas juntas cuesta ver qué falta cargar del mes. Módulo puro (sin
 * React ni servidor) para poder testear el borde de la zona horaria.
 *
 * El mes de una venta se decide en hora de ARGENTINA, no en UTC: una venta del
 * 31 a las 22:30 acá ya es día 1 en UTC, y si se mirara en UTC caería en el mes
 * siguiente.
 */

export const SALES_TIME_ZONE = "America/Argentina/Buenos_Aires";

/** Mes como "2026-11": se compara y ordena como texto. */
export type MonthKey = string;

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: SALES_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
});

/**
 * A qué mes (hora de Argentina) pertenece una fecha. Devuelve null si la fecha
 * no se puede leer: esa venta solo aparece en "Todos los meses".
 */
export function monthKeyOf(date: string | Date): MonthKey | null {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  let year = "";
  let month = "";
  for (const p of partsFmt.formatToParts(d)) {
    if (p.type === "year") year = p.value;
    else if (p.type === "month") month = p.value;
  }
  return year && month ? `${year}-${month}` : null;
}

/** Avanza (o retrocede, con `delta` negativo) meses; cruza de año solo. */
export function stepMonth(key: MonthKey, delta: number): MonthKey {
  const [y, m] = key.split("-").map(Number);
  const total = (y ?? 0) * 12 + ((m ?? 1) - 1) + delta;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/** "noviembre 2026": el año va siempre, así se nota al pasar de un año a otro. */
export function monthLabel(key: MonthKey): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1] ?? key} ${y ?? ""}`.trim();
}

const CLOSED: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "delivered",
  "cancelled",
  "refunded",
]);

/** Venta todavía abierta: ni entregada, ni cancelada, ni reembolsada. */
export function isOpenStatus(status: OrderStatus): boolean {
  return !CLOSED.has(status);
}
