import { cache } from "react";
import { createClient } from "@/core/supabase/server";
import { getProfileById, type Profile } from "./profile";

export type CurrentUser = {
  id: string;
  email: string | null;
  profile: Profile | null;
};

/**
 * Usuario autenticado (verificado contra Supabase) + su perfil/rol, o null.
 * Cacheado por request (React cache): aunque lo llamen el layout, los guards de
 * página y los permisos, se resuelve UNA sola vez por render (evita una tormenta
 * de consultas/auth que satura la conexión).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let profile: Profile | null = null;
  try {
    profile = await getProfileById(user.id);
  } catch (error) {
    // No tumbamos el sitio si falla la lectura del perfil (ej. falta migrar).
    console.error("[auth] no se pudo leer el profile:", error);
  }
  return { id: user.id, email: user.email ?? null, profile };
});

import { redirect } from "next/navigation";

/**
 * Exige usuario con rol admin u operador (autorización en servidor).
 * Si no hay sesión → login; si no es staff → home.
 */
export async function requireStaff(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar?redirect=/admin");
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
  const role = user?.profile?.role;
  return role === "admin" || role === "operator";
}

/**
 * Devuelve el usuario actual si es staff, o null. Igual que isStaff() pero
 * conserva la identidad del actor (para auditoría) sin una segunda consulta.
 */
export async function getStaffUser(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  const role = user?.profile?.role;
  return role === "admin" || role === "operator" ? user : null;
}
