import Link from "next/link";
import { DegradedNotice } from "@/components/shared/degraded-notice";
import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
} from "@/features/orders/constants";
import { FilamentUsageCard } from "@/features/reports/components/filament-usage-card";
import {
  getDashboardData,
  getMonthFilamentUsage,
} from "@/features/reports/service";
import { getStaffUser } from "@/core/auth/session";
import { getBrandSettings } from "@/features/settings/service";
import { compactPrice } from "@/lib/format";
import { Sparkline } from "@/components/shared/sparkline";

export const dynamic = "force-dynamic";
export const metadata = { title: "Panel" };

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "short" });
const longDateFmt = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
function greeting(): string {
  const h = new Date().getHours();
  return h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

// Aviso de "datos incompletos" (DegradedNotice) apagado a pedido de Ale
// (2026-07-29): el timeout de safeLoad se disparaba seguido en cargas frías
// del panel (8 queries vs. pool de 2 conexiones) y molestaba más de lo que
// ayudaba. La resiliencia de fondo (safeLoad) sigue intacta — esto solo
// apaga el cartel visual. Reactivar: pasar esto a `true` cuando Ale lo pida.
const SHOW_DEGRADED_NOTICE = false;

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Mes del widget de filamentos: ?mes=YYYY-MM (sin param = mes actual, así
  // al cambiar el calendario el widget arranca limpio solo).
  const sp = await searchParams;
  const rawMes = Array.isArray(sp.mes) ? sp.mes[0] : sp.mes;
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthKey = /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMes ?? "")
    ? (rawMes as string)
    : currentKey;

  const [
    { recentOrders, lowStock, degraded, kpis, revenueSeries, statusCounts },
    monthUsage,
    user,
    brand,
  ] = await Promise.all([
    getDashboardData(30),
    getMonthFilamentUsage(monthKey).catch(() => []),
    getStaffUser(),
    getBrandSettings(),
  ]);
  const firstName =
    user?.profile?.fullName?.trim().split(/\s+/)[0] || "Hefesto";
  // Vidriera digital: "Últimos pedidos" es SIEMPRE de venta online (nunca
  // muestra ventas manuales) — en este modo estaría vacío o mostraría
  // pedidos viejos, así que se esconde. El resto del panel (stock, consumo
  // de filamento, ventas manuales) sigue funcionando igual (Ale, 2026-08-09).
  const isVidriera = brand.businessMode === "vidriera";

  // Resumen de arriba (2026-10-21, rediseño del inicio): ventas de los
  // últimos 30 días con su curva, pendientes de pago, en producción y stock
  // bajo. Cada tarjeta lleva a su sección.
  const last30 = revenueSeries.reduce((acc, p) => acc + p.total, 0);
  const last7 = revenueSeries.slice(-7).reduce((acc, p) => acc + p.total, 0);
  const inProduction =
    (statusCounts.confirmed ?? 0) + (statusCounts.in_production ?? 0);
  const ready = statusCounts.ready ?? 0;
  const quick: Array<{
    href: string;
    label: string;
    hint: string;
    icon: string;
    primary?: boolean;
  }> = [
    {
      href: "/admin/productos/nuevo",
      label: "Nuevo producto",
      hint: "Con foto con IA",
      icon: "M12 5v14M5 12h14",
      primary: true,
    },
    {
      href: "/admin/pedidos",
      label: "Cargar venta",
      hint: "Venta manual",
      icon: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0",
    },
    {
      href: "/admin/produccion",
      label: "Cola de impresión",
      hint: inProduction > 0 ? `${inProduction} en curso` : "Tablero por etapa",
      icon: "M6 9V3h12v6M6 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1M7 14h10v7H7z",
    },
    {
      href: "/admin/fallas",
      label: "Registrar falla",
      hint: "Descuenta filamento",
      icon: "M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
    },
    {
      href: "/admin/calculadora",
      label: "Calculadora 3D",
      hint: "Presupuestar",
      icon: "M4 2h16v20H4zM8 6h8M8 10h2M12 10h2M8 14h2M12 14h2M8 18h2M12 18h2",
    },
  ];

  return (
    <div>
      {SHOW_DEGRADED_NOTICE && <DegradedNotice sources={degraded} />}
      <div className="page-head dash-head">
        <div>
          <div className="eyebrow">Panel de gestión</div>
          <h1 className="page-title">
            {greeting()}, {firstName}
          </h1>
          <div className="page-sub">{longDateFmt.format(new Date())}</div>
        </div>
        {/* Accesos rápidos: lo que se hace todos los días, a un toque. */}
        <nav className="quick-actions" aria-label="Accesos rápidos">
          {quick.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              prefetch={false}
              className={a.primary ? "qa is-primary" : "qa"}
            >
              <span className="qa-ic" aria-hidden>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={a.icon} />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="qa-label">{a.label}</span>
                <span className="qa-hint">{a.hint}</span>
              </span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Resumen: cuatro números que dicen cómo viene el negocio hoy. */}
      <div className="kpi-grid dash-kpis">
        <Link
          href="/admin/reportes"
          prefetch={false}
          className="ui-card kpi kpi-link"
        >
          <div className="kpi-top">
            <div className="kpi-ic">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <span className="kpi-delta">últimos 30 días</span>
          </div>
          <div className="kpi-val">{compactPrice(last30)}</div>
          <div className="kpi-label">
            Vendido · {compactPrice(last7)} esta semana
          </div>
          <Sparkline
            values={revenueSeries.map((p) => p.total)}
            className="kpi-spark"
          />
        </Link>
        <Link
          href="/admin/pedidos"
          prefetch={false}
          className="ui-card kpi kpi-link"
        >
          <div className="kpi-top">
            <div className="kpi-ic is-warn">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </div>
            <span className="kpi-delta">a cobrar</span>
          </div>
          <div className="kpi-val">{statusCounts.pending_payment ?? 0}</div>
          <div className="kpi-label">Pedidos pendientes de pago</div>
        </Link>
        <Link
          href="/admin/produccion"
          prefetch={false}
          className="ui-card kpi kpi-link"
        >
          <div className="kpi-top">
            <div className="kpi-ic is-info">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9V3h12v6M6 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1" />
                <rect x="7" y="14" width="10" height="7" rx="1" />
              </svg>
            </div>
            <span className="kpi-delta">
              {ready > 0 ? `${ready} para entregar` : "en el tablero"}
            </span>
          </div>
          <div className="kpi-val">{inProduction}</div>
          <div className="kpi-label">Confirmados o en producción</div>
        </Link>
        <Link
          href="/admin/filamentos"
          prefetch={false}
          className="ui-card kpi kpi-link"
        >
          <div className="kpi-top">
            <div
              className={
                kpis.lowStockCount > 0 ? "kpi-ic is-danger" : "kpi-ic is-ok"
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="3.2" />
              </svg>
            </div>
            <span className="kpi-delta">
              {kpis.lowStockCount > 0 ? "reponer" : "todo en orden"}
            </span>
          </div>
          <div className="kpi-val">{kpis.lowStockCount}</div>
          <div className="kpi-label">Filamentos con stock bajo</div>
        </Link>
      </div>

      <div className={isVidriera ? undefined : "dash-grid"}>
        {!isVidriera ? (
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
                      {/* Qué se pidió (no el código HEF-XXX). El número y la fecha
                          van chicos debajo, para identificar el pedido si hace falta. */}
                      <b className="text-fg block truncate">
                        {o.itemsSummary || o.orderNumber}
                      </b>
                      <span className="text-faint text-xs">
                        {o.orderNumber} ·{" "}
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
        ) : null}

        {/* Alertas de stock GRÁFICAS (2026-07-24): barra de lo que queda del
            carrete con el color real del filamento; en rojo si quedó negativo. */}
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
            <div className="flex flex-col gap-3">
              {lowStock.map((f) => {
                const spool = f.spoolGrams > 0 ? f.spoolGrams : 1000;
                const owed = f.stockGrams < 0;
                const pct = owed
                  ? 100
                  : Math.min(
                      100,
                      Math.max(3, Math.round((f.stockGrams / spool) * 100)),
                    );
                const tone = f.hex ?? "var(--gold)";
                return (
                  <div key={f.id}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="text-fg flex min-w-0 items-center gap-2">
                        <span
                          className="shrink-0"
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: tone,
                            border: "1px solid var(--border-strong)",
                          }}
                        />
                        <span className="truncate">
                          {f.material} · {f.color}
                        </span>
                      </span>
                      <b
                        className="shrink-0 text-[13px]"
                        style={{
                          color: owed ? "var(--danger)" : "var(--warning)",
                        }}
                      >
                        {owed
                          ? `Debés ${Math.abs(f.stockGrams)} g`
                          : `${f.stockGrams} g`}
                      </b>
                    </div>
                    <div
                      className="h-2.5 overflow-hidden rounded-full"
                      style={{ background: "var(--surface-2)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: owed ? "var(--danger)" : tone,
                        }}
                      />
                    </div>
                    <div className="text-faint mt-0.5 text-[11px]">
                      {owed
                        ? "Se vendió más de lo que había: reponé para cubrirlo."
                        : `Aviso desde ${f.alertThresholdGrams} g · carrete de ${spool} g`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Filamentos más usados: ANCHO COMPLETO debajo (3ª versión), solo los
          usados, orden fijo del más usado, selector de mes. */}
      <div style={{ marginTop: 18 }}>
        <FilamentUsageCard rows={monthUsage} selectedMonth={monthKey} />
      </div>
    </div>
  );
}
