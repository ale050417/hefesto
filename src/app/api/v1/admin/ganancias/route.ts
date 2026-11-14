import { apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import {
  buildEarningsPayload,
  parseMonthParam,
} from "@/features/earnings/earnings-payload";
import { getEarningsOverview } from "@/features/earnings/service";

/**
 * GET /api/v1/admin/ganancias?mes=YYYY-MM|all — Ganancias y socios para la app
 * (2026-10-31). Permiso ganancias/ver (igual que /admin/ganancias). Es la
 * MISMA fuente que la web (`getEarningsOverview`, con las reglas de
 * `economics.ts`): ingresos cobrados, amortización, ganancia pura, reparto por
 * socio y desglose por venta. Sin `mes` devuelve el mes más nuevo con ventas.
 * El desglose se corta en 300 filas; los totales son siempre los de TODAS.
 */
export const dynamic = "force-dynamic";

export const GET = withApi("admin/ganancias", async (request: Request) => {
  const auth = await requireApiPerm(request, "ganancias", "ver");
  if ("response" in auth) return auth.response;

  const mes = parseMonthParam(new URL(request.url).searchParams.get("mes"));
  const overview = await getEarningsOverview(mes);
  return apiOk(buildEarningsPayload(overview));
});
