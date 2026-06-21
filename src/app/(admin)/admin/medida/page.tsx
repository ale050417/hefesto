import Link from "next/link";
import { requireStaff } from "@/core/auth/session";
import { formatPrice } from "@/lib/format";
import { CustomStatusBadge } from "@/features/custom/components/status-badge";
import { listAdminRequests } from "@/features/custom/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedidos a medida — Admin" };

export default async function AdminCustomPage() {
  await requireStaff();
  const requests = await listAdminRequests();

  return (
    <div className="grid gap-5">
      <div className="page-head">
        <div>
          <div className="eyebrow">Taller</div>
          <h1 className="page-title">Pedidos a medida</h1>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="ui-card text-dim p-8 text-center">
          No hay solicitudes por ahora.
        </div>
      ) : (
        <div className="ui-card overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Título</th>
                <th>Estado</th>
                <th>Cotización</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.title}</td>
                  <td>
                    <CustomStatusBadge status={r.status} />
                  </td>
                  <td>
                    {r.quotedAmount ? formatPrice(Number(r.quotedAmount)) : "—"}
                  </td>
                  <td className="text-dim">
                    {new Date(r.createdAt).toLocaleDateString("es-AR")}
                  </td>
                  <td>
                    <Link
                      href={`/admin/medida/${r.id}`}
                      className="text-[var(--gold)] hover:underline"
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
