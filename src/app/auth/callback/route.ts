import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/core/supabase/server";
import { siteUrl } from "@/lib/site";

/**
 * Única puerta de entrada de los links que manda Supabase: el acceso con Google
 * y el mail de "verificá tu cuenta".
 *
 * Supabase usa DOS formatos según el caso, y hay que soportar los dos:
 * - `?code=…` (OAuth y el flujo PKCE) → se canjea con `exchangeCodeForSession`.
 * - `?token_hash=…&type=signup` (confirmación de mail) → `verifyOtp`.
 *
 * Antes el mail de verificación apuntaba a `/ingresar`, que no canjea nada: el
 * cliente tocaba el link, la sesión nunca se creaba y le aparecía un error sin
 * explicación (2026-08-04).
 *
 * El destino se arma con `siteUrl`, no con el `origin` del request: detrás de
 * Vercel el origin puede ser la URL interna del deploy y el usuario terminaba
 * en una dirección rara.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/";

  // Supabase también puede devolver el error directo en la URL (link vencido,
  // ya usado). Ese caso se muestra tal cual, sin intentar canjear nada.
  const errorDescription = searchParams.get("error_description");
  if (errorDescription) {
    return NextResponse.redirect(
      `${siteUrl}/ingresar?error=${encodeURIComponent(motivo(errorDescription))}`,
    );
  }

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      // Cuenta confirmada: entra directo, ya con la sesión puesta.
      return NextResponse.redirect(`${siteUrl}${next}?verificado=1`);
    }
    console.error("[auth] verifyOtp falló:", error.message);
    return NextResponse.redirect(
      `${siteUrl}/ingresar?error=${encodeURIComponent(motivo(error.message))}`,
    );
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${siteUrl}${next}`);
    console.error("[auth] exchangeCodeForSession falló:", error.message);
    return NextResponse.redirect(
      `${siteUrl}/ingresar?error=${encodeURIComponent(motivo(error.message))}`,
    );
  }

  return NextResponse.redirect(
    `${siteUrl}/ingresar?error=${encodeURIComponent("El link no es válido. Pedí uno nuevo.")}`,
  );
}

/** Traduce el error de Supabase a algo que el cliente entienda. */
function motivo(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("expired"))
    return "El link venció. Registrate de nuevo o pedí otro mail.";
  if (m.includes("already") || m.includes("used"))
    return "Ese link ya se usó. Probá iniciar sesión directamente.";
  if (m.includes("invalid"))
    return "El link no es válido. Puede que se haya cortado al copiarlo.";
  return "No pudimos confirmar tu cuenta. Escribinos y lo resolvemos.";
}
