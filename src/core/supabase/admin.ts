import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/core/config/env";
import {
  fetchWithTimeout,
  SUPABASE_ADMIN_FETCH_TIMEOUT_MS,
} from "./fetch-with-timeout";

// Cliente admin (service role): SOLO servidor. Saltea RLS; nunca exponer.
// Se crea de forma perezosa para no romper el build (que no tiene secretos).
// Timeout de red más alto (60 s): este cliente sube imágenes a Storage.
let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false },
        global: { fetch: fetchWithTimeout(SUPABASE_ADMIN_FETCH_TIMEOUT_MS) },
      },
    );
  }
  return client;
}

/** Email de un usuario por id (desde auth.users, vía service role). */
export async function getUserEmail(userId: string): Promise<string | null> {
  const { data, error } =
    await getSupabaseAdmin().auth.admin.getUserById(userId);
  if (error || !data?.user) return null;
  return data.user.email ?? null;
}

/**
 * Mapa id → email de todos los usuarios de auth (paginado). Para listados del
 * panel donde no queremos una llamada por cliente. Tope defensivo de páginas.
 */
export async function listAuthEmails(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const admin = getSupabaseAdmin();
  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) break;
    for (const u of data.users) if (u.email) map.set(u.id, u.email);
    if (data.users.length < perPage) break;
  }
  return map;
}

/** Datos de auth de un usuario relevantes para el panel de equipo. */
export type AuthUserInfo = {
  email: string | null;
  /** Última vez que inició sesión (null = nunca entró). */
  lastSignInAt: string | null;
  /** Cuándo fue invitado por un admin (null si se registró solo). */
  invitedAt: string | null;
};

/**
 * Mapa id → datos de auth (email + estado). Para distinguir miembros activos de
 * invitaciones pendientes en "Equipo de gestión".
 */
export async function listAuthUsers(): Promise<Map<string, AuthUserInfo>> {
  const map = new Map<string, AuthUserInfo>();
  const admin = getSupabaseAdmin();
  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) break;
    for (const u of data.users) {
      map.set(u.id, {
        email: u.email ?? null,
        lastSignInAt: u.last_sign_in_at ?? null,
        invitedAt: u.invited_at ?? null,
      });
    }
    if (data.users.length < perPage) break;
  }
  return map;
}

/**
 * Crea un usuario de auth con contraseña (email ya confirmado, sin paso de
 * verificación). Para invitar staff con credenciales temporales. Si el email ya
 * existe, devuelve error (no se pisa una cuenta existente).
 */
export async function createUserWithPassword(
  email: string,
  password: string,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) return { id: null, error: error.message };
  return { id: data.user?.id ?? null, error: null };
}

/** Setea una nueva contraseña a un usuario (reset de credenciales por admin). */
export async function setUserPassword(
  userId: string,
  password: string,
): Promise<{ error: string | null }> {
  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(userId, {
    password,
  });
  return { error: error?.message ?? null };
}
