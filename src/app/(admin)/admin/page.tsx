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
const monthFmt = new Intl.DateTimeFormat("es-AR", { month: "long" });

function greeting(): string {
  const h = new Date().getHours();
  return h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

const fmtG = (g: number) =>
  g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${Math.round(g)} g`;

export default async function AdminDashboard() {
  const [{ recentOrders, lowStock, filamentUsage, degraded }, user] =
    await Promise.all([getDashboardData(30), getStaffUser()]);
  const firstName =
    user?.profile?.fullName?.trim().split(/\s+/)[0] || "Hefesto";
  const monthName = monthFmt.format(new Date());
  const maxUsage = Math.max(1, ...filamentUsage.map((u) => u.grams));
  const totalUsage = filamentUsage.reduce((a, u) => a + u.grams, 0);

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

      {/* Filamentos más usados del MES (2026-07-24, pedido de Ale): el consumo
          real del ledger (pedidos online + ventas manuales), TODOS los
          filamentos —también los sin uso, para comparar— con su color real y
          una barra de calor proporcional al más usado. Reemplaza a la sección
          "Consumo de filamento" que estaba en Reportes. */}
      <div className="ui-card section-card" style={{ marginBottom: 18 }}>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <div className="section-title">
            Filamentos más usados · {monthName}
          </div>
          <span className="text-faint text-[12px]">
            Total del mes: <b className="text-fg">{fmtG(totalUsage)}</b>
          </span>
        </div>
        <div className="text-faint mb-4 text-[12.5px]">
          Consumo real descontado del inventario por ventas (tienda y manuales).
          La barra compara contra el más usado del mes.
        </div>
        {filamentUsage.length === 0 ? (
          <p className="text-dim py-4 text-center text-sm">
            Todavía no hay filamentos cargados.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filamentUsage.map((u, i) => {
              const pct =
                u.grams > 0
                  ? Math.max(4, Math.round((u.grams / maxUsage) * 100))
                  : 0;
              const tone = u.hex ?? "var(--gold)";
              return (
                <div
                  key={`${u.material}-${u.color}-${i}`}
                  className="flex items-center gap-3"
                >
                  <span
                    className="shrink-0"
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: tone,
                      border: "1px solid var(--border-strong)",
                    }}
                  />
                  <span
                    className="text-fg w-40 shrink-0 truncate text-[13px]"
                    title={`${u.material} · ${u.color}`}
                  >
                    {u.material} · {u.color}
                  </span>
                  <div
                    className="h-4 flex-1 overflow-hidden rounded-full"
                    style={{ background: "var(--surface-2)" }}
                  >
                    {pct > 0 ? (
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: tone,
                          // Intensidad tipo "mapa de calor": el más usado a
                          // pleno; el resto se atenúa proporcionalmente.
                          opacity: 0.45 + 0.55 * (u.grams / maxUsage),
                        }}
                      />
                    ) : null}
                  </div>
                  <b
                    className="w-20 shrink-0 text-right text-[13px]"
                    style={{
                      color: u.grams > 0 ? "var(--fg)" : "var(--text-faint)",
                    }}
                  >
                    {u.grams > 0 ? fmtG(u.grams) : "Sin uso"}
                  </b>
                </div>
              );
            })}
          </div>
        )}
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
    </div>
  );
}
