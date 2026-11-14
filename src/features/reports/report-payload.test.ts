import { describe, expect, it } from "vitest";
import {
  buildReportsPayload,
  reportYears,
  resolveRangeDays,
  resolveReportYear,
  summarizeDaily,
  yearOverYear,
  type ReportsOverviewInput,
} from "./report-payload";

const NOW = new Date(2026, 9, 31); // 31/oct/2026 (mes 10)

describe("resolveReportYear", () => {
  it("sin valor → año actual", () => {
    expect(resolveReportYear(undefined, NOW)).toBe(2026);
    expect(resolveReportYear("", NOW)).toBe(2026);
    expect(resolveReportYear(null, NOW)).toBe(2026);
  });
  it("acepta el actual y los dos anteriores", () => {
    expect(reportYears(NOW)).toEqual([2026, 2025, 2024]);
    expect(resolveReportYear("2025", NOW)).toBe(2025);
    expect(resolveReportYear("2024", NOW)).toBe(2024);
  });
  it("rechaza lo que no es un año elegible", () => {
    expect(resolveReportYear("2027", NOW)).toBeNull();
    expect(resolveReportYear("1999", NOW)).toBeNull();
    expect(resolveReportYear("2025.5", NOW)).toBeNull();
    expect(resolveReportYear("abc", NOW)).toBeNull();
  });
});

describe("resolveRangeDays", () => {
  it("default 30 y solo 7/30/90", () => {
    expect(resolveRangeDays(undefined)).toBe(30);
    expect(resolveRangeDays("7")).toBe(7);
    expect(resolveRangeDays("90")).toBe(90);
    expect(resolveRangeDays("15")).toBeNull();
    expect(resolveRangeDays("-1")).toBeNull();
    expect(resolveRangeDays("x")).toBeNull();
  });
});

describe("yearOverYear", () => {
  const cur = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 0, 0];
  const prev = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 500, 500];

  it("el año en curso se compara contra el MISMO tramo del anterior", () => {
    const r = yearOverYear(cur, prev, 2026, NOW);
    expect(r.asOfMonth).toBe(10);
    expect(r.current).toBe(1000);
    expect(r.prevSamePeriod).toBe(500); // sin nov/dic del anterior
    expect(r.deltaPct).toBe(100);
  });

  it("un año cerrado se compara completo", () => {
    const r = yearOverYear(prev, cur, 2025, NOW);
    expect(r.asOfMonth).toBe(12);
    expect(r.current).toBe(1500);
    expect(r.prevSamePeriod).toBe(1000);
    expect(r.deltaPct).toBe(50);
  });

  it("sin base anterior no inventa un porcentaje", () => {
    expect(yearOverYear(cur, Array(12).fill(0), 2026, NOW).deltaPct).toBeNull();
  });

  it("tolera arrays cortos o con basura", () => {
    const r = yearOverYear([10, Number.NaN as number], [], 2025, NOW);
    expect(r.current).toBe(10);
    expect(r.deltaPct).toBeNull();
  });
});

describe("buildReportsPayload", () => {
  const overview: ReportsOverviewInput = {
    year: 2026,
    prevYear: 2025,
    kpis: { revenue: 1000, salesCount: 3, unitsSold: 7, newCustomers: 2 },
    monthsCurrent: [10, 20, 30],
    monthsPrev: [5],
    categoryBreakdown: [{ name: "Mates", revenue: 600 }],
    topProducts: [{ name: "Mate Mario", qty: 4, revenue: 500 }],
    bySource: {
      storefront: { revenue: 750, count: 2 },
      manual: { revenue: 250, count: 1 },
    },
    consumption: [
      {
        material: "PLA",
        color: "Rojo",
        grams: 200,
        cost: 4000,
        source: "ventas",
      },
      {
        material: "PLA",
        color: "Negro",
        grams: 50,
        cost: 1000,
        source: "fallas",
      },
    ],
  };

  it("calcula ticket promedio (entero) y completa los 12 meses", () => {
    const p = buildReportsPayload(overview, NOW);
    expect(p.kpis.avgTicket).toBe(333); // 1000 / 3 redondeado
    expect(p.monthsCurrent).toHaveLength(12);
    expect(p.monthsCurrent.slice(0, 4)).toEqual([10, 20, 30, 0]);
    expect(p.monthsPrev).toHaveLength(12);
    expect(p.years).toEqual([2026, 2025, 2024]);
  });

  it("reparte el porcentaje por origen sobre el total", () => {
    const p = buildReportsPayload(overview, NOW);
    expect(p.bySource.storefront.pct).toBe(75);
    expect(p.bySource.manual.pct).toBe(25);
  });

  it("sin ventas no divide por cero", () => {
    const p = buildReportsPayload(
      {
        ...overview,
        kpis: { revenue: 0, salesCount: 0, unitsSold: 0, newCustomers: 0 },
        bySource: {
          storefront: { revenue: 0, count: 0 },
          manual: { revenue: 0, count: 0 },
        },
      },
      NOW,
    );
    expect(p.kpis.avgTicket).toBe(0);
    expect(p.bySource.storefront.pct).toBe(0);
  });

  it("suma el consumo de filamento", () => {
    const p = buildReportsPayload(overview, NOW);
    expect(p.consumptionTotals).toEqual({ grams: 250, cost: 5000 });
  });
});

describe("summarizeDaily", () => {
  it("total, promedio y mejor día", () => {
    const s = summarizeDaily([
      { date: "2026-10-29", total: 0 },
      { date: "2026-10-30", total: 300 },
      { date: "2026-10-31", total: 100 },
    ]);
    expect(s.total).toBe(400);
    expect(s.average).toBeCloseTo(133.33, 1);
    expect(s.best).toEqual({ date: "2026-10-30", total: 300 });
  });
  it("sin ventas no hay mejor día", () => {
    expect(summarizeDaily([{ date: "2026-10-31", total: 0 }]).best).toBeNull();
    expect(summarizeDaily([]).average).toBe(0);
  });
});
