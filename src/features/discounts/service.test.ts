import { describe, expect, it } from "vitest";
import {
  computeDiscount,
  validateCoupon,
  isBirthdayWeek,
  eligibleSubtotal,
} from "./service";
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
    scope: "all",
    targetId: null,
    birthdayOnly: false,
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
    const r = validateCoupon(coupon({ type: "percentage", value: "20" }), {
      subtotal: 1000,
      now,
    });
    expect(r).toEqual({ valid: true, discount: 200 });
  });
  it("rechaza inactivo", () => {
    expect(
      validateCoupon(coupon({ isActive: false }), { subtotal: 1000, now })
        .valid,
    ).toBe(false);
  });
  it("rechaza no vigente aún", () => {
    expect(
      validateCoupon(coupon({ startsAt: new Date("2026-07-01T00:00:00Z") }), {
        subtotal: 1000,
        now,
      }).valid,
    ).toBe(false);
  });
  it("rechaza vencido", () => {
    expect(
      validateCoupon(coupon({ expiresAt: new Date("2026-06-01T00:00:00Z") }), {
        subtotal: 1000,
        now,
      }).valid,
    ).toBe(false);
  });
  it("rechaza agotado (max usos)", () => {
    expect(
      validateCoupon(coupon({ maxUses: 5, usedCount: 5 }), {
        subtotal: 1000,
        now,
      }).valid,
    ).toBe(false);
  });
  it("rechaza por debajo del mínimo", () => {
    expect(
      validateCoupon(coupon({ minPurchase: "2000" }), { subtotal: 1000, now })
        .valid,
    ).toBe(false);
  });

  it("scope: descuenta solo el subtotal elegible", () => {
    // % 20 sobre el elegible (600), no sobre el total (1000).
    const r = validateCoupon(
      coupon({ type: "percentage", value: "20", scope: "product" }),
      { subtotal: 1000, eligibleSubtotal: 600, now },
    );
    expect(r).toEqual({ valid: true, discount: 120 });
  });
  it("scope: sin ítems elegibles → no aplica", () => {
    const r = validateCoupon(coupon({ scope: "category" }), {
      subtotal: 1000,
      eligibleSubtotal: 0,
      now,
    });
    expect(r.valid).toBe(false);
  });

  it("cumpleaños: rechaza fuera de la semana del cumple", () => {
    const r = validateCoupon(coupon({ birthdayOnly: true }), {
      subtotal: 1000,
      customerBirthDate: "1990-01-01",
      now,
    });
    expect(r.valid).toBe(false);
  });
  it("cumpleaños: acepta en la semana del cumple", () => {
    const r = validateCoupon(coupon({ birthdayOnly: true }), {
      subtotal: 1000,
      customerBirthDate: "1990-06-16",
      now, // 15 de junio, cumple el 16 → dentro de ±3 días
    });
    expect(r.valid).toBe(true);
  });
});

describe("isBirthdayWeek", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  it("dentro de ±3 días", () => {
    expect(isBirthdayWeek("1990-06-14", now)).toBe(true);
    expect(isBirthdayWeek("2000-06-18", now)).toBe(true);
  });
  it("fuera de la ventana", () => {
    expect(isBirthdayWeek("1990-06-25", now)).toBe(false);
  });
  it("sin fecha → false", () => {
    expect(isBirthdayWeek(null, now)).toBe(false);
  });
  it("borde de año (fin de diciembre / principio de enero)", () => {
    const nye = new Date("2026-12-31T12:00:00Z");
    expect(isBirthdayWeek("1990-01-02", nye)).toBe(true);
  });
});

describe("eligibleSubtotal", () => {
  const items = [
    { productId: "p1", categoryId: "c1", lineTotal: 300 },
    { productId: "p2", categoryId: "c2", lineTotal: 700 },
  ];
  it("scope all → todo el subtotal", () => {
    expect(
      eligibleSubtotal({ scope: "all", targetId: null }, items, 1000),
    ).toBe(1000);
  });
  it("scope product → solo ese producto", () => {
    expect(
      eligibleSubtotal({ scope: "product", targetId: "p1" }, items, 1000),
    ).toBe(300);
  });
  it("scope category → solo esa categoría", () => {
    expect(
      eligibleSubtotal({ scope: "category", targetId: "c2" }, items, 1000),
    ).toBe(700);
  });
});
