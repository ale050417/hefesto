import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { businessError, invalidInput } from "@/features/inventory/api-helpers";
import {
  deleteSpoolModel,
  saveSpoolModel,
} from "@/features/inventory/filament-types";
import { spoolModelSchema } from "@/features/inventory/schemas";

/**
 * /api/v1/admin/filaments/spools/:id — un modelo de carrete vacío.
 *  - PATCH  → { name, emptyGrams }. Permiso filamentos/editar.
 *  - DELETE → lo borra (los filamentos que lo usaban quedan sin modelo).
 *             Permiso filamentos/editar.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withApi(
  "admin/filaments/spools/update",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "filamentos", "editar");
    if ("response" in auth) return auth.response;
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Carrete inválido.");
    const parsed = spoolModelSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);
    try {
      const res = await saveSpoolModel(id.data, parsed.data);
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
  "admin/filaments/spools/delete",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "filamentos", "editar");
    if ("response" in auth) return auth.response;
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Carrete inválido.");
    await deleteSpoolModel(id.data);
    revalidatePath("/admin/filamentos");
    return apiOk({ ok: true });
  },
);
