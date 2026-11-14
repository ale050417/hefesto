import type { Coupon } from "./types";

/**
 * Forma JSON de los cupones para la app móvil (`/api/v1/admin/descuentos`).
 * Módulo puro (sin DB). El estado se calcula ACÁ (no en la app) con la misma
 * regla que la grilla de /admin/descuentos: vencido > pausado > activo.
 */

export type CouponStatus = "active" | "paused" | "expired";

type CouponLike = Pick<Coupon, "isActive" | "expiresAt">;

export function couponStatus(
  c: CouponLike,
  now: Date = new Date(),
): CouponStatus {
  if (c.expiresAt != null && new Date(c.expiresAt) < now) return "expired";
  if (!c.isActive) return "paused";
  return "active";
}

export function couponToJson(c: Coupon, now: Date = new Date()) {
  return {
    id: c.id,
    code: c.code,
    description: c.description,
    type: c.type,
    value: Number(c.value),
    minPurchase: Number(c.minPurchase),
    scope: c.scope,
    targetId: c.targetId,
    targetLabel: c.targetLabel,
    birthdayOnly: c.birthdayOnly,
    maxUses: c.maxUses,
    usedCount: c.usedCount,
    startsAt: c.startsAt ? c.startsAt.toISOString() : null,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    isActive: c.isActive,
    status: couponStatus(c, now),
    createdAt: c.createdAt.toISOString(),
  };
}

/** Totales del encabezado: "N cupones activos · M usos totales". */
export function couponCounts(list: Coupon[], now: Date = new Date()) {
  const statuses = list.map((c) => couponStatus(c, now));
  return {
    total: list.length,
    active: statuses.filter((s) => s === "active").length,
    paused: statuses.filter((s) => s === "paused").length,
    expired: statuses.filter((s) => s === "expired").length,
    uses: list.reduce((sum, c) => sum + c.usedCount, 0),
  };
}
