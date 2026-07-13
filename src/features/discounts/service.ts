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

export type ValidateContext = {
  subtotal: number;
  /** Subtotal SOLO de los ítems a los que aplica el cupón (scope). Default = subtotal. */
  eligibleSubtotal?: number;
  /** Fecha de nacimiento del cliente logueado ("YYYY-MM-DD"), para cumpleaños. */
  customerBirthDate?: string | null;
  now?: Date;
};

/** ¿Hoy cae dentro de la semana del cumpleaños? (±3 días, ignora el año). Puro. */
export function isBirthdayWeek(
  birthDate: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!birthDate) return false;
  const parts = birthDate.slice(0, 10).split("-").map(Number);
  const mm = parts[1];
  const dd = parts[2];
  if (!mm || !dd) return false;
  const DAY = 86_400_000;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const y = today.getFullYear();
  return [y - 1, y, y + 1].some((year) => {
    const bd = new Date(year, mm - 1, dd);
    return Math.abs(bd.getTime() - today.getTime()) <= 3 * DAY;
  });
}

export type CouponScopeItem = {
  productId: string;
  categoryId: string | null;
  lineTotal: number;
};

/** Subtotal elegible según el scope del cupón (producto/categoría). Puro. */
export function eligibleSubtotal(
  coupon: { scope: string; targetId: string | null },
  items: CouponScopeItem[],
  fullSubtotal: number,
): number {
  if (coupon.scope === "all" || !coupon.targetId) return fullSubtotal;
  return round2(
    items.reduce((sum, it) => {
      const match =
        coupon.scope === "product"
          ? it.productId === coupon.targetId
          : it.categoryId === coupon.targetId;
      return match ? sum + it.lineTotal : sum;
    }, 0),
  );
}

/**
 * Valida un cupón (vigencia, usos, mínimo, cumpleaños) y calcula el descuento
 * sobre el subtotal ELEGIBLE (según scope). Reglas puras → testeables (Cap. 15).
 */
export function validateCoupon(
  coupon: CouponForValidation,
  ctx: ValidateContext,
): CouponValidation {
  const now = ctx.now ?? new Date();
  if (!coupon.isActive) {
    return { valid: false, reason: "El cupón no está activo." };
  }
  if (coupon.birthdayOnly && !isBirthdayWeek(ctx.customerBirthDate, now)) {
    return {
      valid: false,
      reason: "Es un cupón de cumpleaños: solo vale en la semana de tu cumple.",
    };
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
  if (ctx.subtotal < min) {
    return {
      valid: false,
      reason: `Requiere una compra mínima de $${min.toLocaleString("es-AR")}.`,
    };
  }
  const base = ctx.eligibleSubtotal ?? ctx.subtotal;
  if (base <= 0) {
    return {
      valid: false,
      reason: "El cupón no aplica a los productos del carrito.",
    };
  }
  const discount = computeDiscount(coupon.type, Number(coupon.value), base);
  return { valid: true, discount };
}
