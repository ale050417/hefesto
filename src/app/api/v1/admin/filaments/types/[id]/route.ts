import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { businessError, invalidInput } from "@/features/inventory/api-helpers";
import {
  deleteFilamentType,
  saveFilamentType,
} from "@/features/inventory/filament-types";
import { filamentTypeSchema } from "@/features/inventory/schemas";

/**
 * /api/v1/admin/filaments/types/:id — un tipo de filamento.
 *  - PATCH  → nombre y precio ({ name, costPerKg }). El precio nuevo baja a
 *             TODOS los carretes del tipo; responde `spools` (cuántos
 *             cambiaron). Permiso filamentos/editar.
 *  - DELETE → borra el tipo. Sus carretes quedan sin tipo y conservan el
 *             precio. Permiso filamentos/editar.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withApi(
  "admin/filaments/types/update",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "filamentos", "editar");
    if ("response" in auth) return auth.response;
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Tipo inválido.");
    const parsed = filamentTypeSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);
    try {
      const res = await saveFilamentType(id.data, parsed.data, auth.user.id);
      revalidatePath("/admin/filamentos");
      return apiOk({ ok: true, ...res });
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);

export const DELETE = withApi(
  "admin/filaments/types/delete",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "filamentos", "editar");
    if ("response" in auth) return auth.response;
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Tipo inválido.");
    await deleteFilamentType(id.data);
    revalidatePath("/admin/filamentos");
    return apiOk({ ok: true });
  },
);
