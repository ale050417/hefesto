import { describe, expect, it } from "vitest";
import {
  computeOrderEconomics,
  manualSaleEconomics,
  productAmort,
  sharesTotal,
  type CostSettings,
} from "./economics";

const settings: CostSettings = {
  kwhPrice: 100,
  machineWatts: 200,
  machineLifeHours: 8000,
  maintenanceCost: 320000,
};

describe("productAmort", () => {
  it("material = gramos × costo/kg", () => {
    // 500 g a 20000/kg = 10000 de material
    const a = productAmort(500, 60, 20000, settings);
    expect(a.material).toBe(10000);
    expect(a.grams).toBe(500);
    expect(a.hours).toBe(1);
    // electricidad: 200W × 100 / 1000 × 1h = 20
    expect(a.electricidad).toBeCloseTo(20, 5);
    // desgaste: 320000/8000 × 1h = 40
    expect(a.desgaste).toBeCloseTo(40, 5);
    expect(a.total).toBeCloseTo(10060, 5);
  });

  it("estima horas si no hay tiempo de impresión (~22 g/h)", () => {
    const a = productAmort(220, 0, 0, settings);
    expect(a.hours).toBeCloseTo(10, 5);
  });

  it("sin peso → material 0", () => {
    const a = productAmort(0, 0, 20000, settings);
    expect(a.material).toBe(0);
    expect(a.total).toBe(0);
  });
});

describe("computeOrderEconomics", () => {
  it("suma amortización por cantidad y calcula ganancia pura", () => {
    const e = computeOrderEconomics(
      30000,
      [{ quantity: 2, weightGrams: 500, printMinutes: 60, costPerKg: 20000 }],
      settings,
    );
    // amort por unidad ≈ 10060, ×2 = 20120
    expect(e.amort).toBeCloseTo(20120, 5);
    expect(e.gananciaPura).toBeCloseTo(9880, 5);
    expect(e.grams).toBe(1000);
  });

  it("ganancia pura nunca es negativa", () => {
    const e = computeOrderEconomics(
      1000,
      [{ quantity: 1, weightGrams: 1000, printMinutes: 120, costPerKg: 20000 }],
      settings,
    );
    expect(e.gananciaPura).toBe(0);
  });
});

describe("manualSaleEconomics", () => {
  it("sin datos de costo: la ganancia pura es el total (amort 0)", () => {
    const e = manualSaleEconomics(15000);
    expect(e.ingreso).toBe(15000);
    expect(e.amort).toBe(0);
    expect(e.gananciaPura).toBe(15000);
    expect(e.grams).toBe(0);
  });

  it("ganancia pura nunca es negativa", () => {
    expect(manualSaleEconomics(-100).gananciaPura).toBe(0);
  });
});

describe("sharesTotal", () => {
  it("suma porcentajes", () => {
    expect(sharesTotal([{ pct: 60 }, { pct: 40 }])).toBe(100);
    expect(sharesTotal([{ pct: 50 }, { pct: 30 }])).toBe(80);
  });
});
