import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
} from "@/features/orders/constants";
import { KpiCard } from "@/features/reports/components/kpi-card";
import { RevenueChart } from "@/features/reports/components/revenue-chart";
import { getDashboardData } from "@/features/reports/service";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Panel" };

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "short" });

const quickLinks = [
  { href: "/admin/productos", label: "Productos" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/filamentos", label: "Filamentos" },
  { href: "/admin/descuentos", label: "Descuentos" },
  { href: "/admin/reportes", label: "Reportes" },
];

export default async function AdminDashboard() {
  const { kpis, revenueSeries, recentOrders, lowStock } =
    await getDashboardData(30);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Panel</div>
          <h1 className="page-title">Dashboard</h1>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Ingresos" value={formatPrice(kpis.revenue)} />
        <KpiCard label="Ventas" value={String(kpis.salesCount)} />
        <KpiCard label="Pendientes de pago" value={String(kpis.pendingCount)} />
        <KpiCard
          label="Filamentos bajo stock"
          value={String(kpis.lowStockCount)}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <RevenueChart data={revenueSeries} />

        <aside className="space-y-4">
          <div className="ui-card p-4">
            <h3 className="text-fg font-display mb-3 text-sm">
              Últimos pedidos
            </h3>
            {recentOrders.length === 0 ? (
              <p className="text-dim text-sm">Sin pedidos aún.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {recentOrders.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <Link
                      href={`/admin/pedidos/${o.id}`}
                      className="text-dim hover:text-fg truncate"
                    >
                      {o.orderNumber} · {dateFmt.format(o.createdAt)}
                    </Link>
                    <Badge variant={ORDER_STATUS_VARIANT[o.status]}>
                      {ORDER_STATUS_LABEL[o.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {lowStock.length > 0 ? (
            <div className="ui-card p-4">
              <h3 className="text-fg font-display mb-3 text-sm">
                Alertas de stock
              </h3>
              <ul className="space-y-2 text-sm">
                {lowStock.map((f) => (
                  <li key={f.id} className="flex items-center justify-between">
                    <span className="text-dim">
                      {f.material} · {f.color}
                    </span>
                    <Badge variant="warning">{f.stockGrams} g</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {quickLinks.map((q) => (
          <Link key={q.href} href={q.href} className="chip">
            {q.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
