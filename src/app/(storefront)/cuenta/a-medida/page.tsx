import Link from "next/link";
import { requireUser } from "@/core/auth/session";
import { CUSTOM_ORDERS_ENABLED } from "@/features/custom/config";
import { UnderConstruction } from "@/components/shared/under-construction";
import { AppError } from "@/core/errors";
import { formatPrice } from "@/lib/format";
import { AccountShell } from "@/features/customers/components/account-shell";
import { RequestForm } from "@/features/custom/components/request-form";
import { ChatThread } from "@/features/custom/components/chat-thread";
import { ApproveQuote } from "@/features/custom/components/approve-quote";
import { CustomStatusBadge } from "@/features/custom/components/status-badge";
import {
  getRequestWithMessages,
  listCustomerRequests,
} from "@/features/custom/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedidos a medida" };

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  const x = Array.isArray(v) ? v[0] : v;
  return x && x !== "" ? x : undefined;
}

function Spark({ size = 18 }: { size?: number }) {
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

export default async function CustomRequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser("/cuenta/a-medida");
  if (!CUSTOM_ORDERS_ENABLED) {
    return (
      <AccountShell>
        <UnderConstruction
          title="Pedidos a medida"
          description="Estamos afinando el flujo de encargos personalizados. Muy pronto vas a poder pedir tu presupuesto por acá."
        />
      </AccountShell>
    );
  }
  const sp = await searchParams;
  const showNew = first(sp.new) === "1";
  const requests = await listCustomerRequests(user.id);

  const selectedId =
    !showNew && requests.length > 0 ? (first(sp.req) ?? requests[0]!.id) : null;

  let data: Awaited<ReturnType<typeof getRequestWithMessages>> | null = null;
  if (selectedId) {
    try {
      data = await getRequestWithMessages(selectedId, user.id);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
    }
  }

  return (
    <AccountShell>
      <div className="mb-5">
        <h2 className="font-display text-xl font-bold">A medida</h2>
        <div className="text-faint mt-0.5 text-sm">
          Contanos tu idea, mandanos una referencia y coordinamos todo por chat.
        </div>
      </div>

      <div className="acc-chat">
        <aside className="acc-chat-side">
          <div className="mb-3 flex items-center justify-between">
            <div className="section-title text-[15px]">Conversaciones</div>
            <Link
              href="/cuenta/a-medida?new=1"
              className="btn btn-primary btn-sm"
            >
              + Nuevo
            </Link>
          </div>
          {requests.length === 0 ? (
            <div className="text-faint px-1 py-2 text-[12.5px] leading-relaxed">
              Todavía no tenés conversaciones. Tocá <b>Nuevo</b> para pedir algo
              personalizado.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {requests.map((r) => (
                <Link
                  key={r.id}
                  href={`/cuenta/a-medida?req=${r.id}`}
                  className={`acc-chat-conv${!showNew && selectedId === r.id ? "on" : ""}`}
                >
                  <span
                    className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg"
                    style={{
                      background: "rgba(var(--gold-rgb),.12)",
                      color: "var(--gold-bright)",
                    }}
                  >
                    <Spark size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <b className="truncate text-[13px]">{r.title}</b>
                    </span>
                    <span className="text-faint block truncate text-[11.5px]">
                      {r.description}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </aside>

        <section className="acc-chat-main">
          {showNew || !data ? (
            <div className="p-5">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[var(--gold-bright)]">
                  <Spark size={17} />
                </span>
                <h3 className="text-fg font-display text-lg font-bold">
                  Pedí un presupuesto
                </h3>
              </div>
              <p className="text-faint mb-4 text-[13px]">
                Describí lo que necesitás y, si querés, sumá una imagen de
                referencia.
              </p>
              <RequestForm />
            </div>
          ) : (
            <>
              <div className="chat-header">
                <span className="cavatar">H</span>
                <div className="grow">
                  <div className="ch-name flex items-center gap-2">
                    Hefesto 3D{" "}
                    <CustomStatusBadge status={data.request.status} />
                  </div>
                  <div className="ch-status">
                    <span className="live" /> en línea · pedido a medida
                  </div>
                </div>
              </div>

              {data.request.quotedAmount ? (
                <div className="border-b border-[var(--border)] p-4">
                  <div
                    className="ui-card flex items-center justify-between p-3"
                    style={{
                      borderColor: "rgba(76,183,130,.3)",
                      background:
                        "linear-gradient(150deg, rgba(76,183,130,.08), transparent)",
                    }}
                  >
                    <div>
                      <div className="text-fg text-[13.5px] font-semibold">
                        {data.request.title}
                      </div>
                      <div className="text-faint text-xs">
                        Cotización del taller
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <b className="text-[17px] text-[var(--success)]">
                        {formatPrice(Number(data.request.quotedAmount))}
                      </b>
                      {data.request.status === "quoted" ? (
                        <ApproveQuote requestId={data.request.id} />
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex-1 overflow-y-auto p-4">
                <ChatThread
                  requestId={data.request.id}
                  messages={data.messages}
                  viewerIsStaff={false}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </AccountShell>
  );
}
