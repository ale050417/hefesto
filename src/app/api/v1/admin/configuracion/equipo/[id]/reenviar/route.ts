import { z } from "zod";
import { apiError, apiOk, withApi } from "@/core/api/respond";
import {
  businessErrorResponse,
  requireTeamAdmin,
} from "@/features/settings/api-helpers";
import { resendInviteAudited } from "@/features/settings/team-flow";

/**
 * POST /api/v1/admin/configuracion/equipo/:id/reenviar — manda un link NUEVO de
 * un solo uso a un miembro con la invitación pendiente (el anterior deja de
 * servir). SOLO administradores; deja el evento en la auditoría (igual que
 * `resendInviteAction`).
 */
export const dynamic = "force-dynamic";

export const POST = withApi(
  "admin/configuracion/equipo/reenviar",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireTeamAdmin(
      request,
      "Solo un administrador puede regenerar el acceso.",
    );
    if ("response" in auth) return auth.response;

    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) {
      return apiError("invalid", "Datos inválidos.");
    }

    try {
      const result = await resendInviteAudited(auth.user.id, id);
      return apiOk({ ok: true, email: result.email });
    } catch (error) {
      return businessErrorResponse(error);
    }
  },
);
