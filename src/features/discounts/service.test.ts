import { describe, expect, it } from "vitest";
import { computeDiscount, validateCoupon } from "./service";
import type { CouponForValidation } from "./types";

function coupon(over: Partial<CouponForValidation> = {}): CouponForValidation {
  return {
    type: "percentage",
    value: "10",
    minPurchase: "0",
    maxUses: null,
    usedCount: 0,
    startsAt: null,
    expiresAt: null,
    isActive: true,
    ...over,
  } as CouponForValidation;
}

describe("computeDiscount", () => {
  it("porcentaje", () => {
    expect(computeDiscount("percentage", 10, 1000)).toBe(100);
  });
  it("fijo", () => {
    expect(computeDiscount("fixed", 250, 1000)).toBe(250);
  });
  it("fijo nunca supera el subtotal", () => {
    expect(computeDiscount("fixed", 5000, 1000)).toBe(1000);
  });
});

describe("validateCoupon", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  it("válido: devuelve el descuento", () => {
    const r = validateCoupon(
      coupon({ type: "percentage", value: "20" }),
      1000,
      now,
    );
    expect(r).toEqual({ valid: true, discount: 200 });
  });

  it("rechaza inactivo", () => {
    const r = validateCoupon(coupon({ isActive: false }), 1000, now);
    expect(r.valid).toBe(false);
  });

  it("rechaza no vigente aún", () => {
    const r = validateCoupon(
      coupon({ startsAt: new Date("2026-07-01T00:00:00Z") }),
      1000,
      now,
    );
    expect(r.valid).toBe(false);
  });

  it("rechaza vencido", () => {
    const r = validateCoupon(
      coupon({ expiresAt: new Date("2026-06-01T00:00:00Z") }),
      1000,
      now,
    );
    expect(r.valid).toBe(false);
  });

  it("rechaza agotado (max usos)", () => {
    const r = validateCoupon(coupon({ maxUses: 5, usedCount: 5 }), 1000, now);
    expect(r.valid).toBe(false);
  });

  it("rechaza por debajo del mínimo", () => {
    const r = validateCoupon(coupon({ minPurchase: "2000" }), 1000, now);
    expect(r.valid).toBe(false);
  });
});
