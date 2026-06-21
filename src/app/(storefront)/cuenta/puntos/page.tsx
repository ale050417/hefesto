import { requireUser } from "@/core/auth/session";
import { getBalance, getHistory } from "@/features/rewards/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis puntos" };

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" });

export default async function PointsPage() {
  const user = await requireUser("/cuenta/puntos");
  const [balance, history] = await Promise.all([
    getBalance(user.id),
    getHistory(user.id),
  ]);

  return (
    <div className="grid gap-5">
      <div className="ui-card flex items-center justify-between p-6">
        <div>
          <div className="text-dim text-sm">Tu saldo de puntos</div>
          <div className="text-3xl font-semibold text-[var(--gold-bright)]">
            {balance}
          </div>
        </div>
        <p className="text-dim max-w-[16rem] text-right text-xs">
          Ganás 1 punto por cada $100 de compra. Pronto vas a poder canjearlos.
        </p>
      </div>

      <section className="ui-card p-5">
        <h2 className="text-fg font-display mb-3 text-lg">Movimientos</h2>
        {history.length === 0 ? (
          <p className="text-dim text-sm">Todavía no tenés movimientos.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {history.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="text-fg text-sm font-medium">{tx.reason}</p>
                  <p className="text-dim text-xs">
                    {dateFmt.format(new Date(tx.createdAt))}
                  </p>
                </div>
                <span
                  className={
                    tx.delta >= 0
                      ? "font-semibold text-[var(--gold-bright)]"
                      : "text-danger font-semibold"
                  }
                >
                  {tx.delta >= 0 ? "+" : ""}
                  {tx.delta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
