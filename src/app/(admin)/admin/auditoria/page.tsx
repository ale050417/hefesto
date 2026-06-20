import { listRecentAudit } from "@/core/audit";

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
  const entries = await listRecentAudit(100);

  return (
    <div>
      <p className="eyebrow">Seguridad</p>
      <h1 className="font-display text-fg mt-1 text-2xl">Auditoría</h1>
      <p className="text-dim mt-1 text-sm">
        Registro de las acciones sensibles del equipo.
      </p>

      <div className="border-surface-2 mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-dim text-left text-xs">
            <tr>
              <th className="p-3 font-medium">Fecha</th>
              <th className="p-3 font-medium">Quién</th>
              <th className="p-3 font-medium">Acción</th>
              <th className="p-3 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-dim p-6 text-center">
                  Todavía no hay registros.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="border-surface-2 border-t">
                  <td className="text-dim p-3 whitespace-nowrap">
                    {dateFmt.format(e.createdAt)}
                  </td>
                  <td className="text-fg p-3">{e.actorName ?? "—"}</td>
                  <td className="text-fg p-3">
                    {ACTION_LABEL[e.action] ?? e.action}
                  </td>
                  <td className="text-faint p-3 text-xs">
                    {e.metadata ? JSON.stringify(e.metadata) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
