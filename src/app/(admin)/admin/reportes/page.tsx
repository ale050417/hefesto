import Link from "next/link";
import { requirePermissionPage } from "@/core/auth/permissions";
import { ExportCsvButton } from "@/features/reports/components/export-csv-button";
import { KpiCard } from "@/features/reports/components/kpi-card";
import { MonthlyBars } from "@/features/reports/components/monthly-bars";
import { CategoryDonut } from "@/features/reports/components/category-donut";
import { getReportsOverview } from "@/features/reports/service";
import { compactPrice, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reportes" };

type SearchParams = Record<string, string | string[] | undefined>;

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

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermissionPage("reportes", "ver");
  const sp = await searchParams;
  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear - 1];
  const raw = Number(Array.isArray(sp.year) ? sp.year[0] : sp.year);
  const year = years.includes(raw) ? raw : thisYear;

  const {
    kpis,
    monthsCurrent,
    monthsPrev,
    categoryBreakdown,
    topProducts,
    bySource,
  } = await getReportsOverview(year);

  const avgTicket =
    kpis.salesCount > 0 ? Math.round(kpis.revenue / kpis.salesCount) : 0;
  const maxQty = Math.max(1, ...topProducts.map((p) => p.qty));

  const sourceTotal = bySource.storefront.revenue + bySource.manual.revenue;
  const pct = (v: number) =>
    sourceTotal > 0 ? Math.round((v / sourceTotal) * 100) : 0;

  return (
    <div className="view grid gap-5">
      <div className="page-head">
        <div>
          <div className="eyebrow">Crecimiento</div>
          <h1 className="page-title">Reportes</h1>
          <div className="page-sub">Análisis de ventas y rendimiento</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {years.map((y) => (
            <Link
              key={y}
              href={`/admin/reportes?year=${y}`}
              className={cn("chip", year === y && "active")}
            >
              {y}
            </Link>
          ))}
          <ExportCsvButton days={365} />
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard
          icon={ic(
            '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
          )}
          label={`Facturación ${year}`}
          value={compactPrice(kpis.revenue)}
          tint="#C9A84C"
        />
        <KpiCard
          icon={ic(
            '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
          )}
          label="Ticket promedio"
          value={compactPrice(avgTicket)}
          tint="#4CB782"
        />
        <KpiCard
          icon={ic(
            '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
          )}
          label="Unidades vendidas"
          value={String(kpis.unitsSold)}
          tint="#5A9CD9"
        />
        <KpiCard
          icon={ic(
            '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
          )}
          label={`Clientes nuevos ${year}`}
          value={String(kpis.newCustomers)}
          tint="#9B7BD4"
        />
      </div>

      <div className="ui-card section-card">
        <div className="section-title mb-1">Ventas por origen · {year}</div>
        <div className="text-faint mb-4 text-[12.5px]">
          Cuánto se vendió desde la tienda online vs. cargado como venta manual.
        </div>
        <div className="grid-2">
          {(
            [
              ["Tienda online", bySource.storefront, "#4CB782"],
              ["Venta manual", bySource.manual, "#C9A84C"],
            ] as const
          ).map(([label, data, color]) => (
            <div
              key={label}
              className="ui-card flex items-center justify-between"
              style={{ padding: "13px 15px" }}
            >
              <div>
                <div className="text-[13.5px] font-semibold">{label}</div>
                <div className="text-faint text-[11.5px]">
                  {data.count} ventas · {pct(data.revenue)}% del total
                </div>
              </div>
              <b className="price text-[16px]" style={{ color }}>
                {formatPrice(data.revenue)}
              </b>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <MonthlyBars
          current={monthsCurrent}
          prev={monthsPrev}
          year={year}
          prevYear={year - 1}
        />
        <CategoryDonut data={categoryBreakdown} />
      </div>

      <div className="ui-card section-card">
        <div className="section-title mb-1">Productos más vendidos</div>
        <div className="text-faint mb-4 text-[12.5px]">
          Top {topProducts.length || 6} por unidades vendidas
        </div>
        {topProducts.length === 0 ? (
          <p className="text-dim py-6 text-center text-sm">
            Sin ventas en el período.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {topProducts.map((p) => (
              <div key={p.name} className="flex items-center gap-3">
                <div className="text-fg w-44 shrink-0 truncate text-[13px]">
                  {p.name}
                </div>
                <div className="bg-surface-2 h-3 flex-1 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max((p.qty / maxQty) * 100, 3)}%`,
                      background:
                        "linear-gradient(90deg, var(--gold-deep), var(--gold-bright))",
                    }}
                  />
                </div>
                <div className="text-faint w-24 shrink-0 text-right text-[12px]">
                  {p.qty} u · {formatPrice(p.revenue)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
