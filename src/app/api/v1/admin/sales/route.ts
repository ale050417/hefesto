import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { listUnifiedSales } from "@/features/orders/services/unifiedSales";
import { orderStatusSchema } from "@/features/orders/schemas";

/**
 * GET /api/v1/admin/sales — ventas unificadas (online + manuales) para el
 * tablero de pedidos de la app (2026-10-31). Permiso: pedidos/ver.
 * Query: type (all|online|manual), status, q, limit (máx 200).
 */
export const dynamic = "force-dynamic";

const querySchema = z.object({
  type: z.enum(["all", "online", "manual"]).default("all"),
  status: orderStatusSchema.optional(),
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

export const GET = withApi("admin/sales", async (request: Request) => {
  const auth = await requireApiPerm(request, "pedidos", "ver");
  if ("response" in auth) return auth.response;

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) return apiError("invalid", "Filtros inválidos.");

  return apiOk(await listUnifiedSales(parsed.data));
});
