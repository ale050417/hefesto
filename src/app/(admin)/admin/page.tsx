import type { ReactNode } from "react";
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
const longDateFmt = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const P: Record<string, ReactNode> = {
  dollar: (
    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  ),
  chart: <path d="M3 3v18h18M7 14l4-4 3 3 5-6" />,
  cart: (
    <>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
    </>
  ),
  layers: <path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5" />,
  download: (
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  ),
  plus: <path d="M12 5v14M5 12h14" />,
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {P[name]}
    </svg>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

export default async function AdminDashboard() {
  const { kpis, revenueSeries, recentOrders, lowStock } =
    await getDashboardData(30);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Panel de gestión</div>
          <h1 className="page-title">{greeting()}, Hefesto</h1>
          <div className="page-sub">
            Resumen de tu operación · {longDateFmt.format(new Date())}
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/reportes"
            prefetch={false}
            className="btn btn-secondary"
          >
            <Icon name="download" size={16} /> Exportar
          </Link>
          <Link
            href="/admin/productos/nuevo"
            prefetch={false}
            className="btn btn-primary"
          >
            <Icon name="plus" size={16} /> Nuevo producto
          </Link>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 18 }}>
        <KpiCard
          icon={<Icon name="dollar" />}
          label="Ingresos · 30 días"
          value={formatPrice(kpis.revenue)}
          tint="var(--gold)"
        />
        <KpiCard
          icon={<Icon name="chart" />}
          label="Ventas"
          value={String(kpis.salesCount)}
          tint="var(--success)"
        />
        <KpiCard
          icon={<Icon name="cart" />}
          label="Pedidos pendientes"
          value={String(kpis.pendingCount)}
          tint="var(--gold)"
        />
        <KpiCard
          icon={<Icon name="layers" />}
          label="Filamentos bajo stock"
          value={String(kpis.lowStockCount)}
          tint="var(--gold)"
        />
      </div>

      <div className="dash-grid">
        <div className="ui-card section-card">
          <div className="mb-2 flex items-start justify-between">
            <div>
              <div className="section-title">Ingresos · últimos 30 días</div>
              <div className="text-faint mt-1 text-[12.5px]">
                Total{" "}
                <b className="text-[var(--gold-bright)]">
                  {formatPrice(kpis.revenue)}
                </b>{" "}
                · promedio diario {formatPrice(Math.round(kpis.revenue / 30))}
              </div>
            </div>
          </div>
          <RevenueChart data={revenueSeries} />
        </div>

        <div className="ui-card section-card">
          <div className="mb-3.5 flex items-center justify-between">
            <div className="section-title">Últimos pedidos</div>
            <Link
              href="/admin/pedidos"
              prefetch={false}
              className="btn btn-ghost btn-sm"
            >
              Ver todos →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-dim text-sm">Sin pedidos aún.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentOrders.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/pedidos/${o.id}`}
                  prefetch={false}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-3 text-sm transition hover:border-[var(--gold)]"
                >
                  <span className="min-w-0">
                    <b>{o.orderNumber}</b>
                    <span className="text-faint ml-2 text-xs">
                      {dateFmt.format(new Date(o.createdAt))}
                    </span>
                  </span>
                  <Badge variant={ORDER_STATUS_VARIANT[o.status]}>
                    {ORDER_STATUS_LABEL[o.status]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {lowStock.length > 0 ? (
            <div className="mt-5">
              <div className="section-title mb-3">Alertas de stock</div>
              <div className="flex flex-col gap-2">
                {lowStock.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-dim">
                      {f.material} · {f.color}
                    </span>
                    <Badge variant="warning">{f.stockGrams} g</Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
