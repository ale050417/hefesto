import type { AdminCustomer } from "./service";
import { TIER_LABEL, TIER_THRESHOLDS, type CustomerTier } from "./tier";
import type { Order } from "./types";

/**
 * Forma JSON de los clientes para la app móvil (`/api/v1/admin/clientes`).
 * Módulo puro (sin DB): mapea lo que ya calcula `service.ts` y filtra la lista.
 */

export const CUSTOMER_TIERS = ["gold", "silver", "bronze"] as const;

export function customerToJson(c: AdminCustomer) {
  return {
    id: c.id,
    source: c.source,
    name: c.name,
    email: c.email,
    phone: c.phone,
    city: c.city,
    note: c.note,
    since: c.since.toISOString(),
    orders: c.orders,
    spent: c.spent,
    tier: c.tier,
    tierLabel: TIER_LABEL[c.tier],
  };
}

/**
 * Búsqueda + nivel sobre la lista unificada. La web busca por nombre y email;
 * en el celu también por teléfono (sin importar espacios/guiones) y ciudad.
 */
export function filterAdminCustomers(
  list: AdminCustomer[],
  opts: { q?: string; tier?: CustomerTier },
): AdminCustomer[] {
  const needle = (opts.q ?? "").trim().toLowerCase();
  const digits = needle.replace(/\D/g, "");
  return list.filter((c) => {
    if (opts.tier && c.tier !== opts.tier) return false;
    if (!needle) return true;
    if (c.name.toLowerCase().includes(needle)) return true;
    if ((c.email ?? "").toLowerCase().includes(needle)) return true;
    if ((c.city ?? "").toLowerCase().includes(needle)) return true;
    const phone = c.phone ?? "";
    if (phone.toLowerCase().includes(needle)) return true;
    return digits.length >= 3 && phone.replace(/\D/g, "").includes(digits);
  });
}

/** Cantidad por nivel sobre TODA la lista (para los filtros de la app). */
export function customerCounts(list: AdminCustomer[]) {
  return {
    all: list.length,
    gold: list.filter((c) => c.tier === "gold").length,
    silver: list.filter((c) => c.tier === "silver").length,
    bronze: list.filter((c) => c.tier === "bronze").length,
  };
}

/** Qué hace falta para cada nivel (los umbrales viven en `tier.ts`). */
export function tiersInfo() {
  return {
    gold: {
      label: TIER_LABEL.gold,
      minSpent: TIER_THRESHOLDS.gold.spent,
      minOrders: TIER_THRESHOLDS.gold.orders,
    },
    silver: {
      label: TIER_LABEL.silver,
      minSpent: TIER_THRESHOLDS.silver.spent,
      minOrders: TIER_THRESHOLDS.silver.orders,
    },
    bronze: { label: TIER_LABEL.bronze, minSpent: 0, minOrders: 0 },
  };
}

type OrderLite = Pick<Order, "id" | "orderNumber" | "status" | "total"> & {
  createdAt: Date;
};

type PointsLite = {
  balance: number;
  earned: number;
  redeemed: number;
  redemptions: {
    id: string;
    reason: string;
    points: number;
    createdAt: Date;
  }[];
};

/** Detalle de un cliente: ficha + pedidos + puntos (montos como número). */
export function customerDetailToJson(data: {
  customer: AdminCustomer;
  orders: OrderLite[];
  points: PointsLite;
}) {
  return {
    customer: customerToJson(data.customer),
    orders: data.orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: Number(o.total),
      createdAt: o.createdAt.toISOString(),
    })),
    points: {
      balance: data.points.balance,
      earned: data.points.earned,
      redeemed: data.points.redeemed,
      redemptions: data.points.redemptions.map((r) => ({
        id: r.id,
        reason: r.reason,
        points: r.points,
        createdAt: r.createdAt.toISOString(),
      })),
    },
  };
}
