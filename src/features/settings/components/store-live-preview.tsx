"use client";

import { useEffect, useRef, useState } from "react";
import {
  PREVIEW_MSG,
  PREVIEW_READY_MSG,
  type PreviewDraft,
} from "./preview-bridge";

/**
 * Vista previa REAL de la tienda (Fase 7): un iframe de la portada del
 * cliente. Dos modos combinados:
 *  - Publicado: el iframe muestra lo que ve el cliente; se recarga al guardar
 *    (prop `version`) y a demanda con el botón.
 *  - Borrador EN VIVO: cada cambio del form (secciones, acento, nombre,
 *    eslogan) se manda por postMessage al PreviewBridge dentro del iframe,
 *    que lo aplica al instante SIN tocar lo publicado.
 */
function postDraft(
  iframe: HTMLIFrameElement | null,
  draft: PreviewDraft | undefined,
) {
  if (!iframe?.contentWindow || !draft) return;
  iframe.contentWindow.postMessage(
    { type: PREVIEW_MSG, draft },
    window.location.origin,
  );
}

export function StoreLivePreview({
  version,
  draft,
}: {
  version: number;
  draft?: PreviewDraft;
}) {
  // El iframe se remonta cuando cambia `version` (guardado) o `stamp` (botón).
  const [stamp, setStamp] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const draftRef = useRef<PreviewDraft | undefined>(undefined);

  // Ref con el último borrador (solo se toca dentro de efectos).
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // El iframe avisa cuando está listo (carga inicial y cada recarga).
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string };
      if (data?.type === PREVIEW_READY_MSG) {
        postDraft(iframeRef.current, draftRef.current);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Cambios del borrador → al iframe (con un mini debounce anti-ráfaga).
  useEffect(() => {
    const t = setTimeout(() => postDraft(iframeRef.current, draft), 120);
    return () => clearTimeout(t);
  }, [draft]);

  return (
    <div className="ui-card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <span className="flex gap-1" aria-hidden>
            {["#d96a5a", "#d9a441", "#4cb782"].map((c) => (
              <i
                key={c}
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 99,
                  background: c,
                  display: "inline-block",
                }}
              />
            ))}
          </span>
          <span className="text-faint text-[12px]">tu-tienda / portada</span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setStamp(Date.now())}
          title="Recargar vista previa"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
          </svg>
          Recargar
        </button>
      </div>
      <div style={{ position: "relative", height: 460, overflow: "hidden" }}>
        <iframe
          ref={iframeRef}
          key={`${version}:${stamp}`}
          src={`/?_preview=${version}-${stamp}`}
          title="Vista previa de la tienda"
          style={{
            width: "200%",
            height: "200%",
            transform: "scale(.5)",
            transformOrigin: "top left",
            border: 0,
          }}
        />
      </div>
      <p
        className="text-faint border-t px-3 py-2 text-[11.5px]"
        style={{ borderColor: "var(--border)" }}
      >
        Lo que tocás en el form se refleja acá al instante como BORRADOR; la
        tienda real no cambia hasta que guardes. Al guardar, se recarga con lo
        publicado.
      </p>
    </div>
  );
}
