const PALETTE = [
  "#C9A84C",
  "#5A9CD9",
  "#9B7BD4",
  "#4CB782",
  "#D98A5A",
  "#D96A5A",
  "#D9A441",
  "#5ED29A",
];

export function CategoryDonut({
  data,
}: {
  data: Array<{ name: string; revenue: number }>;
}) {
  const total = data.reduce((a, d) => a + d.revenue, 0);
  const r = 70;
  const c = 2 * Math.PI * r;
  // Segmentos con su largo y offset acumulado (precalculado, sin mutar en render).
  const segments = data.map((d, i) => {
    const len = total > 0 ? (d.revenue / total) * c : 0;
    const offset = data
      .slice(0, i)
      .reduce((a, p) => a + (total > 0 ? (p.revenue / total) * c : 0), 0);
    return { name: d.name, len, offset };
  });

  return (
    <div className="ui-card section-card">
      <div className="section-title mb-1">Ventas por categoría</div>
      <div className="text-faint mb-3.5 text-[12.5px]">
        Participación en facturación total
      </div>
      {total === 0 ? (
        <p className="text-dim py-8 text-center text-sm">
          Sin ventas registradas todavía.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-6">
          <svg
            viewBox="0 0 180 180"
            style={{ width: 180, height: 180 }}
            role="img"
            aria-label="Ventas por categoría"
          >
            <g transform="rotate(-90 90 90)">
              <circle
                cx="90"
                cy="90"
                r={r}
                fill="none"
                stroke="var(--surface-2)"
                strokeWidth="22"
              />
              {segments.map((s, i) => (
                <circle
                  key={s.name}
                  cx="90"
                  cy="90"
                  r={r}
                  fill="none"
                  stroke={PALETTE[i % PALETTE.length]}
                  strokeWidth="22"
                  strokeDasharray={`${s.len} ${c - s.len}`}
                  strokeDashoffset={-s.offset}
                />
              ))}
            </g>
          </svg>
          <ul className="flex flex-col gap-2 text-[12.5px]">
            {data.map((d, i) => (
              <li key={d.name} className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: PALETTE[i % PALETTE.length] }}
                />
                <span className="text-dim">{d.name}</span>
                <span className="text-fg ml-1 font-medium">
                  {Math.round((d.revenue / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
