import Link from "next/link";

/**
 * Página/bloque "En construcción" reutilizable (branding Hefesto, negro/dorado).
 * Honesto: se usa para secciones aún no implementadas o estados futuros, sin
 * inventar funcionalidad. Server component (sin estado).
 *
 * Props:
 *  - title: nombre de la sección.
 *  - message?: explicación corta.
 *  - eta?: estimación ("Próximamente", "v2", etc.).
 *  - backHref/backLabel?: a dónde vuelve (por defecto al panel).
 *  - inline?: si true, no centra a pantalla completa (para incrustar en una página).
 */
export function ConstructionPage({
  title,
  message = "Estamos trabajando en esta sección. Va a estar disponible pronto.",
  eta,
  backHref = "/admin",
  backLabel = "Volver al panel",
  inline = false,
}: {
  title: string;
  message?: string;
  eta?: string;
  backHref?: string;
  backLabel?: string;
  inline?: boolean;
}) {
  return (
    <div
      className={
        inline
          ? "flex items-center justify-center py-16"
          : "flex min-h-[60vh] items-center justify-center px-4 py-16"
      }
    >
      <div
        className="ui-card section-card text-center"
        style={{ maxWidth: 460, padding: "36px 28px" }}
      >
        <div
          className="kpi-ic"
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 20px",
            background: "rgba(var(--gold-rgb),.12)",
            color: "var(--gold-bright)",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="30"
            height="30"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M2 20h20M4 20V10l8-5 8 5v10" />
            <path d="M9 20v-5h6v5" />
            <path d="m12 2 1.5 3" />
          </svg>
        </div>

        <div className="eyebrow" style={{ color: "var(--gold-bright)" }}>
          En construcción
        </div>
        <h1 className="page-title" style={{ marginTop: 4 }}>
          {title}
        </h1>
        <p
          className="text-dim"
          style={{ fontSize: 14, lineHeight: 1.6, margin: "10px 0 0" }}
        >
          {message}
        </p>

        {eta ? (
          <div className="badge badge-gold" style={{ marginTop: 16 }}>
            {eta}
          </div>
        ) : null}

        <div style={{ marginTop: 24 }}>
          <Link href={backHref} className="btn btn-secondary">
            ← {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
