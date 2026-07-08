import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
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

  // Refresca la sesión (renueva tokens) en cada request. Si el refresh token
  // quedó viejo/inválido, getUser() LANZA (AuthApiError refresh_token_not_found)
  // en vez de devolver error: lo atrapamos y seguimos como "sin sesión". SIN
  // este try/catch, el error sin atrapar deja el request sin respuesta y la
  // página QUEDA COLGADA (el navegador manda la cookie vieja). El SSR client ya
  // escribió las cookies limpias en `response` vía setAll.
  const result = await supabase.auth.getUser().catch(() => null);
  const user = result?.data.user ?? null;

  // Candado 1: sin sesión no se entra al panel (la autorización por rol la
  // hace el layout de /admin en el servidor).
  if (!user && request.nextUrl.pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
