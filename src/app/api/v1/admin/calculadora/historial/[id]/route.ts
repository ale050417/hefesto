import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { deleteCalc } from "@/features/calculator/service";

/**
 * DELETE /api/v1/admin/calculadora/historial/:id — borra un cálculo del
 * historial (2026-10-31). Permiso calculadora/eliminar, igual que
 * `deleteCalcAction`.
 */
export const dynamic = "force-dynamic";

export const DELETE = withApi(
  "admin/calculadora/historial/id",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireApiPerm(request, "calculadora", "eliminar");
    if ("response" in auth) return auth.response;

    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Cálculo inválido.");

    await deleteCalc(id.data);
    revalidatePath("/admin/calculadora");
    return apiOk({ ok: true });
  },
);
