import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Texto chico arriba del título (por defecto "Sin resultados"). */
  eyebrow?: string;
  /** Ícono (svg) en una ficha redonda sobre el título. */
  icon?: ReactNode;
  className?: string;
};

/**
 * Estado vacío único del panel: ficha con ícono, eyebrow, título, texto y
 * acción. Antes cada sección escribía el suyo ("Todavía no creaste cupones."
 * en un div suelto) y ninguno invitaba a hacer algo (2026-10-21).
 */
export function EmptyState({
  title,
  description,
  action,
  eyebrow = "Sin resultados",
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={
        "border-surface-3 flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed px-6 py-14 text-center " +
        (className ?? "")
      }
    >
      {icon ? (
        <div className="kpi-ic mb-4" style={{ width: 52, height: 52 }}>
          {icon}
        </div>
      ) : null}
      <p className="eyebrow">{eyebrow}</p>
      <h3 className="font-display text-fg mt-2 text-xl">{title}</h3>
      {description ? (
        <p className="text-dim mt-2 max-w-sm text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
