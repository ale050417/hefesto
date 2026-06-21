import { formatPrice } from "@/lib/format";
import type { RevenuePoint } from "../service";

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const W = 760;
  const H = 220;
  const pad = { l: 8, r: 8, t: 12, b: 8 };
  const max = Math.max(1, ...data.map((d) => d.total));
  const n = data.length;
  const x = (i: number) =>
    pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, n - 1);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);

  const line = data.map((d, i) => `${x(i)},${y(d.total)}`).join(" ");
  const area = `${pad.l},${H - pad.b} ${line} ${x(n - 1)},${H - pad.b}`;
  const total = data.reduce((a, d) => a + d.total, 0);

  return (
    <div className="ui-card p-5">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="eyebrow">Ingresos</div>
          <div className="font-display text-fg text-2xl">
            {formatPrice(total)}
          </div>
          <div className="text-faint text-xs">
            Últimos {n} días (pedidos pagos)
          </div>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-48 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Ingresos por día"
      >
        <defs>
          <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#rev-fill)" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--gold-bright)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
