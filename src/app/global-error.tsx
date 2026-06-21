"use client";

import { useEffect } from "react";
import { captureException } from "@/core/observability";

/**
 * Captura errores que rompen el layout raíz. Debe renderizar su propio
 * <html>/<body> porque reemplaza al layout. Caso catastrófico y poco frecuente.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { boundary: "global", digest: error.digest });
  }, [error]);

  return (
    <html lang="es" data-theme="light">
      <body>
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            textAlign: "center",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.5rem" }}>Algo salió mal</h1>
          <p style={{ maxWidth: "28rem", opacity: 0.7 }}>
            Ocurrió un error inesperado. Por favor, recargá la página.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
