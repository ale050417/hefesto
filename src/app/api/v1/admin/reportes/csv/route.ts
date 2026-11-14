import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { getSalesCsv } from "@/features/reports/service";

/**
 * GET /api/v1/admin/reportes/csv?days=N — CSV de ventas de la tienda (mismo
 * que el botón "Exportar CSV" de /admin/reportes) para copiarlo desde la app
 * (2026-10-31). Permiso reportes/ver, igual que `exportSalesCsvAction`.
 * Devuelve JSON `{ csv, rows, days }`: la app lo copia al portapapeles.
 */
export const dynamic = "force-dynamic";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(366).default(365),
});

export const GET = withApi("admin/reportes/csv", async (request: Request) => {
  const auth = await requireApiPerm(request, "reportes", "ver");
  if ("response" in auth) return auth.response;

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) return apiError("invalid", "Rango inválido.");

  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - parsed.data.days);
  const csv = await getSalesCsv(from, to);
  // Encabezado + una línea por venta.
  const rows = Math.max(0, csv.split("\n").length - 1);
  return apiOk({ csv, rows, days: parsed.data.days });
});
