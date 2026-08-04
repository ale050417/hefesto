"use client";

import { useState } from "react";
import { createClient } from "@/core/supabase/browser";

/**
 * "Continuar con Google", el MISMO en todos lados: el modal de compra, la
 * página de ingreso y la de registro.
 *
 * Antes solo existía dentro del modal, así que desde el celular —donde se entra
 * por las páginas, no por el modal— no había forma de usar Google: te pedía
 * crear una cuenta con contraseña sí o sí (Ale, 2026-08-04).
 *
 * `redirectTo` vuelve a /auth/callback, que canjea el código por la sesión.
 */
export function GoogleButton({
  next = "/",
  label = "Continuar con Google",
}: {
  /** A dónde ir después de entrar. */
  next?: string;
  label?: string;
}) {
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function entrar() {
    if (yendo) return;
    setYendo(true);
    setError(null);
    const supabase = createClient();
    const destino = next.startsWith("/") ? next : "/";
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destino)}`,
      },
    });
    if (oauthError) {
      setYendo(false);
      setError("No se pudo abrir el acceso con Google. Probá de nuevo.");
    }
    // Si sale bien, el navegador se va a Google: no hace falta apagar `yendo`.
  }

  return (
    <div>
      <div className="my-4 flex items-center gap-3">
        <span className="bg-surface-3 h-px flex-1" />
        <span className="text-faint text-xs">o</span>
        <span className="bg-surface-3 h-px flex-1" />
      </div>
      {/* Redondeado y blanco: es el botón estándar de Google. Se reconoce de
          lejos y funciona igual en celular y en computadora (48px de alto = el
          mínimo táctil cómodo). */}
      <button
        type="button"
        onClick={entrar}
        disabled={yendo}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[#dadce0] bg-white text-[15px] font-medium text-[#3c4043] transition-shadow hover:shadow-md disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path
            fill="#4285F4"
            d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-2 3.2-4.9 3.2-7.9z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.9 0 5.4-1 7.2-2.7l-3.6-2.7c-1 .7-2.3 1-3.6 1-2.8 0-5.1-1.9-6-4.4H2.3v2.8A11 11 0 0 0 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M6 14.2a6.6 6.6 0 0 1 0-4.2V7.2H2.3a11 11 0 0 0 0 9.8z"
          />
          <path
            fill="#EA4335"
            d="M12 5.4c1.6 0 3 .5 4.1 1.6l3.1-3.1A11 11 0 0 0 2.3 7.2L6 10c.9-2.6 3.2-4.5 6-4.5z"
          />
        </svg>
        {yendo ? "Abriendo Google…" : label}
      </button>
      {error ? <p className="text-danger mt-2 text-xs">{error}</p> : null}
    </div>
  );
}
