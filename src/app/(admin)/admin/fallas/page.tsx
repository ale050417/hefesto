import { requirePermissionPage } from "@/core/auth/permissions";
import { KpiCard } from "@/features/reports/components/kpi-card";
import { RegistrarFallaButton } from "@/features/inventory/components/registrar-falla-button";
import {
  FailuresTable,
  type FailureRow,
} from "@/features/inventory/components/failures-table";
import { listFailures, listFilamentsView } from "@/features/inventory/queries";
import { compactPrice } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Impresiones fallidas" };

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "short" });

const ic = (path: string) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    dangerouslySetInnerHTML={{ __html: path }}
  />
);
const ALERT_PATH =
  '<path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>';

export default async function FallasPage() {
  await requirePermissionPage("fallas", "ver");
  const [filaments, failures] = await Promise.all([
    listFilamentsView(),
    listFailures(),
  ]);

  const costKg = (material: string | null, color: string | null): number => {
    const exact = filaments.find(
      (f) => f.material === material && f.color === color,
    );
    if (exact) return exact.costPerKg;
    return filaments.find((f) => f.color === color)?.costPerKg ?? 0;
  };

  const rows: FailureRow[] = failures.map((f) => {
    const grams = Number(f.gramsLost);
    return {
      id: f.id,
      createdAt: dateFmt.format(f.createdAt),
      pieceName: f.pieceName,
      material: f.material ?? "",
      color: f.color ?? "",
      gramsLost: grams,
      reason: f.reason,
      notes: f.notes,
      cost: (grams / 1000) * costKg(f.material, f.color),
    };
  });

  const totalG = rows.reduce((a, r) => a + r.gramsLost, 0);
  const totalCost = rows.reduce((a, r) => a + r.cost, 0);
  const byReason = new Map<string, number>();
  for (const r of rows)
    byReason.set(r.reason, (byReason.get(r.reason) ?? 0) + 1);
  const topReason = [...byReason.entries()].sort((a, b) => b[1] - a[1])[0];
  const materials = [...new Set(filaments.map((f) => f.material))];

  return (
    <div className="view grid gap-5">
      <div className="page-head">
        <div className="flex items-center gap-3">
          <span
            className="kpi-ic"
            style={{
              background: "rgba(217,106,90,.14)",
              color: "var(--danger)",
              width: 48,
              height: 48,
            }}
          >
            {ic(ALERT_PATH)}
          </span>
          <div>
            <div className="eyebrow" style={{ color: "var(--danger)" }}>
              Pérdidas de producción
            </div>
            <h1 className="page-title">Impresiones fallidas</h1>
            <div className="page-sub">
              Registrá las impresiones que se perdieron y el filamento
              desperdiciado
            </div>
          </div>
        </div>
        <RegistrarFallaButton materials={materials} />
      </div>

      <div className="kpi-grid">
        <KpiCard
          icon={ic(ALERT_PATH)}
          label="Fallas registradas"
          value={String(failures.length)}
          delta="total"
          up={false}
          tint="#D96A5A"
        />
        <KpiCard
          icon={ic(
            '<path d="M12 3a4 4 0 0 0-4 4h8a4 4 0 0 0-4-4z"/><path d="M6.5 7h11l2.5 12a2 2 0 0 1-2 2.4H6a2 2 0 0 1-2-2.4z"/>',
          )}
          label="Filamento perdido"
          value={`${(totalG / 1000).toFixed(2)} kg`}
          delta={`${totalG} g`}
          up={false}
          tint="#D9A441"
        />
        <KpiCard
          icon={ic(
            '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
          )}
          label="Costo perdido"
          value={compactPrice(totalCost)}
          delta="estimado"
          up={false}
          tint="#D96A5A"
        />
        <KpiCard
          icon={ic(
            '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/>',
          )}
          label="Causa más común"
          value={topReason ? topReason[0] : "—"}
          up={false}
          tint="#9B7BD4"
        />
      </div>

      {rows.length === 0 ? (
        <div className="ui-card section-card flex flex-col items-center gap-2 p-10 text-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width={26}
            height={26}
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <div className="text-dim">Sin fallas registradas. ¡Buen trabajo!</div>
        </div>
      ) : (
        <FailuresTable failures={rows} materials={materials} />
      )}
    </div>
  );
}
