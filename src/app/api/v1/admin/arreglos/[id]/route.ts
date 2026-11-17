import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { apiActor } from "@/core/api/upload";
import { canForUser } from "@/core/auth/permissions";
import { fixUpdateSchema } from "@/features/arreglos/schemas";
import { deleteFix, updateFix } from "@/features/arreglos/service";
import { businessError, invalidInput } from "@/features/inventory/api-helpers";

/**
 * /api/v1/admin/arreglos/:id (app móvil, 2026-11-17).
 *  - PATCH  → estado + respuesta del dueño (arreglos/editar).
 *  - DELETE → borra el arreglo y sus fotos: quien tiene arreglos/eliminar, o
 *             quien lo cargó mientras siga pendiente (lo decide el servicio).
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withApi(
  "admin/arreglos/update",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "arreglos", "editar");
    if ("response" in auth) return auth.response;
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Arreglo inválido.");
    const parsed = fixUpdateSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);
    try {
      await updateFix(id.data, parsed.data, apiActor(auth.user));
      return apiOk({ ok: true });
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);

export const DELETE = withApi(
  "admin/arreglos/delete",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "arreglos", "ver");
    if ("response" in auth) return auth.response;
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Arreglo inválido.");
    try {
      await deleteFix(
        id.data,
        apiActor(auth.user),
        await canForUser(auth.user, "arreglos", "eliminar"),
      );
      return apiOk({ ok: true });
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
