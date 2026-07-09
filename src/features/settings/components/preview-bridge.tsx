"use client";

import { useEffect } from "react";
import { hexToRgbString, shade } from "../seasons";

export type PreviewDraft = {
  name?: string;
  slogan?: string;
  accent?: string | null;
  sections?: Record<string, boolean>;
};

export const PREVIEW_MSG = "hefesto-preview";
export const PREVIEW_READY_MSG = "hefesto-preview-ready";

/**
 * Puente del modo preview (Fase 7+): corre SOLO cuando la tienda está embebida
 * en el iframe de Configuración (`/?_preview=…`). Escucha el borrador que le
 * manda el admin por postMessage (mismo origen) y lo aplica en vivo sin tocar
 * lo publicado: secciones del home (muestra/oculta), color de acento y textos
 * de marca. Al guardar, el iframe se recarga con el estado ya publicado.
 */
export function PreviewBridge() {
  useEffect(() => {
    if (window.self === window.top) return; // no estamos embebidos: no-op

    const apply = (draft: PreviewDraft) => {
      if (draft.sections) {
        for (const [id, visible] of Object.entries(draft.sections)) {
          document
            .querySelectorAll<HTMLElement>(`[data-home-section="${id}"]`)
            .forEach((el) => {
              el.style.display = visible ? "" : "none";
            });
        }
      }
      if (draft.accent) {
        const rgb = hexToRgbString(draft.accent);
        const root = document.documentElement.style;
        root.setProperty("--gold", draft.accent);
        root.setProperty("--gold-bright", shade(draft.accent, 14));
        root.setProperty("--gold-deep", shade(draft.accent, -16));
        if (rgb) root.setProperty("--gold-rgb", rgb);
      }
      if (typeof draft.name === "string" && draft.name.trim()) {
        document
          .querySelectorAll<HTMLElement>("[data-preview-name]")
          .forEach((el) => {
            el.textContent = draft.name!;
          });
      }
      if (typeof draft.slogan === "string" && draft.slogan.trim()) {
        document
          .querySelectorAll<HTMLElement>("[data-preview-slogan]")
          .forEach((el) => {
            el.textContent = draft.slogan!;
          });
      }
    };

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; draft?: PreviewDraft };
      if (data?.type === PREVIEW_MSG && data.draft) apply(data.draft);
    };
    window.addEventListener("message", onMessage);
    // Avisar al admin que estamos listos para recibir el borrador.
    window.parent.postMessage(
      { type: PREVIEW_READY_MSG },
      window.location.origin,
    );
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
}
