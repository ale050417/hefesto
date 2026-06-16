import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/core/config/env";

// Cliente admin (service role): SOLO servidor. Saltea RLS; nunca exponer.
// Se crea de forma perezosa para no romper el build (que no tiene secretos).
let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );
  }
  return client;
}
