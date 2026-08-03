"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Al cambiar de pantalla, empezar ARRIBA (2026-07-29).
 *
 * Ale: "toco una sección y me aparece allá abajo en vez de en el inicio".
 * Pasa por dos motivos, los dos del App Router:
 *  - cambiar solo los `searchParams` (filtros del catálogo, orden, paginación)
 *    NO es un cambio de ruta, así que Next conserva la posición: tocás
 *    "página 2" estando abajo y seguís abajo, mirando el pie;
 *  - al volver atrás, la restauración de scroll puede aplicarse mientras la
 *    pantalla de carga todavía es corta, y queda a mitad de página.
 *
 * Si la URL trae ancla (`/#faq`), NO tocamos nada: ahí saltar es lo que el
 * usuario pidió.
 */
export function ScrollToTopOnNavigate() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (window.location.hash) return;
    // `instant`: un scroll suave acá se siente como que la página "se cae"
    // sola después de cargar.
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname, searchParams]);

  return null;
}
