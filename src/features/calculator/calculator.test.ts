import { describe, expect, it } from "vitest";
import {
  computePrintPrice,
  computeQuote,
  formatPrintTime,
  resolveCostPerKg,
  roundPrice,
  roundQuote,
  selectActiveMargin,
} from "./calculator";
import { marginPresetSchema } from "./schemas";

// Fix auditoría 2026-07: el costo se resuelve por FILAMENTO (id), no por el
// string material (que colapsaba PLA dorado $35.000 y PLA blanco $25.000).
describe("resolveCostPerKg", () => {
  const fils = [
    { id: "f-blanco", material: "PLA", costPerKg: 25000 },
    { id: "f-dorado", material: "PLA", costPerKg: 35000 },
    { id: "f-petg", material: "PETG", costPerKg: 28000 },
  ];

  it("con filamentId devuelve el costo de ESE filamento (no el primero del material)", () => {
    expect(resolveCostPerKg(fils, { filamentId: "f-dorado" })).toBe(35000);
    expect(resolveCostPerKg(fils, { filamentId: "f-blanco" })).toBe(25000);
  });

  it("filamentId inexistente → null (nunca un 0 silencioso)", () => {
    expect(resolveCostPerKg(fils, { filamentId: "borrado" })).toBeNull();
  });

  it("solo material (productos) → el costo MÁS CARO de ese material (conservador)", () => {
    expect(resolveCostPerKg(fils, { material: "PLA" })).toBe(35000);
    expect(resolveCostPerKg(fils, { material: "PETG" })).toBe(28000);
  });

  it("material sin filamentos cargados → null (el caller rechaza)", () => {
    expect(resolveCostPerKg(fils, { material: "ABS" })).toBeNull();
    expect(resolveCostPerKg([], { material: "PLA" })).toBeNull();
  });

  it("sin filamentId ni material → null", () => {
    expect(resolveCostPerKg(fils, {})).toBeNull();
  });

  it("filamentId tiene prioridad sobre material", () => {
    expect(
      resolveCostPerKg(fils, { filamentId: "f-blanco", material: "PLA" }),
    ).toBe(25000);
  });
});

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
  it("calcula el costo de material (gramos × precio por kg)", () => {
    const r = computeQuote({
      grams: 500,
      costPerKg: 20000,
      hours: 0,
      ...cfg,
      marginErrorPct: 0,
      marginPct: 0,
    });
    expect(r.material).toBe(10000);
  });
});

describe("selectActiveMargin", () => {
  const presets = [
    { id: "a", marginPct: 200, active: true },
    { id: "b", marginPct: 150, active: false },
  ];
  it("devuelve el margen de un tipo activo", () => {
    expect(selectActiveMargin(presets, "a")).toBe(200);
  });
  it("null si el tipo está inactivo", () => {
    expect(selectActiveMargin(presets, "b")).toBeNull();
  });
  it("null si el tipo no existe", () => {
    expect(selectActiveMargin(presets, "zzz")).toBeNull();
  });
});

describe("marginPresetSchema", () => {
  it("acepta un tipo válido y permite margen >100%", () => {
    const r = marginPresetSchema.safeParse({
      name: "Llaveros 2 colores",
      marginPct: "230",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.marginPct).toBe(230);
      expect(r.data.active).toBe(true);
      expect(r.data.sortOrder).toBe(0);
    }
  });
  it("rechaza nombre vacío", () => {
    expect(
      marginPresetSchema.safeParse({ name: "  ", marginPct: 100 }).success,
    ).toBe(false);
  });
  it("rechaza margen negativo", () => {
    expect(
      marginPresetSchema.safeParse({ name: "X", marginPct: -1 }).success,
    ).toBe(false);
  });
});

// Redondeo comercial (2026-07-24): precios redondos dan confianza. HACIA
// ARRIBA al múltiplo de $100: nunca se cobra menos que lo calculado.
describe("roundPrice (múltiplo de $100 hacia arriba)", () => {
  it("un número feo sube al próximo múltiplo de 100", () => {
    expect(roundPrice(1231234)).toBe(1231300);
    expect(roundPrice(20001)).toBe(20100);
    expect(roundPrice(2814)).toBe(2900);
  });

  it("un precio ya redondo no cambia (idempotente)", () => {
    expect(roundPrice(20000)).toBe(20000);
    expect(roundPrice(20100)).toBe(20100);
  });

  it("nunca redondea hacia abajo", () => {
    expect(roundPrice(19901)).toBe(20000);
    expect(roundPrice(99.5)).toBe(100);
  });

  it("cero, negativos o basura → 0", () => {
    expect(roundPrice(0)).toBe(0);
    expect(roundPrice(-500)).toBe(0);
    expect(roundPrice(Number.NaN)).toBe(0);
    expect(roundPrice(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

// Arreglo de Agustín (2026-11-18): la Calculadora cotiza en números redondos
// y el historial muestra el tiempo en horas y minutos.
describe("roundQuote", () => {
  const base = {
    grams: 227,
    hours: 23.2,
    costPerKg: 26000,
    kwhPrice: 95,
    machineWatts: 220,
    machineLifeHours: 8000,
    maintenanceCost: 320000,
    marginErrorPct: 8,
    marginPct: 300,
  };

  it("redondea el precio a $100 hacia arriba y no toca el costo", () => {
    const q = computeQuote(base);
    const r = roundQuote(q);
    expect(r.precioFinal % 100).toBe(0);
    expect(r.precioFinal).toBeGreaterThanOrEqual(q.precioFinal);
    expect(r.precioFinal - q.precioFinal).toBeLessThan(100);
    expect(r.costoTotal).toBe(q.costoTotal);
  });

  it("lo que suma el redondeo va a la ganancia", () => {
    const r = roundQuote(computeQuote(base));
    expect(r.costoTotal + r.ganancia).toBeCloseTo(r.precioFinal, 2);
  });

  it("sin datos sigue dando 0", () => {
    const r = roundQuote(computeQuote({ ...base, grams: 0, hours: 0 }));
    expect(r.precioFinal).toBe(0);
    expect(r.ganancia).toBe(0);
  });
});

describe("formatPrintTime", () => {
  it("horas con decimales → horas y minutos", () => {
    expect(formatPrintTime(23.2)).toBe("23 h 12 min");
    expect(formatPrintTime(1.57)).toBe("1 h 34 min");
    expect(formatPrintTime(2)).toBe("2 h");
    expect(formatPrintTime(0.75)).toBe("45 min");
    expect(formatPrintTime(0)).toBe("0 min");
  });
});
