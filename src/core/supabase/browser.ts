import { createBrowserClient } from "@supabase/ssr";

/** Cliente Supabase para componentes de cliente. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  );
}
