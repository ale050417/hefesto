import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { apiActor } from "@/core/api/upload";
import { canForUser } from "@/core/auth/permissions";
import { deleteInquiry } from "@/features/consultas/flow";
import { businessError } from "@/features/inventory/api-helpers";

/**
 * DELETE /api/v1/admin/consultas/:id — borra la consulta y sus fotos. La
 * puede borrar quien tiene consultas/eliminar, o quien la cargó mientras
 * nadie la respondió (lo decide el flujo, igual que en la web).
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withApi(
  "admin/consultas/delete",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "consultas", "ver");
    if ("response" in auth) return auth.response;
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Consulta inválida.");
    try {
      await deleteInquiry(
        id.data,
        apiActor(auth.user),
        await canForUser(auth.user, "consultas", "eliminar"),
      );
      return apiOk({ ok: true });
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
