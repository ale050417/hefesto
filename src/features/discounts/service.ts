import type { CouponForValidation, CouponType } from "./types";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Descuento según el tipo (Strategy: % o fijo). Nunca supera el subtotal.
 */
export function computeDiscount(
  type: CouponType,
  value: number,
  subtotal: number,
): number {
  if (subtotal <= 0) return 0;
  const raw = type === "percentage" ? (subtotal * value) / 100 : value;
  return round2(Math.min(raw, subtotal));
}

export type CouponValidation =
  | { valid: true; discount: number }
  | { valid: false; reason: string };

/**
 * Valida un cupón contra el subtotal (vigencia, usos, mínimo). Reglas de
 * negocio puras → testeables. La autorización/lectura va aparte.
 */
export function validateCoupon(
  coupon: CouponForValidation,
  subtotal: number,
  now: Date = new Date(),
): CouponValidation {
  if (!coupon.isActive) {
    return { valid: false, reason: "El cupón no está activo." };
  }
  if (coupon.startsAt && now < coupon.startsAt) {
    return { valid: false, reason: "El cupón todavía no está vigente." };
  }
  if (coupon.expiresAt && now > coupon.expiresAt) {
    return { valid: false, reason: "El cupón está vencido." };
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, reason: "El cupón llegó a su límite de usos." };
  }
  const min = Number(coupon.minPurchase);
  if (subtotal < min) {
    return {
      valid: false,
      reason: `Requiere una compra mínima de $${min.toLocaleString("es-AR")}.`,
    };
  }
  const discount = computeDiscount(coupon.type, Number(coupon.value), subtotal);
  return { valid: true, discount };
}
