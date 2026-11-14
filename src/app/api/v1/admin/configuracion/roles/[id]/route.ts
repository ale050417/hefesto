import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiError, apiOk, withApi } from "@/core/api/respond";
import {
  businessErrorResponse,
  readBody,
  requireTeamAdmin,
} from "@/features/settings/api-helpers";
import { createRoleSchema } from "@/features/settings/schemas";
import { deleteRole, updateRole } from "@/features/settings/service";

/**
 * PATCH  /api/v1/admin/configuracion/roles/:id { name, permissions } — edita un
 *        rol (el de Administrador, con acceso total, no se edita).
 * DELETE /api/v1/admin/configuracion/roles/:id — borra un rol (no los de
 *        sistema ni uno que tenga personas asignadas).
 * SOLO administradores (igual que `updateRoleAction` / `deleteRoleAction`).
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withApi(
  "admin/configuracion/roles/editar",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireTeamAdmin(
      request,
      "Solo un administrador puede editar roles.",
    );
    if ("response" in auth) return auth.response;

    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) {
      return apiError("invalid", "Datos inválidos.");
    }
    const body = await readBody(
      request,
      createRoleSchema,
      "Revisá el nombre y los permisos.",
    );
    if ("response" in body) return body.response;

    try {
      await updateRole(id, {
        name: body.data.name,
        permissions: body.data.permissions,
      });
      revalidatePath("/admin/configuracion");
      return apiOk({ ok: true });
    } catch (error) {
      return businessErrorResponse(error);
    }
  },
);

export const DELETE = withApi(
  "admin/configuracion/roles/borrar",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireTeamAdmin(
      request,
      "Solo un administrador puede borrar roles.",
    );
    if ("response" in auth) return auth.response;

    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) {
      return apiError("invalid", "Datos inválidos.");
    }

    try {
      await deleteRole(id);
      revalidatePath("/admin/configuracion");
      return apiOk({ ok: true });
    } catch (error) {
      return businessErrorResponse(error);
    }
  },
);
