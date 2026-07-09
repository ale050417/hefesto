import { createBrowserClient } from "@supabase/ssr";
import { fetchWithTimeout } from "./fetch-with-timeout";

/**
 * Cliente Supabase para componentes de cliente.
 * Con timeout de red: un fetch colgado no deja spinners eternos (anti-cuelgue).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { global: { fetch: fetchWithTimeout() } },
  );
}
