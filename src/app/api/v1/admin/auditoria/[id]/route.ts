import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { getAuditEntry } from "@/core/audit/query";

/**
 * GET /api/v1/admin/auditoria/:id — un evento del registro con su detalle
 * completo (metadata). Permiso auditoria/ver.
 */
export const dynamic = "force-dynamic";

export const GET = withApi(
  "admin/auditoria/detail",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireApiPerm(request, "auditoria", "ver");
    if ("response" in auth) return auth.response;

    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) {
      return apiError("invalid", "Evento inválido.");
    }
    const entry = await getAuditEntry(id);
    if (!entry) return apiError("not_found", "No encontramos ese evento.");
    return apiOk({ entry });
  },
);
