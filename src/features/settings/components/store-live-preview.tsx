"use client";

import { useState } from "react";

/**
 * Vista previa REAL de la tienda (Fase 7): un iframe de la portada del
 * cliente, tal cual está publicada. Reemplaza al mockup dibujado a mano, que
 * "se parecía" pero no era la tienda. Se recarga sola después de cada
 * guardado (prop `version`) y a demanda con el botón.
 */
export function StoreLivePreview({ version }: { version: number }) {
  // El iframe se remonta cuando cambia `version` (guardado) o `stamp` (botón).
  const [stamp, setStamp] = useState(0);

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
          key={`${version}:${stamp}`}
          src={`/?_preview=${version}-${stamp}`}
          title="Vista previa de la tienda (estado publicado)"
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
        Esta es la tienda REAL con el estado publicado actual: lo que ves acá es
        exactamente lo que ve el cliente. Se actualiza al guardar.
      </p>
    </div>
  );
}
