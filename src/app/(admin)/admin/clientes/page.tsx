import Link from "next/link";
import { requireStaff } from "@/core/auth/session";
import { formatPrice } from "@/lib/format";
import { getCustomersList } from "@/features/customers/admin/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clientes — Admin" };

export default async function AdminCustomersPage() {
  await requireStaff();
  const customers = await getCustomersList();

  return (
    <div className="grid gap-5">
      <div className="page-head">
        <div>
          <div className="eyebrow">Gente</div>
          <h1 className="page-title">Clientes</h1>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="ui-card text-dim p-8 text-center">
          Todavía no hay clientes registrados.
        </div>
      ) : (
        <div className="ui-card table-wrap" style={{ border: "none" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Pedidos</th>
                <th className="text-right">Gastado</th>
                <th>Desde</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.fullName ?? "Sin nombre"}</td>
                  <td className="text-dim">{c.phone ?? "—"}</td>
                  <td>{c.orderCount}</td>
                  <td className="text-right">{formatPrice(c.totalSpent)}</td>
                  <td className="text-dim">
                    {new Date(c.createdAt).toLocaleDateString("es-AR")}
                  </td>
                  <td>
                    <Link
                      href={`/admin/clientes/${c.id}`}
                      className="text-[var(--gold-bright)] hover:underline"
                    >
                      Ver ficha
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
