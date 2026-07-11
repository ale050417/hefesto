import { cache } from "react";
import { createClient } from "@/core/supabase/server";
import { withDeadline } from "@/lib/safe-load";
import { getProfileById, type Profile } from "./profile";

export type CurrentUser = {
  id: string;
  email: string | null;
  profile: Profile | null;
  /**
   * true si la LECTURA del perfil falló (DB caída/lenta) — distinto de
   * "no tiene perfil". Los guards del admin deben tratarlo como error
   * visible, JAMÁS como "no autorizado" (bug del redirect fantasma,
   * 2026-07-11).
   */
  profileUnavailable?: boolean;
};

/**
 * Usuario autenticado (verificado contra Supabase) + su perfil/rol, o null.
 * Cacheado por request (React cache): aunque lo llamen el layout, los guards de
 * página y los permisos, se resuelve UNA sola vez por render (evita una tormenta
 * de consultas/auth que satura la conexión).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  // Verificación LOCAL del token (getClaims): valida la firma/expiración del JWT
  // sin ida y vuelta a Supabase en CADA request. El middleware ya refrescó y
  // validó la sesión contra el server, así que acá alcanza con leer los claims
  // (mucho menos latencia por navegación y por cada router.refresh()). Si por lo
  // que sea getClaims no devuelve nada, caemos a getUser() (red) para no romper.
  let id: string | null = null;
  let email: string | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims as { sub?: string; email?: string } | undefined;
    if (claims?.sub) {
      id = claims.sub;
      email = typeof claims.email === "string" ? claims.email : null;
    }
  } catch {
    // ignoramos y probamos con getUser abajo
  }
  if (!id) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    id = user.id;
    email = user.email ?? null;
  }

  let profile: Profile | null = null;
  let profileUnavailable = false;
  try {
    // Deadline: si el pool no da conexión, no colgamos el render entero.
    profile = await withDeadline(getProfileById(id), 10_000, "auth:profile");
  } catch (error) {
    // No tumbamos el sitio público si falla la lectura del perfil, pero lo
    // MARCAMOS: los guards del admin distinguen "sin perfil" de "DB caída".
    profileUnavailable = true;
    console.error("[auth] no se pudo leer el profile:", error);
  }
  return { id, email, profile, profileUnavailable };
});

/**
 * La lectura del rol falló (DB caída/lenta): error VISIBLE para el error
 * boundary del admin, con log etiquetado para diagnóstico rápido.
 */
function throwAuthUnavailable(): never {
  console.error(
    "[admin-guard] no pudimos verificar el rol: la base de datos no respondió",
  );
  throw new Error(
    "No pudimos verificar tu sesión: la base de datos no respondió. Recargá en unos segundos.",
  );
}

import { redirect } from "next/navigation";

/**
 * Exige usuario con rol admin u operador (autorización en servidor).
 * Si no hay sesión → login; si no es staff → home.
 */
export async function requireStaff(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar?redirect=/admin");
  // "No pude leer el rol" ≠ "no sos staff": error visible, no redirect mudo.
  if (user.profileUnavailable) throwAuthUnavailable();
  const role = user.profile?.role;
  if (role !== "admin" && role !== "operator") redirect("/");
  // Invitado con contraseña temporal: debe cambiarla antes de entrar al panel.
  if (user.profile?.mustChangePassword) redirect("/cuenta/cambiar-clave");
  return user;
}

/** Exige sesión (cualquier rol). Si no hay, va al login con redirect. */
export async function requireUser(
  redirectTo = "/cuenta",
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/ingresar?redirect=${encodeURIComponent(redirectTo)}`);
  return user;
}

/** True si el usuario actual es staff (admin/operador). Para guards en actions. */
export async function isStaff(): Promise<boolean> {
  const user = await getCurrentUser();
  if (user?.profileUnavailable) throwAuthUnavailable();
  const role = user?.profile?.role;
  return role === "admin" || role === "operator";
}

/**
 * Devuelve el usuario actual si es staff, o null. Igual que isStaff() pero
 * conserva la identidad del actor (para auditoría) sin una segunda consulta.
 */
export async function getStaffUser(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (user?.profileUnavailable) throwAuthUnavailable();
  const role = user?.profile?.role;
  return role === "admin" || role === "operator" ? user : null;
}
