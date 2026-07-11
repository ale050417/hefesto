import { requirePermissionPage } from "@/core/auth/permissions";
import { KpiCard } from "@/features/reports/components/kpi-card";
import { NuevoFilamentoButton } from "@/features/inventory/components/nuevo-filamento-button";
import { FilamentsBoard } from "@/features/inventory/components/filaments-board";
import { listFilamentsView } from "@/features/inventory/queries";
import { DegradedNotice } from "@/components/shared/degraded-notice";
import { compactPrice, formatPrice } from "@/lib/format";
import { safeLoad } from "@/lib/safe-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Filamentos" };

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

export default async function FilamentosPage() {
  await requirePermissionPage("filamentos", "ver");
  // Carga acotada: aviso de datos parciales en vez de 504 (2026-07-11).
  const filamentsR = await safeLoad("filamentos", listFilamentsView(), []);
  const filaments = filamentsR.value;

  const totalG = filaments.reduce((a, f) => a + f.stockGrams, 0);
  const valor = filaments.reduce(
    (a, f) => a + (f.stockGrams / 1000) * f.costPerKg,
    0,
  );
  const bajos = filaments.filter((f) => f.status === "bajo").length;
  const agotados = filaments.filter((f) => f.status === "agotado").length;
  const materials = [...new Set(filaments.map((f) => f.material))];

  return (
    <div className="view grid gap-5">
      <DegradedNotice
        sources={filamentsR.ok ? [] : ["el inventario de filamentos"]}
      />
      <div className="page-head">
        <div>
          <div className="eyebrow">Inventario</div>
          <h1 className="page-title">Filamentos</h1>
          <div className="page-sub">
            {filaments.length} bobinas/colores · {(totalG / 1000).toFixed(1)} kg
            en stock · valor {formatPrice(valor)}
          </div>
        </div>
        <NuevoFilamentoButton
          suggestions={{
            brands: filaments.map((f) => f.brand),
            colors: filaments.map((f) => f.color),
          }}
        />
      </div>

      <div className="kpi-grid">
        <KpiCard
          icon={ic(
            '<path d="M12 2 2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
          )}
          label="Carretes en stock"
          value={String(filaments.length)}
          delta="colores"
          tint="var(--gold)"
        />
        <KpiCard
          icon={ic(
            '<path d="M12 3a4 4 0 0 0-4 4h8a4 4 0 0 0-4-4z"/><path d="M6.5 7h11l2.5 12a2 2 0 0 1-2 2.4H6a2 2 0 0 1-2-2.4z"/>',
          )}
          label="Material total"
          value={`${(totalG / 1000).toFixed(1)} kg`}
          delta="disponible"
          tint="var(--success)"
        />
        <KpiCard
          icon={ic(
            '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
          )}
          label="Valor del inventario"
          value={compactPrice(valor)}
          delta="estimado"
          tint="var(--gold)"
        />
        <KpiCard
          icon={ic(
            '<path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
          )}
          label="Stock bajo / agotado"
          value={String(bajos + agotados)}
          delta={agotados ? `${agotados} agotados` : "a reponer"}
          up={false}
          tint="var(--danger)"
        />
      </div>

      <FilamentsBoard filaments={filaments} materials={materials} />
    </div>
  );
}
