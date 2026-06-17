import { createClient } from "@/core/supabase/server";
import { getProfileById } from "@/features/auth/repository";
import type { Profile } from "@/features/auth/types";

export type CurrentUser = {
  id: string;
  email: string | null;
  profile: Profile | null;
};

/** Usuario autenticado (verificado contra Supabase) + su perfil/rol, o null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
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
}

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
  return user;
}

/** True si el usuario actual es staff (admin/operador). Para guards en actions. */
export async function isStaff(): Promise<boolean> {
  const user = await getCurrentUser();
  const role = user?.profile?.role;
  return role === "admin" || role === "operator";
}
