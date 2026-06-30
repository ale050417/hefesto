import { isAdmin, requirePermissionPage } from "@/core/auth/permissions";
import { PriceCalculator } from "@/features/calculator/components/price-calculator";
import { CalcConfigButton } from "@/features/calculator/components/calc-config-button";
import { MarginPresetsButton } from "@/features/calculator/components/margin-presets-button";
import {
  getCalcConfig,
  getStats,
  listHistory,
  listActivePresetOptions,
  listMarginPresets,
} from "@/features/calculator/service";
import { listFilamentsView } from "@/features/inventory/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calculadora 3D" };

export default async function CalculatorPage() {
  await requirePermissionPage("calculadora", "ver");
  const admin = await isAdmin();
  const [config, history, stats, filaments, presetOptions, presets] =
    await Promise.all([
      getCalcConfig(),
      listHistory(),
      getStats(),
      listFilamentsView(),
      listActivePresetOptions(),
      // El margen completo solo se carga (y se envía al cliente) si es admin.
      admin ? listMarginPresets() : Promise.resolve([]),
    ]);

  const materials = [...new Set(filaments.map((f) => f.material))];
  const costMap: Record<string, number> = {};
  for (const f of filaments) {
    if (!(f.material in costMap)) costMap[f.material] = f.costPerKg;
  }

  return (
    <div className="view grid gap-5">
      <div className="page-head">
        <div className="flex items-center gap-3">
          <span
            className="kpi-ic"
            style={{
              background: "rgba(76,183,130,.14)",
              color: "var(--success)",
              width: 48,
              height: 48,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width={22}
              height={22}
              aria-hidden
            >
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <path d="M8 6h8M8 10h2M12 10h2M16 10h0M8 14h2M12 14h2M16 14h0M8 18h2M12 18h2M16 18h0" />
            </svg>
          </span>
          <div>
            <div className="eyebrow" style={{ color: "var(--success)" }}>
              Herramienta de negocio
            </div>
            <h1 className="page-title">Calculadora de costos 3D</h1>
            <div className="page-sub">
              Presupuestá en tiempo real · material, electricidad, desgaste y
              ganancia
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {admin ? <MarginPresetsButton presets={presets} /> : null}
          <CalcConfigButton config={config} />
        </div>
      </div>

      <PriceCalculator
        config={config}
        materials={materials}
        costMap={costMap}
        history={history}
        stats={stats}
        presetOptions={presetOptions}
        presets={presets}
        isAdmin={admin}
      />
    </div>
  );
}
