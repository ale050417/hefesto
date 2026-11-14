import { requirePermissionPage } from "@/core/auth/permissions";
import { listRecentAudit } from "@/core/audit";
import { labelOf } from "@/core/audit/labels";
import { DegradedNotice } from "@/components/shared/degraded-notice";
import { ORDER_STATUS_LABEL } from "@/features/orders/constants";
import { safeLoad } from "@/lib/safe-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Auditoría" };

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
});

/** Claves habituales del detalle → texto en castellano (2026-10-21). */
const KEY_LABEL: Record<string, string> = {
  total: "Total",
  customer: "Cliente",
  status: "Estado",
  name: "Nombre",
  count: "Cantidad",
  reason: "Motivo",
  grams: "Gramos",
  orderNumber: "Pedido",
  email: "Email",
};
const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
function formatValue(k: string, v: unknown): string {
  if (typeof v === "object") return JSON.stringify(v);
  if (k === "total" && Number.isFinite(Number(v)))
    return money.format(Number(v));
  if (k === "status" && typeof v === "string")
    return (ORDER_STATUS_LABEL as Record<string, string>)[v] ?? v;
  return String(v);
}

/** Muestra el detalle en texto legible (el nombre afectado), no JSON crudo. */
function formatDetail(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "—";
  const m = meta as Record<string, unknown>;
  if (typeof m.name === "string" && m.name.trim()) return m.name;
  const parts = Object.entries(m)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${KEY_LABEL[k] ?? k}: ${formatValue(k, v)}`);
  return parts.length ? parts.join(" · ") : "—";
}

export default async function AuditoriaPage() {
  await requirePermissionPage("auditoria", "ver");
  // Carga acotada: si la base se traba, la página avisa en vez de colgarse
  // ("Connection closed" / stream cortado a los 30 s, bug 2026-07-11).
  const entriesR = await safeLoad("auditoría", listRecentAudit(100), []);
  const entries = entriesR.value;

  return (
    <div>
      <DegradedNotice
        sources={entriesR.ok ? [] : ["el registro de auditoría"]}
      />
      <div className="page-head">
        <div>
          <div className="eyebrow">Seguridad</div>
          <h1 className="page-title">Auditoría</h1>
          <div className="page-sub">
            Registro de las acciones sensibles del equipo.
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="ui-card text-dim p-10 text-center text-sm">
          Todavía no hay registros.
        </div>
      ) : (
        <div className="ui-card overflow-hidden">
          <div className="table-wrap" style={{ border: "none" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Quién</th>
                  <th>Acción</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="text-dim whitespace-nowrap">
                      {dateFmt.format(e.createdAt)}
                    </td>
                    <td className="text-fg">{e.actorName ?? "—"}</td>
                    <td className="text-fg">{labelOf(e.action)}</td>
                    <td className="text-faint text-xs">
                      {formatDetail(e.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
