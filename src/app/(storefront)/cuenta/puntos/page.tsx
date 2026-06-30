import { requireUser } from "@/core/auth/session";
import { AccountShell } from "@/features/customers/components/account-shell";
import { getBalance, getHistory } from "@/features/rewards/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis puntos" };

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" });

function Spark({ size = 28 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      aria-hidden
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </svg>
  );
}

export default async function PointsPage() {
  const user = await requireUser("/cuenta/puntos");
  const [balance, history] = await Promise.all([
    getBalance(user.id),
    getHistory(user.id),
  ]);

  const nextTier = balance < 2000 ? 2000 : balance < 4000 ? 4000 : 5000;
  const pct = Math.min((balance / nextTier) * 100, 100);
  const toNext = Math.max(nextTier - balance, 0);

  return (
    <AccountShell>
      <div className="flex flex-col gap-5">
        <div
          className="ui-card p-6"
          style={{
            background:
              "linear-gradient(135deg, rgba(var(--gold-rgb),.14), transparent 60%), var(--surface-1)",
            borderColor: "rgba(var(--gold-rgb),.25)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                className="grid h-16 w-16 flex-shrink-0 place-items-center rounded-2xl"
                style={{
                  background: "rgba(var(--gold-rgb),.16)",
                  color: "var(--gold-bright)",
                }}
              >
                <Spark size={28} />
              </span>
              <div>
                <div className="text-faint text-xs tracking-wider uppercase">
                  Tu saldo
                </div>
                <div
                  className="font-display leading-none font-bold"
                  style={{ fontSize: 40, color: "var(--gold-bright)" }}
                >
                  {balance}
                  <span className="text-dim text-lg"> pts</span>
                </div>
              </div>
            </div>
            <div className="min-w-[200px] text-right">
              <div className="text-faint mb-1.5 text-xs">
                Ganás <b className="text-fg">1 punto</b> por cada $100
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background:
                      "linear-gradient(90deg, var(--gold-deep), var(--gold-bright))",
                  }}
                />
              </div>
              <div className="text-faint mt-1.5 text-[11.5px]">
                {toNext} pts para tu próxima recompensa
              </div>
            </div>
          </div>
        </div>

        <section className="ui-card p-5">
          <h2 className="text-fg font-display mb-3 text-lg font-bold">
            Movimientos
          </h2>
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

        <div className="ui-card text-faint flex items-start gap-3 p-4 text-[12.5px] leading-relaxed">
          <span className="text-[var(--gold-bright)]">
            <Spark size={18} />
          </span>
          <p>
            Los puntos se acreditan automáticamente con cada compra entregada.
            Pronto vas a poder canjearlos por descuentos y productos.
          </p>
        </div>
      </div>
    </AccountShell>
  );
}
