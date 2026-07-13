import type { ReactNode } from "react";
import Link from "next/link";
import { DegradedNotice } from "@/components/shared/degraded-notice";
import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
} from "@/features/orders/constants";
import { getDashboardData } from "@/features/reports/service";
import { getStaffUser } from "@/core/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Panel" };

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "short" });
const longDateFmt = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const P: Record<string, ReactNode> = {
  cart: (
    <>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
    </>
  ),
  box: <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />,
  layers: <path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5" />,
  alert: (
    <>
      <path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  chart: <path d="M3 3v18h18M7 14l4-4 3 3 5-6" />,
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </>
  ),
  tag: (
    <>
      <path d="M20.6 13.4 12 22l-9-9V3h10z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
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
  const [{ kpis, recentOrders, lowStock, degraded }, user] = await Promise.all([
    getDashboardData(30),
    getStaffUser(),
  ]);
  const firstName =
    user?.profile?.fullName?.trim().split(/\s+/)[0] || "Hefesto";

  // Las cards del panel son ACCESOS DIRECTOS a cada sección (las métricas viven
  // en Reportes). Algunas muestran un contador accionable (no una métrica).
  const nav: Array<{
    href: string;
    label: string;
    icon: string;
    badge?: { value: number; label: string };
  }> = [
    {
      href: "/admin/pedidos",
      label: "Pedidos",
      icon: "cart",
      ...(kpis.pendingCount > 0
        ? { badge: { value: kpis.pendingCount, label: "pendientes" } }
        : {}),
    },
    { href: "/admin/productos", label: "Productos", icon: "box" },
    {
      href: "/admin/filamentos",
      label: "Filamentos",
      icon: "layers",
      ...(kpis.lowStockCount > 0
        ? { badge: { value: kpis.lowStockCount, label: "bajo stock" } }
        : {}),
    },
    { href: "/admin/fallas", label: "Impresiones fallidas", icon: "alert" },
    { href: "/admin/reportes", label: "Reportes", icon: "chart" },
    { href: "/admin/clientes", label: "Clientes", icon: "users" },
    { href: "/admin/categorias", label: "Categorías", icon: "grid" },
    { href: "/admin/descuentos", label: "Descuentos", icon: "tag" },
    { href: "/admin/configuracion", label: "Configuración", icon: "gear" },
  ];

  return (
    <div>
      <DegradedNotice sources={degraded} />
      <div className="page-head">
        <div>
          <div className="eyebrow">Panel de gestión</div>
          <h1 className="page-title">
            {greeting()}, {firstName}
          </h1>
          <div className="page-sub">{longDateFmt.format(new Date())}</div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/productos/nuevo"
            prefetch={false}
            className="btn btn-primary"
          >
            <Icon name="plus" size={16} /> Nuevo producto
          </Link>
        </div>
      </div>

      {/* Accesos directos a las secciones */}
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          marginBottom: 18,
        }}
      >
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            prefetch={false}
            className="ui-card flex items-center gap-3 p-4 transition hover:border-[var(--gold)]"
          >
            <span
              className="kpi-ic"
              style={{
                background: "rgba(var(--gold-rgb),.14)",
                color: "var(--gold)",
                width: 40,
                height: 40,
                flexShrink: 0,
              }}
            >
              <Icon name={n.icon} size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-fg block text-[14px] font-semibold">
                {n.label}
              </span>
              {n.badge ? (
                <span className="text-[12px] text-[var(--gold-bright)]">
                  {n.badge.value} {n.badge.label}
                </span>
              ) : (
                <span className="text-faint text-[12px]">Ir a la sección</span>
              )}
            </span>
            {/* Flecha a la derecha, centrada: antes iba en el texto ("→") y en
                celular caía sola abajo. */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-faint flex-shrink-0"
              aria-hidden
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        ))}
      </div>

      <div className="dash-grid">
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
        </div>

        <div className="ui-card section-card">
          <div className="mb-3.5 flex items-center justify-between">
            <div className="section-title">Alertas de stock</div>
            <Link
              href="/admin/filamentos"
              prefetch={false}
              className="btn btn-ghost btn-sm"
            >
              Ver filamentos →
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-dim text-sm">Todo el stock está en orden. ✓</p>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
