import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiError, apiOk, withApi } from "@/core/api/respond";
import {
  businessErrorResponse,
  readBody,
  requireTeamAdmin,
} from "@/features/settings/api-helpers";
import { rolAsignarSchema } from "@/features/settings/api-schemas";
import {
  assignMemberRole,
  removeTeamMember,
} from "@/features/settings/service";

/**
 * PATCH  /api/v1/admin/configuracion/equipo/:id { roleId } — cambia el rol de
 *        un miembro. SOLO administradores. No tu propio rol ni dejar el panel
 *        sin administrador (lo valida el servicio, igual que la web).
 * DELETE /api/v1/admin/configuracion/equipo/:id — quita el acceso al panel
 *        (la cuenta queda como cliente). SOLO administradores; no a vos mismo
 *        ni al último administrador.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withApi(
  "admin/configuracion/equipo/rol",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireTeamAdmin(
      request,
      "Solo un administrador puede cambiar roles.",
    );
    if ("response" in auth) return auth.response;

    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) {
      return apiError("invalid", "Datos inválidos.");
    }
    const body = await readBody(request, rolAsignarSchema, "Datos inválidos.");
    if ("response" in body) return body.response;

    try {
      await assignMemberRole(auth.user.id, id, body.data.roleId);
      revalidatePath("/admin/configuracion");
      return apiOk({ ok: true });
    } catch (error) {
      return businessErrorResponse(error);
    }
  },
);

export const DELETE = withApi(
  "admin/configuracion/equipo/quitar",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireTeamAdmin(
      request,
      "Solo un administrador puede quitar acceso.",
    );
    if ("response" in auth) return auth.response;

    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) {
      return apiError("invalid", "Datos inválidos.");
    }

    try {
      await removeTeamMember(auth.user.id, id);
      revalidatePath("/admin/configuracion");
      return apiOk({ ok: true });
    } catch (error) {
      return businessErrorResponse(error);
    }
  },
);
