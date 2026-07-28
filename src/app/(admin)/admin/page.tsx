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

  const [{ recentOrders, lowStock, degraded }, monthUsage, user] =
    await Promise.all([
      getDashboardData(30),
      getMonthFilamentUsage(monthKey).catch(() => []),
      getStaffUser(),
    ]);
  const firstName =
    user?.profile?.fullName?.trim().split(/\s+/)[0] || "Hefesto";

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
      </div>

      {/* Últimos pedidos PRIMERO (2026-07-24); el consumo del mes es una
          tarjeta chica más, del tamaño de las alertas. */}
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
                    {/* Qué se pidió (no el código HEF-XXX). El número y la fecha
                        van chicos debajo, para identificar el pedido si hace falta. */}
                    <b className="text-fg block truncate">
                      {o.itemsSummary || o.orderNumber}
                    </b>
                    <span className="text-faint text-xs">
                      {o.orderNumber} · {dateFmt.format(new Date(o.createdAt))}
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
