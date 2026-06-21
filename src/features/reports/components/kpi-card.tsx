export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="ui-card p-5">
      <div className="text-dim text-xs">{label}</div>
      <div className="font-display text-fg mt-2 text-2xl">{value}</div>
      {hint ? <div className="text-faint mt-1 text-xs">{hint}</div> : null}
    </div>
  );
}
