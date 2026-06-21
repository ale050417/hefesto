import Link from "next/link";
import { requireUser } from "@/core/auth/session";
import { formatPrice } from "@/lib/format";
import { RequestForm } from "@/features/custom/components/request-form";
import { CustomStatusBadge } from "@/features/custom/components/status-badge";
import { listCustomerRequests } from "@/features/custom/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedidos a medida" };

export default async function CustomRequestsPage() {
  const user = await requireUser("/cuenta/a-medida");
  const requests = await listCustomerRequests(user.id);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Mis solicitudes</h2>
        {requests.length === 0 ? (
          <div className="ui-card text-dim p-8 text-center">
            Todavía no pediste nada a medida. Contanos tu idea →
          </div>
        ) : (
          <ul className="grid gap-3">
            {requests.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/cuenta/a-medida/${r.id}`}
                  className="ui-card flex items-center justify-between gap-3 p-4 transition hover:border-[var(--gold)]"
                >
                  <div>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-dim line-clamp-1 text-sm">
                      {r.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <CustomStatusBadge status={r.status} />
                    {r.quotedAmount ? (
                      <span className="text-sm font-semibold text-[var(--gold)]">
                        {formatPrice(Number(r.quotedAmount))}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="grid gap-3">
        <h2 className="text-lg font-semibold">Pedí un presupuesto</h2>
        <RequestForm />
      </aside>
    </div>
  );
}
