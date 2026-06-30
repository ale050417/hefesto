import Link from "next/link";
import { requirePermissionPage } from "@/core/auth/permissions";
import { AppError } from "@/core/errors";
import { formatPrice } from "@/lib/format";
import { ChatThread } from "@/features/custom/components/chat-thread";
import { CustomStatusBadge } from "@/features/custom/components/status-badge";
import {
  MedidaDeleteButton,
  MedidaQuoteButton,
  MedidaStatusSelect,
} from "@/features/custom/components/medida-controls";
import {
  getRequestWithMessages,
  listAdminRequestsWithMeta,
  requestNeedsReply,
} from "@/features/custom/service";
import type { AdminRequestRow } from "@/features/custom/repository";
import type { CustomRequestStatus } from "@/features/custom/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedidos a medida — Admin" };

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  const x = Array.isArray(v) ? v[0] : v;
  return x && x !== "" ? x : undefined;
}

// Filtros del index, mapeados a la máquina de estados real (Cap. 15).
// "En curso" se agrega para no esconder los estados approved/in_production.
const FILTERS: {
  key: string;
  label: string;
  statuses?: CustomRequestStatus[];
  reply?: boolean;
}[] = [
  { key: "all", label: "Todas" },
  { key: "reply", label: "Por responder", reply: true },
  { key: "nuevas", label: "Nuevas", statuses: ["pending"] },
  { key: "presupuestadas", label: "Presupuestadas", statuses: ["quoted"] },
  { key: "curso", label: "En curso", statuses: ["approved", "in_production"] },
  { key: "cerradas", label: "Cerradas", statuses: ["done", "rejected"] },
];

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "short" });
const timeFmt = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
});

function chatTime(d: Date): string {
  const now = new Date();
  const same =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return same ? timeFmt.format(d) : dateFmt.format(d);
}

