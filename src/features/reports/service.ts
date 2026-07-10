import { unstable_cache } from "next/cache";
import { listFilamentsView } from "@/features/inventory/queries";
import { listOrdersAdmin } from "@/features/orders/services/orderAdminService";
import * as repo from "./repository";

export type RevenuePoint = { date: string; total: number };

/** Rellena los días faltantes con 0 para una serie continua de `days` días. */
export function fillDailySeries(
  rows: Array<{ day: string; total: number }>,
  days: number,
  today: Date = new Date(),
): RevenuePoint[] {
  const map = new Map(rows.map((r) => [r.day, Number(r.total)]));
  const out: RevenuePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, total: map.get(key) ?? 0 });
  }
  return out;
}

/**
 * Suma dos series diarias {day,total} (tienda + manual). Pura y testeable:
 * así una venta manual impacta la curva exactamente igual que una de tienda.
 */
export function sumDailySeries(
  a: Array<{ day: string; total: number }>,
  b: Array<{ day: string; total: number }>,
): Array<{ day: string; total: number }> {
  const map = new Map<string, number>();
  for (const r of a) map.set(r.day, (map.get(r.day) ?? 0) + Number(r.total));
  for (const r of b) map.set(r.day, (map.get(r.day) ?? 0) + Number(r.total));
  return [...map.entries()]
    .map(([day, total]) => ({ day, total }))
    .sort((x, y) => (x.day < y.day ? -1 : 1));
}

/** Suma dos arrays de 12 meses, posición a posición. */
export function sumMonthly(a: number[], b: number[]): number[] {
  return Array.from({ length: 12 }, (_v, i) => (a[i] ?? 0) + (b[i] ?? 0));
}

export type ConsumptionRow = {
  material: string;
  color: string | null;
  grams: number;
  cost: number;
  source: "fallas" | "ventas";
};

/**
 * Combina el consumo REAL por ventas (gramos netos del ledger de filamento,
 * por material y color) con el costo promedio por kg de ese material. Pura y
 * testeable (toca dinero).
 */
export function combineSalesConsumption(
  grams: Array<{ material: string; color?: string | null; grams: number }>,
  costs: Array<{ material: string; costPerKg: number }>,
): ConsumptionRow[] {
  const costMap = new Map(costs.map((c) => [c.material, c.costPerKg]));
  return grams
    .filter((g) => g.grams > 0)
    .map((g) => ({
      material: g.material,
      color: g.color ?? null,
      grams: Number(g.grams),
      // pesos = gramos × (costo/kg ÷ 1000), redondeado a 2 decimales
      cost:
        Math.round((Number(g.grams) * (costMap.get(g.material) ?? 0)) / 10) /
        100,
      source: "ventas" as const,
    }));
}

/** CSV de ventas (función pura, testeable). */
export function buildSalesCsv(
  rows: Array<{
    orderNumber: string;
    status: string;
    total: string | number;
    createdAt: Date;
  }>,
): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ["Pedido", "Estado", "Total", "Fecha"].join(",");
  const lines = rows.map((r) =>
    [
      esc(r.orderNumber),
      esc(r.status),
      esc(String(r.total)),
      esc(new Date(r.createdAt).toISOString()),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export async function getDashboardData(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const [kpis, manualKpis, revenueRows, manualRows, recent, filaments] =
    await Promise.all([
      repo.getKpiRows(),
      repo.getManualKpis(),
      repo.getRevenueByDay(since),
      repo.getManualRevenueByDay(since),
      listOrdersAdmin({ page: 1, pageSize: 6 }),
      listFilamentsView(),
    ]);

  return {
    // Las ventas manuales cuentan igual que las de tienda (Fase 5).
    kpis: {
      ...kpis,
      revenue: kpis.revenue + manualKpis.revenue,
      salesCount: kpis.salesCount + manualKpis.count,
    },
    revenueSeries: fillDailySeries(
      sumDailySeries(revenueRows, manualRows),
      days,
    ),
    recentOrders: recent.items,
    lowStock: filaments.filter((f) => f.lowStock),
  };
}

export async function getReportsData(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const [revenueRows, manualRows, topProducts, categoryBreakdown] =
    await Promise.all([
      repo.getRevenueByDay(since),
      repo.getManualRevenueByDay(since),
      repo.getTopProducts(8),
      repo.getCategoryBreakdown(),
    ]);

  return {
    revenueSeries: fillDailySeries(
      sumDailySeries(revenueRows, manualRows),
      days,
    ),
    topProducts,
    categoryBreakdown,
  };
}

export async function getSalesCsv(from: Date, to: Date): Promise<string> {
  const rows = await repo.getSalesForCsv(from, to);
  return buildSalesCsv(rows);
}

/** Datos del panel de Reportes (espejo del index): KPIs + series + breakdown. */
const getReportsOverviewRaw = async (year: number) => {
  const prevYear = year - 1;
  const [
    kpis,
    manualKpis,
    monthsCurrent,
    manualMonths,
    monthsPrev,
    manualMonthsPrev,
    categoryBreakdown,
    topProducts,
    bySource,
    failureConsumption,
    salesGrams,
    materialCosts,
  ] = await Promise.all([
    repo.getReportKpis(year),
    repo.getManualYearKpis(year),
    repo.getMonthlyRevenue(year),
    repo.getManualMonthlyRevenue(year),
    repo.getMonthlyRevenue(prevYear),
    repo.getManualMonthlyRevenue(prevYear),
    repo.getCategoryBreakdown(),
    repo.getTopProducts(6),
    repo.getRevenueBySource(year),
    repo.getFailureConsumption(year),
    repo.getLedgerSalesConsumption(year),
    repo.getAvgCostPerMaterial(),
  ]);

  const consumption: ConsumptionRow[] = [
    ...combineSalesConsumption(salesGrams, materialCosts),
    ...failureConsumption.map((f) => ({
      material: f.material,
      color: f.color,
      grams: Number(f.grams),
      cost: Number(f.cost),
      source: "fallas" as const,
    })),
  ];

  return {
    year,
    prevYear,
    // Ventas manuales integradas al mismo pipeline que la tienda (Fase 5).
    kpis: {
      ...kpis,
      revenue: kpis.revenue + manualKpis.revenue,
      salesCount: kpis.salesCount + manualKpis.count,
      unitsSold: kpis.unitsSold + manualKpis.units,
    },
    monthsCurrent: sumMonthly(monthsCurrent, manualMonths),
    monthsPrev: sumMonthly(monthsPrev, manualMonthsPrev),
    categoryBreakdown,
    topProducts,
    bySource,
    consumption,
  };
};

// Cache de 60s: Reportes es una pantalla de análisis, no necesita ser al
// segundo. El dato queda a lo sumo 60s viejo y se re-consulta solo, sin pegarle
// a la base en cada visita. (Solo pantallas de análisis; NUNCA las de cargar/
// editar donde esperás verlo al instante.)
export const getReportsOverview = unstable_cache(
  getReportsOverviewRaw,
  ["reports:overview"],
  { revalidate: 60 },
);
