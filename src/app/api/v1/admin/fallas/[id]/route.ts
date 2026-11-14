import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { businessError, invalidInput } from "@/features/inventory/api-helpers";
import { deleteFailureFlow } from "@/features/inventory/failure-flow";
import { getFailure, updateFailure } from "@/features/inventory/queries";
import { failureSchema } from "@/features/inventory/schemas";

/**
 * /api/v1/admin/fallas/:id — una falla (app móvil, 2026-10-31).
 *  - PATCH  → corrige pieza, material, color, gramos, causa y notas. Permiso
 *             fallas/editar (igual que `updateFailureAction`). NO toca el
 *             stock: solo cambia el registro, como en la web.
 *  - DELETE → elimina la falla y DEVUELVE al stock los gramos que había
 *             descontado. Permiso fallas/eliminar (igual que
 *             `deleteFailureAction`). Responde `{ restored }` en gramos.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withApi(
  "admin/fallas/update",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "fallas", "editar");
    if ("response" in auth) return auth.response;

    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Falla inválida.");

    const parsed = failureSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    if (!(await getFailure(id.data))) {
      return apiError("not_found", "No encontramos la falla.");
    }
    try {
      await updateFailure(id.data, parsed.data);
      revalidatePath("/admin/fallas");
      return apiOk({ ok: true });
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);

export const DELETE = withApi(
  "admin/fallas/delete",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "fallas", "eliminar");
    if ("response" in auth) return auth.response;

    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Falla inválida.");

    try {
      const { restored } = await deleteFailureFlow(id.data, auth.user.id);
      return apiOk({ ok: true, restored });
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
