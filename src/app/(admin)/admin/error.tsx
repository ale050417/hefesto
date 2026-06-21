"use client";

import Link from "next/link";
import { useEffect } from "react";
import { captureException } from "@/core/observability";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { boundary: "admin", digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 py-20 text-center">
      <p className="eyebrow">Error en el panel</p>
      <h1 className="font-display text-fg text-2xl">
        No pudimos cargar esta sección
      </h1>
      <p className="text-dim max-w-md text-sm">
        Ocurrió un error inesperado al cargar el panel de administración.
      </p>
      <div className="mt-4 flex gap-3">
        <button type="button" className="btn btn-primary" onClick={reset}>
          Reintentar
        </button>
        <Link href="/admin" className="btn btn-ghost">
          Volver al panel
        </Link>
      </div>
    </div>
  );
}
