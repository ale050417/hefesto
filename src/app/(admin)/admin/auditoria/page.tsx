import { requirePermissionPage } from "@/core/auth/permissions";
import { listRecentAudit } from "@/core/audit";
import { DegradedNotice } from "@/components/shared/degraded-notice";
import { ORDER_STATUS_LABEL } from "@/features/orders/constants";
import { safeLoad } from "@/lib/safe-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Auditoría" };

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
});

const ACTION_LABEL: Record<string, string> = {
  "order.status_changed": "Cambió estado de pedido",
  "order.meta_updated": "Editó datos de pedido",
  "product.created": "Creó un producto",
  "product.updated": "Editó un producto",
  "product.deleted": "Borró un producto",
  "category.created": "Creó una categoría",
  "category.updated": "Editó una categoría",
  "category.deleted": "Borró una categoría",
  "coupon.created": "Creó un cupón",
  "coupon.updated": "Editó un cupón",
  "coupon.deleted": "Borró un cupón",
  "reward.created": "Creó una recompensa",
  "reward.updated": "Editó una recompensa",
  "reward.deleted": "Borró una recompensa",
  "settings.updated": "Cambió la configuración",
  // Faltaban (se veían crudas, ej. "manual_sale.created"; 2026-10-21).
  "order.deleted": "Borró un pedido",
  "order.bulk_deleted": "Borró varios pedidos",
  "manual_sale.created": "Cargó una venta manual",
  "manual_sale.updated": "Editó una venta manual",
  "manual_sale.deleted": "Borró una venta manual",
  "manual_sale.imported": "Importó ventas manuales",
  "manual_sale.status_changed": "Cambió estado de venta manual",
  "sales.bulk_deleted": "Borró varias ventas",
  "product.published": "Publicó un producto",
  "product.archived": "Archivó un producto",
  "inventory.failure_registered": "Registró una impresión fallida",
  "inventory.failure_deleted": "Borró una impresión fallida",
  "inventory.order_deduct_failed": "Falló el descuento de stock de un pedido",
  "inventory.order_deduct_partial": "Descuento de stock parcial en un pedido",
  "inventory.order_restore_failed": "Falló la reposición de stock de un pedido",
  "inventory.manual_sale_deduct_failed":
    "Falló el descuento de stock de una venta manual",
  "inventory.manual_sale_no_deduct": "Venta manual sin descuento de stock",
  "team.invite_resent": "Reenvió una invitación al equipo",
};

/** Clave desconocida → texto legible igual ("order.x_y" → "Order: x y"). */
function labelOf(action: string): string {
  const known = ACTION_LABEL[action];
  if (known) return known;
  const [scope, ...rest] = action.split(".");
  const verb = rest.join(" ").replace(/_/g, " ");
  const head = (scope ?? action).replace(/_/g, " ");
  return `${head.charAt(0).toUpperCase()}${head.slice(1)}${verb ? `: ${verb}` : ""}`;
}

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
