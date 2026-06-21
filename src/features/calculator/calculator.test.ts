import { describe, expect, it } from "vitest";
import { computePrintPrice } from "./calculator";

describe("computePrintPrice", () => {
  it("suma material + tiempo + extra y aplica margen", () => {
    const r = computePrintPrice({
      weightGrams: 200,
      printHours: 5,
      materialCostPerKg: 10000, // $10.000/kg → 200g = $2.000
      machineRatePerHour: 500, // 5h → $2.500
      extraCost: 500,
      marginPct: 100, // duplica
    });
    expect(r.materialCost).toBe(2000);
    expect(r.timeCost).toBe(2500);
    expect(r.base).toBe(5000);
    expect(r.margin).toBe(5000);
    expect(r.price).toBe(10000);
  });
  it("sin margen el precio es el costo base", () => {
    const r = computePrintPrice({
      weightGrams: 100,
      printHours: 1,
      materialCostPerKg: 5000,
      machineRatePerHour: 300,
    });
    expect(r.base).toBe(800);
    expect(r.price).toBe(800);
  });
  it("ignora valores negativos o inválidos", () => {
    const r = computePrintPrice({
      weightGrams: -5,
      printHours: Number.NaN,
      materialCostPerKg: 5000,
      machineRatePerHour: 300,
    });
    expect(r.price).toBe(0);
  });
});
