import Link from "next/link";
import { ExportCsvButton } from "@/features/reports/components/export-csv-button";
import { RevenueChart } from "@/features/reports/components/revenue-chart";
import { getReportsData } from "@/features/reports/service";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reportes" };

type SearchParams = Record<string, string | string[] | undefined>;
const RANGES = [7, 30, 90];

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const raw = Number(Array.isArray(sp.dias) ? sp.dias[0] : sp.dias);
  const days = RANGES.includes(raw) ? raw : 30;

  const { revenueSeries, topProducts, categoryBreakdown } =
    await getReportsData(days);
  const maxCat = Math.max(1, ...categoryBreakdown.map((c) => c.revenue));

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Análisis</div>
          <h1 className="page-title">Reportes</h1>
        </div>
        <ExportCsvButton days={days} />
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r}
            href={`/admin/reportes?dias=${r}`}
            className={cn("chip", days === r && "active")}
          >
            {r} días
          </Link>
        ))}
      </div>

      <RevenueChart data={revenueSeries} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="ui-card p-5">
          <h3 className="text-fg font-display mb-3 text-sm">Top productos</h3>
          {topProducts.length === 0 ? (
            <p className="text-dim text-sm">Sin ventas en el período.</p>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="text-right">Unid.</th>
                  <th className="text-right">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.name}>
                    <td className="text-fg">{p.name}</td>
                    <td className="text-dim text-right">{p.qty}</td>
                    <td className="text-fg text-right">
                      {formatPrice(p.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="ui-card p-5">
          <h3 className="text-fg font-display mb-3 text-sm">
            Ingresos por categoría
          </h3>
          {categoryBreakdown.length === 0 ? (
            <p className="text-dim text-sm">Sin datos.</p>
          ) : (
            <ul className="space-y-3">
              {categoryBreakdown.map((c) => (
                <li key={c.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-dim">{c.name}</span>
                    <span className="text-fg">{formatPrice(c.revenue)}</span>
                  </div>
                  <div className="bg-surface-2 h-2 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(c.revenue / maxCat) * 100}%`,
                        background:
                          "linear-gradient(90deg, var(--gold-bright), var(--gold-deep))",
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
