import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  icon,
  delta,
  up = true,
  tint = "var(--gold)",
  hint,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  delta?: string;
  up?: boolean;
  tint?: string;
  hint?: string;
}) {
  return (
    <div className="ui-card kpi">
      <div className="kpi-top">
        <span
          className="kpi-ic"
          style={{
            background: `color-mix(in srgb, ${tint} 14%, transparent)`,
            color: tint,
          }}
        >
          {icon}
        </span>
        {delta ? (
          <span className={`kpi-delta ${up ? "up" : "down"}`}>{delta}</span>
        ) : null}
      </div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-label">{label}</div>
      {hint ? <div className="text-faint mt-1 text-xs">{hint}</div> : null}
    </div>
  );
}
