import { requirePermissionPage } from "@/core/auth/permissions";
import { listRecentAudit } from "@/core/audit";
import { DegradedNotice } from "@/components/shared/degraded-notice";
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
};

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
                    <td className="text-fg">
                      {ACTION_LABEL[e.action] ?? e.action}
                    </td>
                    <td className="text-faint text-xs">
                      {e.metadata ? JSON.stringify(e.metadata) : "—"}
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
