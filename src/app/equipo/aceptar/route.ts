import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/core/supabase/server";

/**
 * Aterrizaje del link de invitación al equipo (2026-07-24). Verifica el token
 * de UN SOLO USO que generó el admin (invite al crear, magiclink al reenviar):
 * si es válido, Supabase abre sesión y los guards del panel lo llevan derecho
 * a "Creá tu contraseña" (must_change_password). Si venció o ya se usó, va a
 * /ingresar con un aviso — nunca se filtra por qué falló.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  // Solo los dos tipos que emitimos nosotros (nada de abrir el verificador).
  const type: EmailOtpType = typeParam === "magiclink" ? "magiclink" : "invite";

  if (tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      // must_change_password=true → el guard redirige a /cuenta/cambiar-clave
      // ("Creá tu contraseña") antes de dejarlo tocar el panel.
      return NextResponse.redirect(`${origin}/cuenta/cambiar-clave`);
    }
  }
  return NextResponse.redirect(`${origin}/ingresar?error=invitacion`);
}
