import type { OrderListItem, OrderStatus } from "@/features/orders/types";

/**
 * Tablero de la cola de producción (`/admin/produccion`): arma las tarjetas a
 * partir de los pedidos online y las ventas manuales. Antes vivía inline en la
 * página; se extrajo (2026-10-31, app móvil) para que la web y la API de la app
 * (`/api/v1/admin/produccion`) muestren EXACTAMENTE las mismas tarjetas.
 */

// Estados del tablero (flujo de trabajo). Se excluyen cancelado/reembolsado:
// son salidas terminales, no etapas del taller.
export const BOARD_STATES: OrderStatus[] = [
  "pending_payment",
  "confirmed",
  "in_production",
  "ready",
  "shipped",
  "delivered",
];

export const DELIVERED_HIDE_MS = 24 * 60 * 60 * 1000;

/** Horas sin avanzar a partir de las cuales una tarjeta se marca "demorada". */
export const LATE_AFTER_HOURS = 48;

export type BoardManualSale = {
  id: string;
  status: OrderStatus;
  detail: string | null;
  customerName: string;
  total: string;
  saleDate: Date;
};

export type BoardCard = {
  id: string;
  source: "online" | "manual";
  /** Qué se imprime: resumen de productos (online) o detalle (manual). */
  label: string;
  customerName: string | null;
  total: number;
  status: OrderStatus;
  createdAt: Date;
};

/**
 * Arma las cards del tablero (online + manual) y oculta las entregadas hace más
 * de un día. `now` es parámetro (y no `Date.now()` adentro del render) para que
 * sea pura y testeable.
 */
export function buildBoardOrders(
  items: OrderListItem[],
  sales: BoardManualSale[],
  now: number = Date.now(),
): BoardCard[] {
  const stillOnBoard = (status: string, deliveredSince: Date) =>
    BOARD_STATES.includes(status as OrderStatus) &&
    (status !== "delivered" ||
      now - deliveredSince.getTime() < DELIVERED_HIDE_MS);

  const online: BoardCard[] = items
    .filter((o) => stillOnBoard(o.status, o.updatedAt))
    .map((o) => ({
      id: o.id,
      source: "online",
      label: o.itemsSummary || o.orderNumber,
      customerName: o.customerName,
      total: o.total,
      status: o.status,
      createdAt: o.createdAt,
    }));
  const manual: BoardCard[] = sales
    .filter((s) => stillOnBoard(s.status, s.saleDate))
    .map((s) => ({
      id: s.id,
      source: "manual",
      label: s.detail ?? "Venta manual",
      customerName: s.customerName,
      total: Number(s.total),
      status: s.status,
      createdAt: s.saleDate,
    }));
  return [...online, ...manual];
}

/** Horas enteras desde que se creó el pedido (el "hace X h" del tablero). */
export function hoursSince(createdAt: Date | string, now: number): number {
  return Math.max(
    0,
    Math.floor((now - new Date(createdAt).getTime()) / 3_600_000),
  );
}

/**
 * ¿Demorada? Solo cuenta cuando el trabajo está en taller (pago confirmado o en
 * producción) y lleva 48 h o más: mismo criterio que la tarjeta de la web.
 */
export function isLate(status: OrderStatus, hours: number): boolean {
  return (
    (status === "confirmed" || status === "in_production") &&
    hours >= LATE_AFTER_HOURS
  );
}
