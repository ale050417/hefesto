import { describe, expect, it } from "vitest";
import { buildEarningsPayload, parseMonthParam } from "./earnings-payload";
import { MAX_SHARES, planSharesChange } from "./shares-plan";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

const current = [
  { id: A, name: "Ale", role: "Dueño", pct: "60.00" },
  { id: B, name: "Beto", role: null, pct: "40.00" },
];

describe("planSharesChange", () => {
  it("sin cambios → plan vacío", () => {
    const r = planSharesChange(current, [
      { id: A, name: "Ale", role: "Dueño", pct: 60 },
      { id: B, name: "Beto", role: "", pct: 40 },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.updates).toEqual([]);
    expect(r.plan.creates).toEqual([]);
    expect(r.plan.deletes).toEqual([]);
    expect(r.plan.total).toBe(100);
  });

  it("detecta solo los socios que cambiaron", () => {
    const r = planSharesChange(current, [
      { id: A, name: "Ale", role: "Dueño", pct: 70 },
      { id: B, name: "Beto", role: null, pct: 30 },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.updates.map((u) => [u.id, u.pct])).toEqual([
      [A, 70],
      [B, 30],
    ]);
  });

  it("alta y baja en el mismo guardado", () => {
    const r = planSharesChange(
      current,
      [
        { id: A, name: "Ale", role: "Dueño", pct: 50 },
        { name: " Caro ", role: "Diseño", pct: 50 },
      ],
      [B],
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.deletes).toEqual([B]);
    expect(r.plan.creates).toEqual([{ name: "Caro", role: "Diseño", pct: 50 }]);
    expect(r.plan.updates).toHaveLength(1);
  });

  it("rechaza si no suma 100% (misma regla que el editor web)", () => {
    const r = planSharesChange(current, [
      { id: A, name: "Ale", pct: 60 },
      { id: B, name: "Beto", pct: 60 },
    ]);
    expect(r).toEqual({
      ok: false,
      message: "El reparto tiene que sumar 100%. Ahora suma 120%.",
    });
  });

  it("tolera el redondeo de 33,33 + 33,33 + 33,34", () => {
    const r = planSharesChange(
      [],
      [
        { name: "a", pct: 33.33 },
        { name: "b", pct: 33.33 },
        { name: "c", pct: 33.34 },
      ],
    );
    expect(r.ok).toBe(true);
  });

  it("valida nombre vacío y porcentajes fuera de rango", () => {
    expect(planSharesChange([], [{ name: "  ", pct: 100 }]).ok).toBe(false);
    expect(planSharesChange([], [{ name: "a", pct: 101 }]).ok).toBe(false);
    expect(
      planSharesChange(
        [],
        [
          { name: "a", pct: -10 },
          { name: "b", pct: 110 },
        ],
      ).ok,
    ).toBe(false);
    expect(planSharesChange([], [{ name: "a", pct: "abc" }]).ok).toBe(false);
  });

  it("exige al menos un socio y respeta el máximo", () => {
    expect(planSharesChange(current, [], [A, B]).ok).toBe(false);
    const many = Array.from({ length: MAX_SHARES + 1 }, (_v, i) => ({
      name: `s${i}`,
      pct: 0,
    }));
    expect(planSharesChange([], many).ok).toBe(false);
  });

  it("un socio que la app no conocía frena el guardado (no se borra a ciegas)", () => {
    const stale = [...current, { id: C, name: "Nuevo", role: null, pct: "0" }];
    const r = planSharesChange(stale, [
      { id: A, name: "Ale", pct: 60 },
      { id: B, name: "Beto", pct: 40 },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain("cambiaron desde otro dispositivo");
  });

  it("un id que ya no existe frena el guardado", () => {
    const r = planSharesChange(
      [current[0]!],
      [
        { id: A, name: "Ale", pct: 50 },
        { id: B, name: "Beto", pct: 50 },
      ],
    );
    expect(r.ok).toBe(false);
  });

  it("no acepta ids repetidos ni quitar a un socio activo", () => {
    expect(
      planSharesChange(current, [
        { id: A, name: "Ale", pct: 50 },
        { id: A, name: "Ale", pct: 50 },
      ]).ok,
    ).toBe(false);
    expect(
      planSharesChange(
        current,
        [
          { id: A, name: "Ale", pct: 50 },
          { id: B, name: "Beto", pct: 50 },
        ],
        [B],
      ).ok,
    ).toBe(false);
  });

  it("quitar un id que ya no existe es inofensivo", () => {
    const r = planSharesChange(
      [current[0]!],
      [{ id: A, name: "Ale", role: "Dueño", pct: 100 }],
      [B],
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.deletes).toEqual([]);
  });
});

describe("parseMonthParam", () => {
  it("acepta YYYY-MM y all; el resto cae al default", () => {
    expect(parseMonthParam("2026-10")).toBe("2026-10");
    expect(parseMonthParam("all")).toBe("all");
    expect(parseMonthParam("2026-13")).toBeUndefined();
    expect(parseMonthParam("octubre")).toBeUndefined();
    expect(parseMonthParam("")).toBeUndefined();
    expect(parseMonthParam(null)).toBeUndefined();
  });
});

describe("buildEarningsPayload", () => {
  const overview = {
    settings: {
      kwhPrice: 95,
      machineWatts: 220,
      machineLifeHours: 8000,
      maintenanceCost: 320000,
    },
    shares: current,
    rows: Array.from({ length: 5 }, (_v, i) => ({
      id: `r${i}`,
      orderNumber: `HF-${i}`,
      customerName: i === 0 ? null : "Cliente",
      createdAt: new Date("2026-10-30T12:00:00Z"),
      ingreso: 1000,
      amort: 400,
      gananciaPura: 600,
      grams: 10,
      manual: i % 2 === 0,
      split: [{ name: "Ale", amount: 360 }],
    })),
    totals: { ingreso: 5000, amort: 2000, profit: 3000, grams: 50 },
    months: [{ value: "2026-10", label: "Octubre 2026" }],
    selectedMonth: "2026-10",
    payouts: [{ name: "Ale", amount: 1800 }],
  };

  it("pasa los numeric a número y calcula % de ganancia y suma de socios", () => {
    const p = buildEarningsPayload(overview);
    expect(p.shares[0]).toEqual({ id: A, name: "Ale", role: "Dueño", pct: 60 });
    expect(p.sharesTotal).toBe(100);
    expect(p.totals.profitPct).toBe(60);
    expect(p.totals.orders).toBe(5);
    expect(p.rows[0]!.createdAt).toBe("2026-10-30T12:00:00.000Z");
    expect(p.truncated).toBe(false);
  });

  it("corta el desglose pero los totales son los de todas las filas", () => {
    const p = buildEarningsPayload(overview, 2);
    expect(p.rows).toHaveLength(2);
    expect(p.rowsTotal).toBe(5);
    expect(p.truncated).toBe(true);
    expect(p.totals.profit).toBe(3000);
  });

  it("sin ingresos no divide por cero", () => {
    const p = buildEarningsPayload({
      ...overview,
      rows: [],
      totals: { ingreso: 0, amort: 0, profit: 0, grams: 0 },
    });
    expect(p.totals.profitPct).toBe(0);
  });
});