function matchesFilter(row: AdminRequestRow, key: string): boolean {
  const f = FILTERS.find((x) => x.key === key) ?? FILTERS[0]!;
  if (f.reply) return requestNeedsReply(row);
  if (f.statuses) return f.statuses.includes(row.status);
  return true;
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

function waLink(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

export default async function AdminCustomPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermissionPage("medida", "ver");
  const sp = await searchParams;
  const filter = FILTERS.some((f) => f.key === first(sp.f))
    ? first(sp.f)!
    : "all";

  const rows = await listAdminRequestsWithMeta();
  const needReply = rows.filter(requestNeedsReply).length;

  // Lista filtrada; las "por responder" primero, luego por fecha de mensaje.
  const list = rows
    .filter((r) => matchesFilter(r, filter))
    .sort((a, b) => {
      const ar = requestNeedsReply(a) ? 1 : 0;
      const br = requestNeedsReply(b) ? 1 : 0;
      if (ar !== br) return br - ar;
      const at = (a.lastMessage?.createdAt ?? a.updatedAt).getTime();
      const bt = (b.lastMessage?.createdAt ?? b.updatedAt).getTime();
      return bt - at;
    });

  const counts: Record<string, number> = {};
  for (const f of FILTERS) {
    counts[f.key] = rows.filter((r) => matchesFilter(r, f.key)).length;
  }

  const selId = first(sp.req);
  const selected =
    list.find((r) => r.id === selId) ??
    rows.find((r) => r.id === selId) ??
    list[0] ??
    null;

  let messages: Awaited<ReturnType<typeof getRequestWithMessages>>["messages"] =
    [];
  if (selected) {
    try {
      const data = await getRequestWithMessages(selected.id);
      messages = data.messages;
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
    }
  }

  const linkFor = (req?: string) => {
    const qs = new URLSearchParams();
    if (filter !== "all") qs.set("f", filter);
    if (req) qs.set("req", req);
    const s = qs.toString();
    return `/admin/medida${s ? `?${s}` : ""}`;
  };

  return (
    <div className="view grid gap-5">
      <div className="page-head">
        <div className="flex items-center gap-3">
          <span
            className="kpi-ic"
            style={{
              background: "rgba(var(--gold-rgb),.14)",
              color: "var(--gold-bright)",
              width: 48,
              height: 48,
            }}
          >
            <Spark size={22} />
          </span>
          <div>
            <div className="eyebrow">Solicitudes</div>
            <h1 className="page-title">Pedidos a medida</h1>
            <div className="page-sub">
              {rows.length} conversaciones ·{" "}
              <b style={{ color: "var(--gold-bright)" }}>
                {needReply} por responder
              </b>
            </div>
          </div>
        </div>
      </div>

      <div className="toolbar" style={{ marginBottom: 0 }}>
        {FILTERS.map((f) => {
          const qs = new URLSearchParams();
          if (f.key !== "all") qs.set("f", f.key);
          const href = `/admin/medida${qs.toString() ? `?${qs}` : ""}`;
          return (
            <Link
              key={f.key}
              href={href}
              className={`chip${filter === f.key ? "active" : ""}`}
            >
              {f.label} <b style={{ opacity: 0.6 }}>{counts[f.key]}</b>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="ui-card section-card flex flex-col items-center gap-2 p-10 text-center">
          <Spark size={26} />
          <div className="text-dim mt-2">Todavía no hay pedidos a medida.</div>
        </div>
      ) : (
        <div className="acc-chat med-chat">
          <aside className="acc-chat-side med-side">
            {list.length === 0 ? (
              <div className="text-faint px-1 py-3.5 text-center text-[12.5px]">
                No hay conversaciones en este filtro.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {list.map((r) => {
                  const reply = requestNeedsReply(r);
                  const name = r.customerName ?? "Cliente";
                  const preview = r.lastMessage
                    ? (r.lastMessage.fromStaff ? "Vos: " : "") +
                      r.lastMessage.body
                    : r.description;
                  const when = chatTime(
                    r.lastMessage?.createdAt ?? r.createdAt,
                  );
                  return (
                    <Link
                      key={r.id}
                      href={linkFor(r.id)}
                      className={`acc-chat-conv${selected && r.id === selected.id ? "on" : ""}`}
                    >
                      <span
                        className="cavatar flex-shrink-0"
                        style={{ width: 40, height: 40, fontSize: 15 }}
                      >
                        {name[0]?.toUpperCase() ?? "C"}
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="flex items-center justify-between gap-1.5">
                          <b className="truncate text-[13px]">{name}</b>
                          <span className="text-faint flex-shrink-0 text-[10.5px] whitespace-nowrap">
                            {when}
                          </span>
                        </span>
                        <span className="flex items-center justify-between gap-1.5">
                          <span className="text-faint flex-1 truncate text-[11.5px]">
                            {preview}
                          </span>
                          {reply ? (
                            <span className="med-badge">responder</span>
                          ) : null}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="acc-chat-main med-main">
            {selected ? (
              <>
                <div className="chat-header">
                  <span className="cavatar">
                    {(selected.customerName ?? "C")[0]?.toUpperCase()}
                  </span>
                  <div className="grow">
                    <div className="ch-name flex items-center gap-2">
                      {selected.customerName ?? "Cliente"}
                      <CustomStatusBadge status={selected.status} />
                    </div>
                    <div className="ch-status">
                      <span className="live" />{" "}
                      {selected.customerPhone ?? "Sin teléfono"}
                    </div>
                  </div>
                  <MedidaStatusSelect
                    id={selected.id}
                    status={selected.status}
                  />
                  {selected.customerPhone ? (
                    <a
                      className="chat-clip"
                      href={waLink(selected.customerPhone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir en WhatsApp"
                      aria-label="Abrir en WhatsApp"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.24 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
                      </svg>
                    </a>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--border)] bg-[var(--surface-1)] px-4 py-2.5">
                  <span className="text-faint text-[12.5px]">
                    Asunto: <b className="text-fg">{selected.title}</b>
                  </span>
                  {selected.budget ? (
                    <span className="badge badge-neutral">
                      Presupuesto cliente: ~
                      {formatPrice(Number(selected.budget))}
                    </span>
                  ) : null}
                  {selected.referenceImageUrl ? (
                    <a
                      href={selected.referenceImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="badge badge-info"
                    >
                      Con foto de referencia
                    </a>
                  ) : null}
                  {selected.quotedAmount ? (
                    <span className="badge badge-success">
                      Presupuestado {formatPrice(Number(selected.quotedAmount))}
                    </span>
                  ) : null}
                  <div className="grow" />
                  {selected.status === "pending" ||
                  selected.status === "quoted" ? (
                    <MedidaQuoteButton
                      id={selected.id}
                      currentAmount={selected.quotedAmount}
                    />
                  ) : null}
                  <MedidaDeleteButton id={selected.id} />
                </div>

                <div className="chat-body flex-1 overflow-y-auto p-4">
                  <ChatThread
                    requestId={selected.id}
                    messages={messages}
                    viewerIsStaff
                  />
                </div>
              </>
            ) : (
              <div className="m-auto flex flex-col items-center gap-1 p-12 text-center">
                <Spark size={26} />
                <div className="font-semibold">Elegí una conversación</div>
                <div className="text-faint mt-1 text-[13px]">
                  Seleccioná un pedido a medida de la lista para responder.
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
