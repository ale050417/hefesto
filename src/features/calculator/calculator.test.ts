import { describe, expect, it } from "vitest";
import { computePrintPrice, computeQuote } from "./calculator";

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

describe("computeQuote", () => {
  const cfg = {
    kwhPrice: 100,
    machineWatts: 200,
    machineLifeHours: 8000,
    maintenanceCost: 320000,
  };
  it("desglosa material + luz + desgaste + error y aplica ganancia", () => {
    const r = computeQuote({
      grams: 500,
      hours: 1,
      costPerKg: 20000,
      ...cfg,
      marginErrorPct: 0,
      marginPct: 100,
    });
    expect(r.material).toBe(10000); // 0.5kg × 20000
    expect(r.electricidad).toBeCloseTo(20, 5); // 200×100/1000×1
    expect(r.desgaste).toBeCloseTo(40, 5); // 320000/8000×1
    expect(r.subtotal).toBeCloseTo(10060, 5);
    expect(r.costoTotal).toBeCloseTo(10060, 5);
    expect(r.ganancia).toBeCloseTo(10060, 5);
    expect(r.precioFinal).toBeCloseTo(20120, 5);
  });
  it("aplica margen de error antes de la ganancia", () => {
    const r = computeQuote({
      grams: 1000,
      hours: 0,
      costPerKg: 10000,
      ...cfg,
      marginErrorPct: 10,
      marginPct: 0,
    });
    // material 10000, sin horas → costo 10000, +10% error = 11000
    expect(r.margenError).toBeCloseTo(1000, 5);
    expect(r.costoTotal).toBeCloseTo(11000, 5);
    expect(r.precioFinal).toBeCloseTo(11000, 5);
  });
});
