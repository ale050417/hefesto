"use client";

import { useState } from "react";
import { useMounted } from "@/hooks/use-mounted";

function bannerDismissed(): boolean {
  try {
    return sessionStorage.getItem("hefesto-banner-off") === "1";
  } catch {
    return false;
  }
}

/**
 * Banda de promo del header: finita y cerrable. El cierre se recuerda por
 * sesión (sessionStorage): si cambia la promo o se vuelve mañana, reaparece.
 */
export function TopBanner() {
  const mounted = useMounted();
  const [closed, setClosed] = useState(false);
  // En SSR se muestra siempre; tras montar respetamos el cierre guardado.
  const hidden = closed || (mounted && bannerDismissed());
  if (hidden) return null;

  return (
    <div className="store-banner">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        width="14"
        height="14"
        aria-hidden="true"
      >
        <path d="M1 3h13v13H1z" />
        <path d="M14 8h4l3 3v5h-7z" />
        <circle cx="5.5" cy="18.5" r="2" />
        <circle cx="17.5" cy="18.5" r="2" />
      </svg>
      <span>Envíos a todo el país · coordinamos el tuyo por WhatsApp</span>
      <button
        type="button"
        aria-label="Cerrar aviso"
        className="store-banner-close"
        onClick={() => {
          setClosed(true);
          try {
            sessionStorage.setItem("hefesto-banner-off", "1");
          } catch {
            /* ignore */
          }
        }}
      >
        ✕
      </button>
    </div>
  );
}
