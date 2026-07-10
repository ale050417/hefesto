import { describe, expect, it } from "vitest";
import {
  buildSalesCsv,
  combineSalesConsumption,
  fillDailySeries,
  sumDailySeries,
  sumMonthly,
} from "./service";

describe("fillDailySeries", () => {
  const today = new Date("2026-06-10T12:00:00Z");

  it("genera N días continuos rellenando con 0", () => {
    const s = fillDailySeries([{ day: "2026-06-09", total: 500 }], 3, today);
    expect(s).toHaveLength(3);
    expect(s.map((p) => p.date)).toEqual([
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
    ]);
    expect(s[1]!.total).toBe(500);
    expect(s[0]!.total).toBe(0);
  });
});

describe("buildSalesCsv", () => {
  it("arma encabezado + filas y escapa comillas", () => {
    const csv = buildSalesCsv([
      {
        orderNumber: "HEF-1",
        status: "confirmed",
        total: "1000.00",
        createdAt: new Date("2026-06-01T00:00:00Z"),
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Pedido,Estado,Total,Fecha");
    expect(lines[1]).toContain('"HEF-1"');
    expect(lines[1]).toContain('"1000.00"');
  });
});

describe("sumDailySeries (ventas manuales al pipeline)", () => {
  it("suma tienda + manual por día y ordena", () => {
    const store = [
      { day: "2026-07-01", total: 100 },
      { day: "2026-07-03", total: 50 },
    ];
    const manual = [
      { day: "2026-07-01", total: 40 },
      { day: "2026-07-02", total: 10 },
    ];
    expect(sumDailySeries(store, manual)).toEqual([
      { day: "2026-07-01", total: 140 },
      { day: "2026-07-02", total: 10 },
      { day: "2026-07-03", total: 50 },
    ]);
  });

  it("con una serie vacía devuelve la otra", () => {
    const a = [{ day: "2026-07-01", total: 5 }];
    expect(sumDailySeries(a, [])).toEqual(a);
    expect(sumDailySeries([], a)).toEqual(a);
  });
});

describe("sumMonthly", () => {
  it("suma posición a posición y siempre devuelve 12 meses", () => {
    const a = Array(12).fill(1) as number[];
    const b = Array(12).fill(2) as number[];
    expect(sumMonthly(a, b)).toEqual(Array(12).fill(3));
    expect(sumMonthly([], a)).toEqual(Array(12).fill(1));
  });
});

describe("combineSalesConsumption (costo de filamento)", () => {
  it("multiplica gramos por costo/kg del material (en $ por gramo)", () => {
    const rows = combineSalesConsumption(
      [
        { material: "PLA", grams: 500 },
        { material: "PETG", grams: 200 },
      ],
      [
        { material: "PLA", costPerKg: 20000 },
        { material: "PETG", costPerKg: 30000 },
      ],
    );
    expect(rows).toEqual([
      {
        material: "PLA",
        color: null,
        grams: 500,
        cost: 10000,
        source: "ventas",
      },
      {
        material: "PETG",
        color: null,
        grams: 200,
        cost: 6000,
        source: "ventas",
      },
    ]);
  });

  it("material sin costo cargado → costo 0 (nunca revienta)", () => {
    const rows = combineSalesConsumption([{ material: "TPU", grams: 100 }], []);
    expect(rows[0]).toMatchObject({ material: "TPU", cost: 0 });
  });

  it("descarta filas sin gramos", () => {
    expect(
      combineSalesConsumption([{ material: "PLA", grams: 0 }], []),
    ).toEqual([]);
  });

  // Diseño 2026-07: el consumo por ventas ahora sale del ledger real, que
  // trae color; se muestra tal cual (antes era un estimado sin color).
  it("conserva el color del ledger cuando viene", () => {
    const rows = combineSalesConsumption(
      [{ material: "PLA", color: "Rojo", grams: 240 }],
      [{ material: "PLA", costPerKg: 20000 }],
    );
    expect(rows[0]).toEqual({
      material: "PLA",
      color: "Rojo",
      grams: 240,
      cost: 4800,
      source: "ventas",
    });
  });
});
