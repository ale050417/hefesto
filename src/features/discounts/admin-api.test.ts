import { describe, expect, it } from "vitest";
import { couponCounts, couponStatus, couponToJson } from "./admin-api";
import type { Coupon } from "./types";

const NOW = new Date("2026-10-31T12:00:00Z");

function coupon(over: Partial<Coupon> = {}): Coupon {
  return {
    id: "k1",
    code: "HEFESTO15",
    description: "15% en toda la tienda",
    type: "percentage",
    value: "15.00",
    minPurchase: "0.00",
    scope: "all",
    targetId: null,
    targetLabel: null,
    birthdayOnly: false,
    maxUses: null,
    usedCount: 0,
    startsAt: null,
    expiresAt: null,
    isActive: true,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    ...over,
  } as Coupon;
}

describe("couponStatus (misma regla que la grilla web)", () => {
  it("activo por defecto", () => {
    expect(couponStatus(coupon(), NOW)).toBe("active");
  });
  it("pausado si no está activo", () => {
    expect(couponStatus(coupon({ isActive: false }), NOW)).toBe("paused");
  });
  it("vencido gana sobre pausado", () => {
    const past = new Date("2026-10-30T00:00:00Z");
    expect(couponStatus(coupon({ expiresAt: past }), NOW)).toBe("expired");
    expect(
      couponStatus(coupon({ expiresAt: past, isActive: false }), NOW),
    ).toBe("expired");
  });
  it("con vencimiento futuro sigue activo", () => {
    const future = new Date("2026-12-01T00:00:00Z");
    expect(couponStatus(coupon({ expiresAt: future }), NOW)).toBe("active");
  });
});

describe("couponToJson / couponCounts", () => {
  it("convierte los numeric de Postgres a número y las fechas a ISO", () => {
    const j = couponToJson(
      coupon({
        value: "2000.00",
        type: "fixed",
        minPurchase: "5000.50",
        expiresAt: new Date("2026-11-30T00:00:00Z"),
        maxUses: 10,
        usedCount: 4,
      }),
      NOW,
    );
    expect(j.value).toBe(2000);
    expect(j.minPurchase).toBe(5000.5);
    expect(j.expiresAt).toBe("2026-11-30T00:00:00.000Z");
    expect(j.startsAt).toBeNull();
    expect(j.status).toBe("active");
    expect(j.usedCount).toBe(4);
  });
  it("cuenta estados y usos totales", () => {
    const list = [
      coupon({ usedCount: 3 }),
      coupon({ id: "k2", isActive: false, usedCount: 1 }),
      coupon({
        id: "k3",
        expiresAt: new Date("2026-01-01T00:00:00Z"),
        usedCount: 5,
      }),
    ];
    expect(couponCounts(list, NOW)).toEqual({
      total: 3,
      active: 1,
      paused: 1,
      expired: 1,
      uses: 9,
    });
  });
});
