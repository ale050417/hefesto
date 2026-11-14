import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { listMovements } from "@/features/inventory/queries";

/**
 * GET /api/v1/admin/filaments/movements — historial del ledger de filamento
 * (app móvil, 2026-10-31): ventas, fallas, ajustes y reposiciones, del más
 * nuevo al más viejo. Permiso filamentos/ver.
 * Query: filamentId (opcional, un solo carrete), limit (1-200, default 50).
 */
export const dynamic = "force-dynamic";

const querySchema = z.object({
  filamentId: z.uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const GET = withApi(
  "admin/filaments/movements",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "filamentos", "ver");
    if ("response" in auth) return auth.response;

    const parsed = querySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success) return apiError("invalid", "Filtros inválidos.");

    const items = await listMovements(parsed.data);
    return apiOk({ items });
  },
);
