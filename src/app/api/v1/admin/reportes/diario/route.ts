import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import {
  resolveRangeDays,
  summarizeDaily,
} from "@/features/reports/report-payload";
import { getRevenueSeries } from "@/features/reports/series";

/**
 * GET /api/v1/admin/reportes/diario?days=7|30|90 — ingresos por día (tienda +
 * ventas manuales) para el selector de rango de Reportes en la app
 * (2026-10-31). Permiso reportes/ver.
 */
export const dynamic = "force-dynamic";

export const GET = withApi(
  "admin/reportes/diario",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "reportes", "ver");
    if ("response" in auth) return auth.response;

    const days = resolveRangeDays(
      new URL(request.url).searchParams.get("days"),
    );
    if (days == null) return apiError("invalid", "Rango inválido.");

    const points = await getRevenueSeries(days);
    return apiOk({ days, points, ...summarizeDaily(points) });
  },
);
