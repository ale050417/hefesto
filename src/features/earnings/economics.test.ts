import { describe, expect, it } from "vitest";
import {
  computeOrderEconomics,
  distribute,
  itemExtrasCost,
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

  it("el insumo del producto (extrasCost) baja la ganancia por unidad", () => {
    const sin = computeOrderEconomics(
      30000,
      [{ quantity: 2, weightGrams: 500, printMinutes: 60, costPerKg: 20000 }],
      settings,
    );
    const con = computeOrderEconomics(
      30000,
      [
        {
          quantity: 2,
          weightGrams: 500,
          printMinutes: 60,
          costPerKg: 20000,
          extrasCost: 500, // vaso: 500 por unidad
        },
      ],
      settings,
    );
    // 500 × 2 unidades = 1000 más de costo → 1000 menos de ganancia.
    expect(con.amort).toBeCloseTo(sin.amort + 1000, 5);
    expect(con.gananciaPura).toBeCloseTo(sin.gananciaPura - 1000, 5);
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

  it("descuenta la amortización: ganancia = total − amort", () => {
    const e = manualSaleEconomics(15000, 4000);
    expect(e.amort).toBe(4000);
    expect(e.gananciaPura).toBe(11000);
  });

  it("amort mayor al total → ganancia 0", () => {
    expect(manualSaleEconomics(1000, 5000).gananciaPura).toBe(0);
  });
});

describe("distribute", () => {
  it("reparte por porcentaje", () => {
    const r = distribute(10000, [
      { name: "Vos", pct: 60 },
      { name: "Socio", pct: 40 },
    ]);
    expect(r).toEqual([
      { name: "Vos", amount: 6000 },
      { name: "Socio", amount: 4000 },
    ]);
  });
  it("todo para uno", () => {
    expect(distribute(5000, [{ name: "Vos", pct: 100 }])).toEqual([
      { name: "Vos", amount: 5000 },
    ]);
  });
  it("ganancia negativa = 0", () => {
    expect(distribute(-100, [{ name: "Vos", pct: 100 }])[0]?.amount).toBe(0);
  });
});

describe("sharesTotal", () => {
  it("suma porcentajes", () => {
    expect(sharesTotal([{ pct: 60 }, { pct: 40 }])).toBe(100);
    expect(sharesTotal([{ pct: 50 }, { pct: 30 }])).toBe(80);
  });
});

// Insumo por TAMAÑO (2026-08-27): el vaso del chop de 1L no cuesta lo mismo
// que el de 500cc. Toca plata → tests en el mismo paso (Cap. 15).
describe("itemExtrasCost (insumo por tamaño/combinación)", () => {
  const chop = new Map([
    ["500cc", 5000],
    ["1L", 8000],
  ]);

  it("usa el insumo del tamaño vendido, no el del producto", () => {
    expect(
      itemExtrasCost({
        variantLabel: "1L",
        variantExtras: chop,
        productExtras: 7000,
      }),
    ).toBe(8000);
    expect(
      itemExtrasCost({
        variantLabel: "500cc",
        variantExtras: chop,
        productExtras: 7000,
      }),
    ).toBe(5000);
  });

  it('matchea "Tamaño · Color" (snapshot del pedido online)', () => {
    expect(
      itemExtrasCost({
        variantLabel: "1L · Rojo",
        variantExtras: chop,
        productExtras: 7000,
      }),
    ).toBe(8000);
  });

  it("0 explícito vale: ese tamaño NO lleva insumo", () => {
    const m = new Map([["Chico", 0]]);
    expect(
      itemExtrasCost({
        variantLabel: "Chico",
        variantExtras: m,
        productExtras: 7000,
      }),
    ).toBe(0);
  });

  it("tamaño sin insumo propio → cae al del producto", () => {
    expect(
      itemExtrasCost({
        variantLabel: "2L",
        variantExtras: chop,
        productExtras: 7000,
      }),
    ).toBe(7000);
  });

  it("sin label o sin mapa → el del producto", () => {
    expect(
      itemExtrasCost({
        variantLabel: null,
        variantExtras: chop,
        productExtras: 7000,
      }),
    ).toBe(7000);
    expect(
      itemExtrasCost({
        variantLabel: "1L",
        variantExtras: undefined,
        productExtras: 7000,
      }),
    ).toBe(7000);
  });
});
