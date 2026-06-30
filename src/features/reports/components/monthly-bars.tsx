import { compactPrice } from "@/lib/format";

const MONTHS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export function MonthlyBars({
  current,
  prev,
  year,
  prevYear,
}: {
  current: number[];
  prev: number[];
  year: number;
  prevYear: number;
}) {
  const W = 760;
  const H = 280;
  const pad = { l: 8, r: 8, t: 10, b: 22 };
  const chartH = H - pad.t - pad.b;
  const chartW = W - pad.l - pad.r;
  const max = Math.max(1, ...current, ...prev);
  const groupW = chartW / 12;
  const barW = Math.min(13, groupW / 2 - 3);
  const baseY = pad.t + chartH;

  return (
    <div className="ui-card section-card">
      <div className="section-title mb-1">Ventas por mes</div>
      <div className="text-faint mb-3.5 text-[12.5px]">
        Comparativa {prevYear} vs {year} (ARS)
      </div>
      <div className="mb-3 flex items-center gap-4 text-[11.5px]">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: "rgba(155,154,166,.45)" }}
          />
          {prevYear}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: "var(--gold)" }}
          />
          {year}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 280 }}
        role="img"
        aria-label={`Ventas por mes ${prevYear} vs ${year}`}
      >
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line
            key={g}
            x1={pad.l}
            x2={W - pad.r}
            y1={baseY - g * chartH}
            y2={baseY - g * chartH}
            stroke="var(--border)"
            strokeWidth="1"
          />
        ))}
        {MONTHS.map((m, i) => {
          const gx = pad.l + i * groupW + groupW / 2;
          const hPrev = (prev[i]! / max) * chartH;
          const hCur = (current[i]! / max) * chartH;
          return (
            <g key={m}>
              <rect
                x={gx - barW - 1.5}
                y={baseY - hPrev}
                width={barW}
                height={hPrev}
                rx="3"
                fill="rgba(155,154,166,.45)"
              />
              <rect
                x={gx + 1.5}
                y={baseY - hCur}
                width={barW}
                height={hCur}
                rx="3"
                fill="var(--gold)"
              />
              <text
                x={gx}
                y={H - 6}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-faint)"
              >
                {m}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="text-faint mt-1 text-right text-[11px]">
        Máximo mensual: {compactPrice(max)}
      </div>
    </div>
  );
}
