import { can, requirePermissionPage } from "@/core/auth/permissions";
import { KpiCard } from "@/features/reports/components/kpi-card";
import { CostSettingsButton } from "@/features/earnings/components/cost-settings-button";
import { EarningsMonthFilter } from "@/features/earnings/components/month-filter";
import { ProfitSharesEditor } from "@/features/earnings/components/profit-shares-editor";
import { GN_COLORS } from "@/features/earnings/constants";
import { getEarningsOverview } from "@/features/earnings/service";
import { compactPrice, formatPrice } from "@/lib/format";
import { loadOrThrow } from "@/lib/safe-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ganancias y socios" };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v !== "" ? v : undefined;
}

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

export default async function GananciasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermissionPage("ganancias", "ver");
  const canEdit = await can("ganancias", "editar");
  const sp = await searchParams;
  // Carga etiquetada y con deadline: error claro + log [admin:ganancias] en
  // vez de un cuelgue de 30 s si la DB no responde (2026-07-11).
  const { settings, shares, rows, totals, months, selectedMonth, payouts } =
    await loadOrThrow("ganancias", getEarningsOverview(first(sp.mes)));

  const pctProfit =
    totals.ingreso > 0 ? Math.round((totals.profit / totals.ingreso) * 100) : 0;
  const periodo = selectedMonth
    ? months.find((m) => m.value === selectedMonth)?.label
    : null;

  return (
    <div className="view grid gap-5">
      <div className="page-head">
        <div>
          <div className="eyebrow">Análisis</div>
          <h1 className="page-title">Ganancias y socios</h1>
          <div className="page-sub">
            {periodo
              ? `Reparto de ${periodo} · ${rows.length} ventas cobradas`
              : `Amortización por pedido y reparto de la ganancia pura · ${rows.length} ventas cobradas`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EarningsMonthFilter months={months} selected={selectedMonth} />
          {canEdit ? <CostSettingsButton settings={settings} /> : null}
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard
          icon={ic(
            '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
          )}
          label="Ingresos cobrados"
          value={compactPrice(totals.ingreso)}
          delta={`${rows.length} pedidos`}
          tint="var(--gold)"
        />
        <KpiCard
          icon={ic(
            '<path d="M12 2 2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
          )}
          label="Amortización (costos)"
          value={compactPrice(totals.amort)}
          delta="material+luz+máquina"
          up={false}
          tint="var(--gold)"
        />
        <KpiCard
          icon={ic('<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>')}
          label="Ganancia pura"
          value={compactPrice(totals.profit)}
          delta={`${pctProfit}% del ingreso`}
          tint="var(--success)"
        />
        <KpiCard
          icon={ic(
            '<path d="M12 3a4 4 0 0 0-4 4h8a4 4 0 0 0-4-4z"/><path d="M6.5 7h11l2.5 12a2 2 0 0 1-2 2.4H6a2 2 0 0 1-2-2.4z"/>',
          )}
          label="Filamento usado"
          value={`${Math.round(totals.grams)} g`}
          delta={`${(totals.grams / 1000).toFixed(1)} kg`}
          tint="var(--gold)"
        />
      </div>

      <div className="dash-grid">
        <ProfitSharesEditor
          shares={shares}
          profit={totals.profit}
          canEdit={canEdit}
        />

        <div className="ui-card section-card">
          <div className="section-title mb-1">A cobrar por persona</div>
          <div className="text-faint mb-3.5 text-[12.5px]">
            Sobre {formatPrice(totals.profit)} de ganancia pura
            {periodo ? ` de ${periodo}` : " acumulada"}.
          </div>
          {payouts.length === 0 ? (
            <p className="text-dim text-sm">
              Agregá socios o cargá ventas para ver el reparto.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {payouts.map((p, i) => (
                <div
                  key={p.name}
                  className="ui-card flex items-center justify-between"
                  style={{ padding: "13px 15px" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="avatar"
                      style={{
                        width: 36,
                        height: 36,
                        fontSize: 14,
                        background: GN_COLORS[i % GN_COLORS.length],
                      }}
                    >
                      {(p.name || "?")[0]?.toUpperCase()}
                    </span>
                    <div className="text-[13.5px] font-semibold">{p.name}</div>
                  </div>
                  <b
                    className="price text-[16px]"
                    style={{ color: "var(--success)" }}
                  >
                    {formatPrice(p.amount)}
                  </b>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="ui-card section-card">
        <div className="section-title mb-3.5">Desglose por pedido cobrado</div>
        {rows.length === 0 ? (
          <p className="text-dim py-6 text-center text-sm">
            Todavía no hay pedidos entregados.
          </p>
        ) : (
          <div className="table-wrap" style={{ border: "none" }}>
            {/* En móvil se apila como tarjetas (.tbl-cards + data-label). */}
            <table className="tbl tbl-cards">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th className="text-right">Ingreso</th>
                  <th className="text-right">Amortización</th>
                  <th className="text-right">Ganancia pura</th>
                  {payouts.map((p, i) => (
                    <th
                      key={p.name}
                      className="text-right"
                      style={{ color: GN_COLORS[i % GN_COLORS.length] }}
                    >
                      {(p.name || "").split(" ")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const splitMap = new Map(
                    o.split.map((s) => [s.name, s.amount]),
                  );
                  return (
                    <tr key={o.id}>
                      <td data-label="Pedido">
                        <b>{o.orderNumber}</b>
                        <div className="text-faint text-[11.5px]">
                          {dateFmt.format(o.createdAt)}
                        </div>
                      </td>
                      <td data-label="Cliente">{o.customerName ?? "—"}</td>
                      <td className="price text-right" data-label="Ingreso">
                        {formatPrice(o.ingreso)}
                      </td>
                      <td
                        className="price text-right"
                        style={{ color: "var(--warning)" }}
                        data-label="Amortización"
                      >
                        −{formatPrice(o.amort)}
                      </td>
                      <td className="price text-right" data-label="Ganancia">
                        <b style={{ color: "var(--success)" }}>
                          {formatPrice(o.gananciaPura)}
                        </b>
                      </td>
                      {payouts.map((p, i) => (
                        <td
                          key={p.name}
                          className="price text-right"
                          data-label={(p.name || "").split(" ")[0]}
                        >
                          {splitMap.has(p.name) ? (
                            <span
                              style={{ color: GN_COLORS[i % GN_COLORS.length] }}
                            >
                              {formatPrice(splitMap.get(p.name) ?? 0)}
                            </span>
                          ) : (
                            <span className="text-faint">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} data-label="">
                    <b>Totales</b>
                  </td>
                  <td className="price text-right" data-label="Ingreso">
                    <b>{formatPrice(totals.ingreso)}</b>
                  </td>
                  <td
                    className="price text-right"
                    style={{ color: "var(--warning)" }}
                    data-label="Amortización"
                  >
                    <b>−{formatPrice(totals.amort)}</b>
                  </td>
                  <td className="price text-right" data-label="Ganancia">
                    <b style={{ color: "var(--success)" }}>
                      {formatPrice(totals.profit)}
                    </b>
                  </td>
                  {payouts.map((p, i) => (
                    <td
                      key={p.name}
                      className="price text-right"
                      data-label={(p.name || "").split(" ")[0]}
                    >
                      <b style={{ color: GN_COLORS[i % GN_COLORS.length] }}>
                        {formatPrice(p.amount)}
                      </b>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
