/**
 * Spinner de marca Hefesto: una "H" que se "imprime" capa por capa (efecto de
 * impresión 3D) con brillo dorado de forja. CSS puro (sin JS), autocontenido,
 * usable en cualquier loading.tsx (server component).
 */
export function HefestoLoader({
  label = "Cargando…",
  size = 56,
}: {
  label?: string;
  size?: number;
}) {
  return (
    <div
      className="hefl"
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        padding: "48px 0",
      }}
    >
      <svg
        className="hefl-svg"
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden
      >
        {/* Placa base (yunque) */}
        <rect
          className="hefl-base"
          x="8"
          y="42"
          width="32"
          height="3"
          rx="1.5"
        />
        {/* H de contorno (molde) */}
        <path
          className="hefl-ghost"
          d="M9 7 H17 V20 H31 V7 H39 V41 H31 V28 H17 V41 H9 Z"
        />
        {/* H que se imprime de abajo hacia arriba (gold) */}
        <path
          className="hefl-fill"
          d="M9 7 H17 V20 H31 V7 H39 V41 H31 V28 H17 V41 H9 Z"
        />
        {/* Cabezal de impresión (línea que sube) */}
        <rect
          className="hefl-head"
          x="6"
          y="0"
          width="36"
          height="1.6"
          rx="0.8"
        />
      </svg>

      <span className="hefl-label">{label}</span>

      <style>{`
        .hefl-base { fill: var(--gold-deep, #8a6d2a); opacity: .55; }
        .hefl-ghost { fill: rgba(var(--gold-rgb,201,168,76), .14); }
        .hefl-fill {
          fill: var(--gold, #c9a84c);
          animation: hefl-print 2.1s cubic-bezier(.5,.1,.3,1) infinite;
          filter: drop-shadow(0 0 4px rgba(var(--gold-rgb,201,168,76), .55));
        }
        .hefl-head {
          fill: var(--gold-bright, #e7c560);
          opacity: 0;
          animation: hefl-head 2.1s cubic-bezier(.5,.1,.3,1) infinite;
        }
        .hefl-label {
          font-size: 12.5px;
          letter-spacing: .04em;
          color: var(--text-dim, #9a8f73);
          animation: hefl-fade 2.1s ease-in-out infinite;
        }
        @keyframes hefl-print {
          0%   { clip-path: inset(100% 0 0 0); }
          62%  { clip-path: inset(0 0 0 0); }
          100% { clip-path: inset(0 0 0 0); }
        }
        @keyframes hefl-head {
          0%   { transform: translateY(40px); opacity: 0; }
          8%   { opacity: 1; }
          58%  { transform: translateY(2px); opacity: 1; }
          70%  { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes hefl-fade {
          0%, 100% { opacity: .5; }
          55%      { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hefl-fill, .hefl-head, .hefl-label { animation: none; }
          .hefl-fill { clip-path: none; }
          .hefl-head { display: none; }
        }
      `}</style>
    </div>
  );
}
