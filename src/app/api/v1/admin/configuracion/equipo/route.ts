import { apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { loadTeamSnapshot } from "@/features/settings/api-load";
import {
  businessErrorResponse,
  readBody,
  requireTeamAdmin,
} from "@/features/settings/api-helpers";
import { inviteSchema } from "@/features/settings/schemas";
import { inviteMemberAudited } from "@/features/settings/team-flow";

/**
 * GET  /api/v1/admin/configuracion/equipo — el equipo (personas con acceso al
 *      panel, su rol y si ya aceptaron la invitación), los roles con su matriz
 *      de permisos y la lista de módulos. Permiso config/ver (como la web).
 *      `canManage` dice si quien consulta es administrador.
 * POST /api/v1/admin/configuracion/equipo — invita a alguien al equipo
 *      { email, roleId, fullName?, message? }. SOLO administradores. Manda el
 *      correo con el link de un solo uso, o promueve a un cliente existente, y
 *      deja el evento en la auditoría (igual que `inviteTeamMemberAction`).
 */
export const dynamic = "force-dynamic";

export const GET = withApi(
  "admin/configuracion/equipo",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "config", "ver");
    if ("response" in auth) return auth.response;
    return apiOk(await loadTeamSnapshot(auth.user));
  },
);

export const POST = withApi(
  "admin/configuracion/equipo/invitar",
  async (request: Request) => {
    const auth = await requireTeamAdmin(
      request,
      "Solo un administrador puede invitar.",
    );
    if ("response" in auth) return auth.response;

    const body = await readBody(
      request,
      inviteSchema,
      "Revisá nombre, email y rol.",
    );
    if ("response" in body) return body.response;

    try {
      const result = await inviteMemberAudited(auth.user.id, body.data);
      return apiOk({ ok: true, ...result });
    } catch (error) {
      return businessErrorResponse(error);
    }
  },
);
