import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  fetchWithTimeout,
  SUPABASE_FETCH_TIMEOUT_MS,
} from "@/core/supabase/fetch-with-timeout";

/** ¿El request trae cookie de sesión de Supabase? (sb-<ref>-auth-token[.n]) */
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/ingresar";
  url.search = "";
  url.searchParams.set("redirect", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

/**
 * Middleware de sesión. Su ÚNICO trabajo es refrescar el token de Supabase
 * (renovarlo antes de que venza) y cortar el paso a /admin sin sesión.
 * La autorización real (roles) vive en los guards del servidor
 * (`requireStaff`/`requireUser`), que validan el JWT localmente (getClaims).
 *
 * Diseño anti-cuelgue (DIAGNOSTICO-CUELGUES-2026-07-09, RC1):
 *  - Sin cookie de sesión no hay nada que refrescar → NO se llama a Supabase
 *    (los visitantes anónimos navegan sin depender de la red de auth).
 *  - La llamada de refresco tiene timeout (fetchWithTimeout) y try/catch: si
 *    auth no responde, la app NO se cuelga ni tira 500 global; el request pasa
 *    y los guards del servidor deciden con el token que ya está en la cookie.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const isAdminPath = request.nextUrl.pathname.startsWith("/admin");

  if (!hasAuthCookie(request)) {
    // Sin sesión: al panel no se entra; el resto sigue normal.
    return isAdminPath ? redirectToLogin(request) : response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      global: { fetch: fetchWithTimeout(SUPABASE_FETCH_TIMEOUT_MS) },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refresca la sesión (renueva tokens). Nunca puede colgar ni tumbar la app.
  let user: unknown = null;
  let authUnavailable = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    user = data?.user ?? null;
    // "Sesión ausente/incompleta" es un estado normal, no una falla de red.
    if (error && error.name !== "AuthSessionMissingError") {
      authUnavailable = true;
      console.error("[middleware] auth devolvió error:", error.name);
    }
  } catch (e) {
    // Timeout o red caída: seguimos sin refrescar; los guards del servidor
    // validan el token vigente de la cookie de forma local.
    authUnavailable = true;
    console.error("[middleware] auth no disponible:", e);
  }

  if (!user && isAdminPath && !authUnavailable) {
    // Auth respondió y NO hay sesión válida → al login.
    return redirectToLogin(request);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
