// Armado puro del payload de Reportes para la app móvil (2026-10-31, pedido de
// Ale). Toma lo que ya devuelve `getReportsOverview` (la MISMA fuente que
// /admin/reportes) y le suma lo que la web calcula en el componente (ticket
// promedio, % por origen) para que la app no reimplemente nada. Sin I/O:
// testeable.

import type { ConsumptionRow } from "./service";

/** Rangos de la serie diaria que ofrece la app. */
export const REPORT_RANGE_DAYS = [7, 30, 90] as const;

/** Años elegibles: el actual y los dos anteriores (la web ofrece dos). */
export function reportYears(now: Date = new Date()): number[] {
  const y = now.getFullYear();
  return [y, y - 1, y - 2];
}

/**
 * Año pedido por query. Sin valor → el actual. Valor que no sea uno de los
 * elegibles → null (el endpoint responde 422 en vez de consultar a ciegas).
 */
export function resolveReportYear(
  raw: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (raw == null || raw.trim() === "") return now.getFullYear();
  const n = Number(raw);
  return Number.isInteger(n) && reportYears(now).includes(n) ? n : null;
}

/** Días de la serie diaria: 7 · 30 · 90 (default 30). Otro valor → null. */
export function resolveRangeDays(
  raw: string | null | undefined,
): number | null {
  if (raw == null || raw.trim() === "") return 30;
  const n = Number(raw);
  return (REPORT_RANGE_DAYS as readonly number[]).includes(n) ? n : null;
}

type Money = { revenue: number; count: number };

export type ReportsOverviewInput = {
  year: number;
  prevYear: number;
  kpis: {
    revenue: number;
    salesCount: number;
    unitsSold: number;
    newCustomers: number;
  };
  monthsCurrent: number[];
  monthsPrev: number[];
  categoryBreakdown: Array<{ name: string; revenue: number }>;
  topProducts: Array<{ name: string; qty: number; revenue: number }>;
  bySource: { storefront: Money; manual: Money };
  consumption: ConsumptionRow[];
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const twelve = (a: number[]): number[] =>
  Array.from({ length: 12 }, (_v, i) => num(a[i]));
const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);
const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Variación % contra el año anterior. Si el año es el actual se compara contra
 * el MISMO tramo (enero..mes en curso) del anterior: comparar 10 meses contra
 * 12 daría siempre "−17%" y no dice nada. Sin base (anterior = 0) → null.
 */
export function yearOverYear(
  current: number[],
  prev: number[],
  year: number,
  now: Date = new Date(),
): {
  asOfMonth: number;
  current: number;
  prevSamePeriod: number;
  deltaPct: number | null;
} {
  const asOfMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
  const cur = twelve(current);
  const pre = twelve(prev);
  const curSum = sum(cur.slice(0, asOfMonth));
  const preSum = sum(pre.slice(0, asOfMonth));
  return {
    asOfMonth,
    current: curSum,
    prevSamePeriod: preSum,
    deltaPct: preSum > 0 ? round1(((curSum - preSum) / preSum) * 100) : null,
  };
}

export function buildReportsPayload(
  o: ReportsOverviewInput,
  now: Date = new Date(),
) {
  const revenue = num(o.kpis.revenue);
  const salesCount = num(o.kpis.salesCount);
  const monthsCurrent = twelve(o.monthsCurrent);
  const monthsPrev = twelve(o.monthsPrev);

  const store = num(o.bySource.storefront.revenue);
  const manual = num(o.bySource.manual.revenue);
  const sourceTotal = store + manual;
  const pct = (v: number) =>
    sourceTotal > 0 ? Math.round((v / sourceTotal) * 100) : 0;

  const consumption = o.consumption.map((c) => ({
    material: c.material,
    color: c.color,
    grams: num(c.grams),
    cost: num(c.cost),
    source: c.source,
  }));

  return {
    year: o.year,
    prevYear: o.prevYear,
    years: reportYears(now),
    kpis: {
      revenue,
      salesCount,
      unitsSold: num(o.kpis.unitsSold),
      newCustomers: num(o.kpis.newCustomers),
      // Mismo redondeo que la web: facturación ÷ ventas, a peso entero.
      avgTicket: salesCount > 0 ? Math.round(revenue / salesCount) : 0,
    },
    monthsCurrent,
    monthsPrev,
    yoy: yearOverYear(monthsCurrent, monthsPrev, o.year, now),
    // Estos dos NO dependen del año: son el acumulado histórico (como la web).
    categoryBreakdown: o.categoryBreakdown.map((c) => ({
      name: c.name,
      revenue: num(c.revenue),
    })),
    topProducts: o.topProducts.map((p) => ({
      name: p.name,
      qty: num(p.qty),
      revenue: num(p.revenue),
    })),
    bySource: {
      storefront: {
        revenue: store,
        count: num(o.bySource.storefront.count),
        pct: pct(store),
      },
      manual: {
        revenue: manual,
        count: num(o.bySource.manual.count),
        pct: pct(manual),
      },
    },
    consumption,
    consumptionTotals: {
      grams: consumption.reduce((a, c) => a + c.grams, 0),
      cost: consumption.reduce((a, c) => a + c.cost, 0),
    },
  };
}

/** Resumen de una serie diaria (mejor día, promedio) para la tarjeta de la app. */
export function summarizeDaily(points: Array<{ date: string; total: number }>) {
  const total = points.reduce((a, p) => a + num(p.total), 0);
  let best: { date: string; total: number } | null = null;
  for (const p of points) {
    if (p.total > 0 && (best == null || p.total > best.total)) {
      best = { date: p.date, total: num(p.total) };
    }
  }
  return {
    total,
    average: points.length > 0 ? total / points.length : 0,
    best,
  };
}
