"use client";

import { HefestoLoader } from "@/components/shared/hefesto-loader";
import { useActionOverlayStore } from "@/stores/actionOverlayStore";

/**
 * Overlay bloqueante para acciones (crear/editar/eliminar): cubre la pantalla
 * con la "H" de Hefesto mientras dura la operación y se libera al terminar.
 * Reemplaza al patrón "botón congelado con spinner".
 *
 * - Aparece con un pequeño delay (180 ms) para no parpadear en operaciones
 *   instantáneas.
 * - Bloquea toda interacción (pointer-events) por encima de los modales
 *   (z-index > --z-modal).
 * - Se controla vía `runAction` (src/lib/run-action.ts), que garantiza el
 *   cierre con `finally` + timeout: nunca puede quedar pegado.
 */
export function ActionOverlay() {
  const pending = useActionOverlayStore((s) => s.pending);
  const label = useActionOverlayStore((s) => s.label);

  if (pending === 0) return null;

  return (
    <div
      className="action-overlay"
      role="alert"
      aria-busy="true"
      aria-live="assertive"
    >
      <div className="action-overlay-card">
        <HefestoLoader label={label ?? "Procesando…"} size={52} />
      </div>

      <style>{`
        .action-overlay {
          position: fixed;
          inset: 0;
          z-index: 500; /* por encima de --z-modal (400) */
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(20, 16, 8, 0.32);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          opacity: 0;
          animation: action-overlay-in 0.18s ease-out 0.18s forwards;
        }
        .action-overlay-card {
          border-radius: var(--radius-lg, 18px);
          background: var(--surface, #fff);
          box-shadow: var(--shadow-modal, 0 20px 50px rgba(0, 0, 0, 0.45));
          padding: 8px 40px;
        }
        @keyframes action-overlay-in {
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .action-overlay { animation-duration: 0.01s; animation-delay: 0s; }
        }
      `}</style>
    </div>
  );
}
