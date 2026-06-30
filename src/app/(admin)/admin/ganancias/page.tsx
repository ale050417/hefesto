import { can, requirePermissionPage } from "@/core/auth/permissions";
import { KpiCard } from "@/features/reports/components/kpi-card";
import { CostSettingsButton } from "@/features/earnings/components/cost-settings-button";
import { EarningsMonthFilter } from "@/features/earnings/components/month-filter";
import { ProfitSharesEditor } from "@/features/earnings/components/profit-shares-editor";
import { GN_COLORS } from "@/features/earnings/constants";
import { getEarningsOverview } from "@/features/earnings/service";
import { compactPrice, formatPrice } from "@/lib/format";

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
  const { settings, shares, rows, totals, months, selectedMonth } =
    await getEarningsOverview(first(sp.mes));

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
          tint="#5A9CD9"
        />
        <KpiCard
          icon={ic(
            '<path d="M12 2 2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
          )}
          label="Amortización (costos)"
          value={compactPrice(totals.amort)}
          delta="material+luz+máquina"
          up={false}
          tint="#D9A441"
        />
        <KpiCard
          icon={ic('<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>')}
          label="Ganancia pura"
          value={compactPrice(totals.profit)}
          delta={`${pctProfit}% del ingreso`}
          tint="#4CB782"
        />
        <KpiCard
          icon={ic(
            '<path d="M12 3a4 4 0 0 0-4 4h8a4 4 0 0 0-4-4z"/><path d="M6.5 7h11l2.5 12a2 2 0 0 1-2 2.4H6a2 2 0 0 1-2-2.4z"/>',
          )}
          label="Filamento usado"
          value={`${Math.round(totals.grams)} g`}
          delta={`${(totals.grams / 1000).toFixed(1)} kg`}
          tint="#9B7BD4"
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
          {shares.length === 0 ? (
            <p className="text-dim text-sm">
              Agregá socios para ver el reparto.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {shares.map((s, i) => (
                <div
                  key={s.id}
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
                      {(s.name || "?")[0]?.toUpperCase()}
                    </span>
                    <div>
                      <div className="text-[13.5px] font-semibold">
                        {s.name}
                      </div>
                      <div className="text-faint text-[11.5px]">
                        {s.role ?? "—"} · {Number(s.pct)}%
                      </div>
                    </div>
                  </div>
                  <b
                    className="price text-[16px]"
                    style={{ color: "var(--success)" }}
                  >
                    {formatPrice((totals.profit * Number(s.pct)) / 100)}
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
            <table className="tbl">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th className="text-right">Ingreso</th>
                  <th className="text-right">Amortización</th>
                  <th className="text-right">Ganancia pura</th>
                  {shares.map((s, i) => (
                    <th
                      key={s.id}
                      className="text-right"
                      style={{ color: GN_COLORS[i % GN_COLORS.length] }}
                    >
                      {(s.name || "").split(" ")[0]}{" "}
                      <span style={{ opacity: 0.7 }}>{Number(s.pct)}%</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <b>{o.orderNumber}</b>
                      <div className="text-faint text-[11.5px]">
                        {dateFmt.format(o.createdAt)}
                      </div>
                    </td>
                    <td>{o.customerName ?? "—"}</td>
                    <td className="price text-right">
                      {formatPrice(o.ingreso)}
                    </td>
                    <td
                      className="price text-right"
                      style={{ color: "var(--warning)" }}
                    >
                      −{formatPrice(o.amort)}
                    </td>
                    <td className="price text-right">
                      <b style={{ color: "var(--success)" }}>
                        {formatPrice(o.gananciaPura)}
                      </b>
                    </td>
                    {shares.map((s, i) => (
                      <td key={s.id} className="price text-right">
                        <span
                          style={{ color: GN_COLORS[i % GN_COLORS.length] }}
                        >
                          {formatPrice((o.gananciaPura * Number(s.pct)) / 100)}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>
                    <b>Totales</b>
                  </td>
                  <td className="price text-right">
                    <b>{formatPrice(totals.ingreso)}</b>
                  </td>
                  <td
                    className="price text-right"
                    style={{ color: "var(--warning)" }}
                  >
                    <b>−{formatPrice(totals.amort)}</b>
                  </td>
                  <td className="price text-right">
                    <b style={{ color: "var(--success)" }}>
                      {formatPrice(totals.profit)}
                    </b>
                  </td>
                  {shares.map((s, i) => (
                    <td key={s.id} className="price text-right">
                      <b style={{ color: GN_COLORS[i % GN_COLORS.length] }}>
                        {formatPrice((totals.profit * Number(s.pct)) / 100)}
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
