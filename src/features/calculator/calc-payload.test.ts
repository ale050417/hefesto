import { describe, expect, it } from "vitest";
import { computeQuote } from "./calculator";
import {
  breakdownToJson,
  buildCalcPayload,
  historyRowToJson,
  statsToJson,
} from "./calc-payload";

const row = {
  id: "h1",
  name: "Soporte",
  customer: "Juan",
  material: "PLA",
  color: "Rojo",
  grams: "120.00",
  hours: "3.50",
  costPerKg: "25000.00",
  marginPct: "150.00",
  costoTotal: "1234.50",
  ganancia: "1851.75",
  precioFinal: "3086.25",
  notes: null,
  createdAt: new Date("2026-10-30T10:00:00Z"),
};

describe("historyRowToJson", () => {
  it("el operador NO recibe margen, costo ni ganancia", () => {
    const j = historyRowToJson(row, false) as Record<string, unknown>;
    expect(j.precioFinal).toBe(3086.25);
    expect(j.grams).toBe(120);
    for (const k of ["marginPct", "costoTotal", "ganancia", "costPerKg"]) {
      expect(k in j).toBe(false);
    }
  });

  it("el admin recibe todo como número", () => {
    const j = historyRowToJson(row, true) as Record<string, unknown>;
    expect(j.marginPct).toBe(150);
    expect(j.costoTotal).toBe(1234.5);
    expect(j.ganancia).toBe(1851.75);
    expect(j.createdAt).toBe("2026-10-30T10:00:00.000Z");
  });
});

describe("statsToJson", () => {
  const s = {
    count: 4,
    grams: 500,
    hours: 12,
    ganancia: 9000,
    precioFinal: 20000,
  };
  it("el operador no ve ganancia ni facturación", () => {
    const j = statsToJson(s, false) as Record<string, unknown>;
    expect(j).toEqual({ count: 4, grams: 500, hours: 12 });
  });
  it("el admin ve todo", () => {
    expect(statsToJson(s, true)).toMatchObject({
      ganancia: 9000,
      precioFinal: 20000,
    });
  });
});

describe("buildCalcPayload", () => {
  const base = {
    config: {
      kwhPrice: 95,
      machineWatts: 220,
      machineLifeHours: 8000,
      maintenanceCost: 320000,
      marginErrorPct: 8,
    },
    filaments: [
      {
        id: "f1",
        material: "PLA",
        color: "Rojo",
        brand: "Grilon3",
        costPerKg: 25000,
        hex: "#CC2200",
      },
    ],
    presetOptions: [{ id: "p1", name: "Llaveros" }],
    presets: [
      {
        id: "p1",
        name: "Llaveros",
        marginPct: 150,
        active: true,
        sortOrder: 0,
      },
      { id: "p2", name: "Viejo", marginPct: 80, active: false, sortOrder: 1 },
    ],
    history: [row],
    stats: {
      count: 1,
      grams: 120,
      hours: 3.5,
      ganancia: 1851.75,
      precioFinal: 3086.25,
    },
  };

  it("operador: tipos sin margen y nada que revele ganancia", () => {
    const p = buildCalcPayload({ ...base, isAdmin: false });
    expect(p.presets).toEqual([]);
    expect(p.presetOptions).toEqual([{ id: "p1", name: "Llaveros" }]);
    const serialized = JSON.stringify(p);
    expect(serialized).not.toContain("marginPct");
    expect(serialized).not.toContain("ganancia");
    expect(serialized).not.toContain("costoTotal");
  });

  it("admin: tipos con margen, activos e inactivos", () => {
    const p = buildCalcPayload({ ...base, isAdmin: true });
    expect(p.presets).toHaveLength(2);
    expect(p.presets[0]).toMatchObject({
      id: "p1",
      marginPct: 150,
      active: true,
    });
    expect(p.history[0]).toMatchObject({ marginPct: 150 });
  });
});

describe("breakdownToJson", () => {
  it("es el computeQuote de la web, sin reimplementar nada", () => {
    const input = {
      grams: 100,
      hours: 2,
      costPerKg: 20000,
      kwhPrice: 95,
      machineWatts: 220,
      machineLifeHours: 8000,
      maintenanceCost: 320000,
      marginErrorPct: 8,
      marginPct: 100,
    };
    const q = computeQuote(input);
    const j = breakdownToJson(q, 100, 20000);
    expect(j.material).toBe(2000);
    expect(j.precioFinal).toBe(q.precioFinal);
    expect(j.costoTotal).toBe(q.costoTotal);
    expect(j.marginPct).toBe(100);
    // El precio final = costo total + ganancia (100% de margen sobre el costo).
    expect(j.precioFinal).toBeCloseTo(j.costoTotal * 2, 1);
  });
});
