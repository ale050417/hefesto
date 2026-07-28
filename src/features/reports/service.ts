import { unstable_cache } from "next/cache";
import {
  listColorCatalog,
  listFilamentsView,
} from "@/features/inventory/queries";
import { listOrdersAdmin } from "@/features/orders/services/orderAdminService";
import { safeLoad } from "@/lib/safe-load";
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
/** Combina la facturacion por categoria de tienda + manuales (suma por nombre,
 * ordena desc). Pura y testeable: una venta manual pesa igual que una de tienda. */
export function combineCategoryBreakdown(
  online: Array<{ name: string; revenue: number }>,
  manual: Array<{ name: string; revenue: number }>,
): Array<{ name: string; revenue: number }> {
  const map = new Map<string, number>();
  for (const r of [...online, ...manual]) {
    map.set(r.name, (map.get(r.name) ?? 0) + r.revenue);
  }
  return [...map.entries()]
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue);
}

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

async function getDashboardDataUncached(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  // Resiliente: si UNA métrica falla o se cuelga (lock / pool sin conexiones),
  // el panel NO se cae entero: esa fuente usa un default, se loguea cuál falló
  // y queda registrada en `degraded` para que la UI muestre un aviso de datos
  // parciales (DegradedNotice) en vez de ceros silenciosos que parecen "no
  // vendiste nada" (incidente 2026-07-11). safeLoad acota cada fuente a 6 s.
  // Consumo del MES actual para "Filamentos más usados" (widget del panel).
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const nextMonth = new Date(monthStart);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const [
    kpisR,
    manualKpisR,
    revenueR,
    manualRevR,
    recentR,
    filamentsR,
    monthUsageR,
    colorsR,
  ] = await Promise.all([
    safeLoad("kpis", repo.getKpiRows(), {
      revenue: 0,
      salesCount: 0,
      pendingCount: 0,
      lowStockCount: 0,
    }),
    safeLoad("manualKpis", repo.getManualKpis(), { revenue: 0, count: 0 }),
    safeLoad("revenueByDay", repo.getRevenueByDay(since), []),
    safeLoad("manualRevenueByDay", repo.getManualRevenueByDay(since), []),
    safeLoad(
      "recentOrders",
      listOrdersAdmin({ page: 1, pageSize: 6 }).then((r) => r.items),
      [] as Awaited<ReturnType<typeof listOrdersAdmin>>["items"],
    ),
    safeLoad("filaments", listFilamentsView(), []),
    safeLoad(
      "monthUsage",
      repo.getLedgerSalesConsumptionRange(monthStart, nextMonth),
      [],
    ),
    safeLoad("colorCatalog", listColorCatalog(), []),
  ]);
  const kpis = kpisR.value;
  const manualKpis = manualKpisR.value;
  const revenueRows = revenueR.value;
  const manualRows = manualRevR.value;
  const recentItems = recentR.value;
  const filaments = filamentsR.value;
  const degraded: string[] = [];
  if (!kpisR.ok) degraded.push("los KPIs");
  if (!manualKpisR.ok) degraded.push("las ventas manuales");
  if (!revenueR.ok || !manualRevR.ok) degraded.push("los ingresos por día");
  if (!recentR.ok) degraded.push("los últimos pedidos");
  if (!filamentsR.ok) degraded.push("el stock de filamentos");
  if (!monthUsageR.ok) degraded.push("el consumo del mes");

  // "Filamentos más usados" del mes: TODOS los filamentos cargados (Ale quiere
  // ver también los que no se usaron) + los gramos consumidos del ledger + el
  // tono real del color (catálogo). Ordenado del más usado al menos.
  const hexByColor = new Map(
    colorsR.value
      .filter((c) => c.hex)
      .map((c) => [c.name.trim().toLowerCase(), c.hex as string]),
  );
  const usageMap = new Map(
    monthUsageR.value.map((u) => [
      `${u.material.trim().toLowerCase()}·${u.color.trim().toLowerCase()}`,
      Number(u.grams) || 0,
    ]),
  );
  const filamentUsage = filaments
    .map((f) => {
      const key = `${f.material.trim().toLowerCase()}·${f.color.trim().toLowerCase()}`;
      const grams = usageMap.get(key) ?? 0;
      usageMap.delete(key);
      return {
        material: f.material,
        color: f.color,
        hex: hexByColor.get(f.color.trim().toLowerCase()) ?? null,
        grams,
      };
    })
    // Consumo de filamentos que ya no existen en inventario: también se ve.
    .concat(
      monthUsageR.value
        .filter((u) =>
          usageMap.has(
            `${u.material.trim().toLowerCase()}·${u.color.trim().toLowerCase()}`,
          ),
        )
        .map((u) => ({
          material: u.material,
          color: u.color,
          hex: hexByColor.get(u.color.trim().toLowerCase()) ?? null,
          grams: Number(u.grams) || 0,
        })),
    )
    .sort((a, b) => b.grams - a.grams);

  return {
    filamentUsage,
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
    recentOrders: recentItems,
    // Con el tono real del color para la barra de la alerta (widget gráfico).
    lowStock: filaments
      .filter((f) => f.lowStock)
      .map((f) => ({
        ...f,
        hex: hexByColor.get(f.color.trim().toLowerCase()) ?? null,
      })),
    degraded,
  };
}

// Cacheado 30 s: el panel dispara ~9 queries por carga y era force-dynamic, así
// que golpeaba la DB en CADA visita y, bajo carga, era la primera página en
// agotar el pooler. Con cache la mayoría de las cargas no tocan la base.
export const getDashboardData = unstable_cache(
  getDashboardDataUncached,
  ["dashboard-data"],
  { revalidate: 30 },
);

/** Consumo por filamento de UN mes (selector del panel, 2026-07-24). Devuelve
 * solo lo consumido (los sin uso no se muestran) con el hex del color. Al
 * cambiar de mes, el mes nuevo arranca limpio solo (el rango lo define la
 * clave "YYYY-MM"). */
const getMonthFilamentUsageRaw = async (monthKey: string) => {
  const [y, m] = monthKey.split("-").map(Number);
  const year = y && y > 2000 ? y : new Date().getFullYear();
  const month = m && m >= 1 && m <= 12 ? m : new Date().getMonth() + 1;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const [usage, colors] = await Promise.all([
    repo.getLedgerSalesConsumptionRange(start, end).catch(() => []),
    listColorCatalog().catch(() => []),
  ]);
  const hexByColor = new Map(
    colors
      .filter((c) => c.hex)
      .map((c) => [c.name.trim().toLowerCase(), c.hex as string]),
  );
  return usage.map((u) => ({
    material: u.material,
    color: u.color,
    hex: hexByColor.get(u.color.trim().toLowerCase()) ?? null,
    grams: Number(u.grams) || 0,
  }));
};

export const getMonthFilamentUsage = unstable_cache(
  getMonthFilamentUsageRaw,
  ["month-filament-usage"],
  { revalidate: 60 },
);

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
    manualCategoryBreakdown,
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
    repo.getManualCategoryBreakdown(),
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
    categoryBreakdown: combineCategoryBreakdown(
      categoryBreakdown,
      manualCategoryBreakdown,
    ),
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
