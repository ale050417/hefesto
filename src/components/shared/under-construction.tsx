/**
 * Pantalla "en construcción": placeholder para features que existen pero todavía
 * no se ofrecen al público. Server component, sin JS, tema light del index.
 */
export function UnderConstruction({
  title = "En construcción",
  description = "Estamos afinando esta sección. Va a estar disponible muy pronto.",
  eyebrow = "Próximamente",
}: {
  title?: string;
  description?: string;
  eyebrow?: string;
}) {
  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="ui-card flex flex-col items-center px-6 py-12 text-center">
        <span
          className="mb-5 grid h-16 w-16 place-items-center rounded-2xl"
          style={{
            background: "rgba(var(--gold-rgb),.12)",
            color: "var(--gold-bright)",
          }}
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 21h18" />
            <path d="M6 21V9l6-4 6 4v12" />
            <path d="M9 21v-6h6v6" />
            <path d="M12 5V2" />
          </svg>
        </span>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="font-display text-fg mt-1 text-2xl font-bold">
          {title}
        </h1>
        <p className="text-dim mt-3 max-w-sm text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
