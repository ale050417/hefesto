import { revalidatePath } from "next/cache";
import { recordAudit } from "@/core/audit";
import { inviteTeamMember, resendTeamInvite } from "./service";

/**
 * Invitar / reenviar invitación al equipo CON sus efectos (2026-10-31, app
 * móvil). Antes vivía inline en las Server Actions; se extrajo para que la web
 * y la API de la app (`/api/v1/admin/configuracion/equipo`) hagan EXACTAMENTE
 * lo mismo: alta/promoción + correo + auditoría + revalidación.
 *
 * La AUTORIZACIÓN (solo administradores) la valida cada caller antes de llamar
 * acá; esta función asume que ya pasó.
 */

export type InviteInput = {
  fullName?: string;
  email: string;
  roleId: string;
  message?: string;
};

export async function inviteMemberAudited(
  actorId: string,
  input: InviteInput,
): Promise<{ email: string; promoted: boolean }> {
  const result = await inviteTeamMember({
    email: input.email,
    roleId: input.roleId,
    fullName:
      input.fullName && input.fullName.length > 0 ? input.fullName : null,
    message: input.message && input.message.length > 0 ? input.message : null,
  });
  await recordAudit({
    actorId,
    action: result.promoted ? "team.member_promoted" : "team.member_invited",
    entityType: "team",
    entityId: result.email,
    metadata: { roleId: input.roleId },
  });
  revalidatePath("/admin/configuracion");
  return result;
}

export async function resendInviteAudited(
  actorId: string,
  userId: string,
): Promise<{ email: string }> {
  const result = await resendTeamInvite(userId);
  await recordAudit({
    actorId,
    action: "team.invite_resent",
    entityType: "team",
    entityId: result.email,
    metadata: {},
  });
  revalidatePath("/admin/configuracion");
  return result;
}
