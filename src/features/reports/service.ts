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

  const [kpis, revenueRows, recent, filaments] = await Promise.all([
    repo.getKpiRows(),
    repo.getRevenueByDay(since),
    listOrdersAdmin({ page: 1, pageSize: 6 }),
    listFilamentsView(),
  ]);

  return {
    kpis,
    revenueSeries: fillDailySeries(revenueRows, days),
    recentOrders: recent.items,
    lowStock: filaments.filter((f) => f.lowStock),
  };
}

export async function getReportsData(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const [revenueRows, topProducts, categoryBreakdown] = await Promise.all([
    repo.getRevenueByDay(since),
    repo.getTopProducts(8),
    repo.getCategoryBreakdown(),
  ]);

  return {
    revenueSeries: fillDailySeries(revenueRows, days),
    topProducts,
    categoryBreakdown,
  };
}

export async function getSalesCsv(from: Date, to: Date): Promise<string> {
  const rows = await repo.getSalesForCsv(from, to);
  return buildSalesCsv(rows);
}
