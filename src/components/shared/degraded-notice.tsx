/**
 * Aviso de datos parciales: alguna fuente de la página falló o tardó de más
 * (ver lib/safe-load). Mejor un cartel honesto que ceros silenciosos que
 * parecen "no hay ventas" (incidente del panel, 2026-07-11).
 */
export function DegradedNotice({ sources }: { sources?: string[] }) {
  // `sources` puede venir undefined (p. ej. un dashboard cacheado por Vercel
  // ANTES de este deploy, sin el campo `degraded`): tratarlo como "todo OK".
  if (!sources || sources.length === 0) return null;
  return (
    <div
      role="status"
      className="ui-card mb-4 p-4 text-sm"
      style={{ borderColor: "var(--danger)" }}
    >
      <b>Datos incompletos.</b>{" "}
      <span className="text-dim">
        No pudimos cargar: {sources.join(", ")}. La base de datos tardó en
        responder; recargá la página en unos segundos.
      </span>
    </div>
  );
}
