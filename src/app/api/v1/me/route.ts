import { apiError, apiOk, requireApiUser, withApi } from "@/core/api/respond";
import { recordAudit } from "@/core/audit";
import { isApiStaff } from "@/core/auth/api-auth";
import { getAllPermsForUser } from "@/core/auth/permissions";
import { deleteOwnAccount } from "@/features/auth/delete-account";

/**
 * GET /api/v1/me — quién es el usuario de la app y qué rol tiene (2026-10-31).
 * La app lo llama al iniciar sesión para decidir si muestra el panel admin y
 * qué módulos (`permissions`: módulo → ver/crear/editar/eliminar).
 * El rol y los permisos vienen SIEMPRE del servidor, nunca del cliente; cada
 * endpoint del admin los vuelve a verificar por su cuenta.
 */
export const dynamic = "force-dynamic";

export const GET = withApi("me", async (request: Request) => {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const staff = isApiStaff(user);
  return apiOk({
    id: user.id,
    email: user.email,
    fullName: user.profile?.fullName ?? null,
    phone: user.profile?.phone ?? null,
    role: user.profile?.role ?? "customer",
    isStaff: staff,
    mustChangePassword: user.profile?.mustChangePassword ?? false,
    permissions: staff ? await getAllPermsForUser(user) : {},
  });
});

/**
 * DELETE /api/v1/me — el dueño de la cuenta la elimina desde la app
 * (2026-11-14, requisito de App Store y Play Store). Solo borra la cuenta del
 * token que llega: no recibe ningún id. Ver `features/auth/delete-account.ts`
 * para qué se borra y qué se conserva.
 */
export const DELETE = withApi("me:delete", async (request: Request) => {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  // Sin el perfil no se sabe si es del equipo: mejor no borrar a ciegas.
  if (user.profileUnavailable) {
    return apiError(
      "unavailable",
      "No pudimos verificar tu cuenta. Probá de nuevo en unos segundos.",
    );
  }

  const result = await deleteOwnAccount({
    id: user.id,
    role: user.profile?.role ?? "customer",
  });

  if (!result.ok) {
    if (result.reason === "staff") {
      return apiError(
        "forbidden",
        "Las cuentas del equipo las da de baja un administrador desde Configuración → Equipo.",
      );
    }
    return apiError(
      "unavailable",
      "No pudimos eliminar la cuenta. Probá de nuevo en unos minutos.",
    );
  }

  // Sin datos personales: el usuario ya no existe (el actor queda en blanco).
  await recordAudit({
    actorId: null,
    action: "account.deleted",
    entityType: "customer",
    entityId: user.id,
    metadata: { ordersKept: result.mode === "orders_kept" },
  });
  return apiOk({ ok: true });
});
