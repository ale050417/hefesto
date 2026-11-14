import { createClient } from "@supabase/supabase-js";
import { fetchWithTimeout } from "@/core/supabase/fetch-with-timeout";
import { getProfileById, type Profile } from "./profile";

/**
 * Autenticación de la API móvil (`/api/v1/*`, app Flutter).
 *
 * La web usa la sesión por cookies (core/supabase/server.ts). La app no tiene
 * cookies: se loguea contra Supabase Auth y manda su JWT en
 * `Authorization: Bearer <token>`. Acá lo validamos igual que la web
 * (getClaims = firma/expiración local; si no alcanza, getUser = red) y
 * resolvemos el perfil/rol con la MISMA tabla `profiles`, así que los permisos
 * son los mismos que en el panel web: la app nunca decide quién es admin.
 */

export type ApiUser = {
  id: string;
  email: string | null;
  profile: Profile | null;
  /** La lectura del perfil falló (DB caída): ≠ "no tiene perfil". */
  profileUnavailable: boolean;
};

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

function verifierClient() {
  // Cliente sin sesión persistente: solo sirve para verificar UN token.
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchWithTimeout() },
    },
  );
}

/** Usuario autenticado por Bearer token, o null si falta/está vencido/es inválido. */
export async function getApiUser(request: Request): Promise<ApiUser | null> {
  const token = bearerToken(request);
  if (!token) return null;

  const supabase = verifierClient();
  let id: string | null = null;
  let email: string | null = null;

  try {
    const { data } = await supabase.auth.getClaims(token);
    const claims = data?.claims as { sub?: string; email?: string } | undefined;
    if (claims?.sub) {
      id = claims.sub;
      email = typeof claims.email === "string" ? claims.email : null;
    }
  } catch {
    // probamos con getUser abajo
  }
  if (!id) {
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) return null;
      id = data.user.id;
      email = data.user.email ?? null;
    } catch {
      return null;
    }
  }

  let profile: Profile | null = null;
  let profileUnavailable = false;
  try {
    profile = await getProfileById(id);
  } catch (error) {
    profileUnavailable = true;
    console.error("[api-auth] no se pudo leer el profile:", error);
  }
  return { id, email, profile, profileUnavailable };
}

/** ¿Es admin u operador? (mismo criterio que `isStaff` del panel web). */
export function isApiStaff(user: ApiUser | null): boolean {
  const role = user?.profile?.role;
  return role === "admin" || role === "operator";
}
