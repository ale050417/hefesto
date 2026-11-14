import { apiOk, requireApiStaff, withApi } from "@/core/api/respond";
import { getDashboardData } from "@/features/reports/service";

/**
 * GET /api/v1/admin/dashboard — resumen del inicio del panel (app móvil,
 * 2026-10-31): ventas de los últimos 30 días con su curva, estados, últimos
 * pedidos y filamentos con stock bajo. Es la MISMA fuente que /admin (cacheada
 * 30 s). Como el inicio web, lo ve cualquier staff.
 */
export const dynamic = "force-dynamic";

export const GET = withApi("admin/dashboard", async (request: Request) => {
  const auth = await requireApiStaff(request);
  if ("response" in auth) return auth.response;

  const data = await getDashboardData(30);
  const sc = data.statusCounts as Record<string, number>;
  const series = data.revenueSeries;

  return apiOk({
    greetingName: auth.user.profile?.fullName?.trim().split(/\s+/)[0] ?? null,
    kpis: data.kpis,
    revenueSeries: series,
    last7: series.slice(-7).reduce((acc, p) => acc + p.total, 0),
    last30: series.reduce((acc, p) => acc + p.total, 0),
    counts: {
      pendingPayment: sc.pending_payment ?? 0,
      inProduction: (sc.confirmed ?? 0) + (sc.in_production ?? 0),
      ready: sc.ready ?? 0,
    },
    statusCounts: sc,
    recentOrders: data.recentOrders,
    lowStock: data.lowStock,
    degraded: data.degraded,
  });
});
