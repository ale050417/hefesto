import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import {
  buildReportsPayload,
  resolveReportYear,
} from "@/features/reports/report-payload";
import { getReportsOverview } from "@/features/reports/service";

/**
 * GET /api/v1/admin/reportes?year=YYYY — Reportes del año para la app
 * (2026-10-31). Permiso reportes/ver (igual que /admin/reportes). Es la MISMA
 * fuente que la web (`getReportsOverview`, cacheada 60 s): KPIs del año,
 * ingresos por mes contra el año anterior, por categoría, top productos, por
 * origen y consumo de filamento. Categoría y top productos son acumulado
 * histórico (así los arma la web), no del año.
 */
export const dynamic = "force-dynamic";

export const GET = withApi("admin/reportes", async (request: Request) => {
  const auth = await requireApiPerm(request, "reportes", "ver");
  if ("response" in auth) return auth.response;

  const year = resolveReportYear(new URL(request.url).searchParams.get("year"));
  if (year == null) return apiError("invalid", "Año inválido.");

  const overview = await getReportsOverview(year);
  return apiOk(buildReportsPayload(overview));
});
