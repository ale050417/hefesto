import * as repo from "./repository";
import type { CouponInput } from "./schemas";
import type { Coupon } from "./types";

function toDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getCouponByCode(code: string): Promise<Coupon | null> {
  return repo.findByCode(code.trim().toUpperCase());
}

export async function listCoupons(): Promise<Coupon[]> {
  return repo.listCoupons();
}

export async function getCoupon(id: string): Promise<Coupon | null> {
  return repo.findCouponById(id);
}

function toValues(input: CouponInput) {
  return {
    code: input.code,
    description: input.description ?? null,
    type: input.type,
    value: String(input.value),
    minPurchase: String(input.minPurchase ?? 0),
    maxUses: input.maxUses ?? null,
    startsAt: toDate(input.startsAt),
    expiresAt: toDate(input.expiresAt),
    isActive: input.isActive ?? true,
    scope: input.scope ?? "all",
    targetId:
      input.scope && input.scope !== "all" ? (input.targetId ?? null) : null,
    targetLabel:
      input.scope && input.scope !== "all" ? (input.targetLabel ?? null) : null,
    birthdayOnly: input.birthdayOnly ?? false,
  };
}

/**
 * Cupón PERSONAL generado por un canje de puntos (Recompensas). Código único
 * "PREMIO-XXXX", un solo uso. Devuelve el código para mostrárselo al cliente.
 */
export async function createRewardCoupon(params: {
  isPercent: boolean;
  value: number;
  description: string;
}): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = `PREMIO-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    if (await getCouponByCode(code)) continue;
    await repo.insertCoupon({
      code,
      type: params.isPercent ? "percentage" : "fixed",
      value: String(params.value),
      maxUses: 1,
      description: params.description,
    });
    return code;
  }
  throw new Error("No se pudo generar el cupón del premio.");
}

/**
 * Desactiva un cupón de premio por su código. Se usa como reverso: si después de
 * crear el cupón no se pudieron descontar los puntos, el cupón no debe quedar
 * usable. Best-effort (si el código no existe, no hace nada).
 */
export async function deactivateRewardCoupon(code: string): Promise<void> {
  const coupon = await getCouponByCode(code);
  if (coupon) await repo.updateCouponRow(coupon.id, { isActive: false });
}

export async function addCoupon(input: CouponInput): Promise<Coupon> {
  return repo.insertCoupon(toValues(input));
}

export async function updateCoupon(
  id: string,
  input: CouponInput,
): Promise<Coupon> {
  return repo.updateCouponRow(id, toValues(input));
}

export async function toggleCoupon(
  id: string,
  isActive: boolean,
): Promise<Coupon> {
  return repo.updateCouponRow(id, { isActive });
}

export async function deleteCoupon(id: string): Promise<void> {
  await repo.deleteCouponRow(id);
}
