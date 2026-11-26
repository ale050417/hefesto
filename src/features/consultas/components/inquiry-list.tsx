"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { useCan } from "@/components/auth/perms-provider";
import type { EstimatorContext } from "@/features/calculator/service";
import {
  formatQuoteMoney,
  type QuoteDefaults,
} from "@/features/quotes/build-quote";
import { useDeleteResource } from "@/hooks/use-delete-resource";
import { runAction } from "@/lib/run-action";
import { buildWhatsappUrl } from "@/lib/site";
import { cn } from "@/lib/utils";
import { toast } from "@/stores/toastStore";
import { changeInquiryStatusAction, deleteInquiryAction } from "../actions";
import type { InquiryProduct } from "../product-prefill";
import {
  INQUIRY_STATUS_LABEL,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  type InquiryPaymentMethod,
  type InquiryStatus,
} from "../schemas";
import type { InquiryView } from "../view";
import { AnswerForm } from "./answer-form";
import { AttachButton } from "./attach";
import { InquiryChat } from "./inquiry-chat";

type Filter = "open" | InquiryStatus | "all";

const FILTERS: Array<[Filter, string]> = [
  ["open", "Abiertas"],
  ["pending", "Sin cotizar"],
  ["answered", "Cotizadas"],
  ["confirmed", "Confirmadas"],
  ["cancelled", "No se hicieron"],
  ["all", "Todas"],
];

const STATUS_VARIANT: Record<
  InquiryStatus,
  "warning" | "info" | "success" | "neutral"
> = {
  pending: "warning",
  answered: "info",
  confirmed: "success",
  cancelled: "neutral",
};

function matches(row: InquiryView, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "open") {
    return row.status === "pending" || row.status === "answered";
  }
  return row.status === filter;
}

/**
 * Lista de consultas. Las fechas llegan ya formateadas desde la página.
 * - Cada consulta tiene su CHAT (2026-11-25): la vendedora y el operador
 *   conversan ahí, con fotos, hasta dejar definido el pedido.
 * - Quien tiene "editar" (operador) crea la cotización: queda armado el
 *   mensaje y se crea el pedido en "pendiente de pago".
 * - Quien tiene "crear" (atención al cliente) copia o manda el mensaje y,
 *   cuando el cliente seña, lo confirma: el pedido pasa a "confirmado".
 * Todo (fotos, audios, chat, cotización, pedido) queda en la misma consulta.
 */
export function InquiryList({
  inquiries,
  defaults,
  estimator,
  products,
}: {
  inquiries: InquiryView[];
  defaults: QuoteDefaults;
  /** Calculadora del operador; null si no se pudo cargar. */
  estimator: EstimatorContext | null;
  /** Productos de la tienda para rellenar la respuesta (solo el operador). */
  products: InquiryProduct[];
}) {
  const canAnswer = useCan("consultas", "editar");
  const canManage = useCan("consultas", "crear");
  const canDelete = useCan("consultas", "eliminar");
  const canSeeOrders = useCan("pedidos", "ver");
  const [filter, setFilter] = useState<Filter>("open");
  const [zoom, setZoom] = useState<string | null>(null);
  const [answering, setAnswering] = useState<InquiryView | null>(null);
  const [deleting, setDeleting] = useState<InquiryView | null>(null);
  const [confirming, setConfirming] = useState<InquiryView | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  // Chats que se abrieron en esta visita: su numerito de "sin leer" se va
  // aunque la lista todavía no se haya vuelto a pedir.
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const canChat = canAnswer || canManage;
  const chatting = inquiries.find((r) => r.id === chatId) ?? null;
  const router = useRouter();

  // La lista se actualiza sola (mensajes nuevos, cotizaciones): cada 20 s con
  // la pestaña visible y sin un formulario abierto encima.
  const busyModal = !!answering || !!confirming || !!deleting;
  useEffect(() => {
    if (busyModal) return;
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 20_000);
    return () => clearInterval(timer);
  }, [router, busyModal]);

  const { deleteResource: removeInquiry } = useDeleteResource({
    action: (id: string) => deleteInquiryAction(id),
    successMessage: "Consulta eliminada",
  });

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Mensaje copiado", "success");
    } catch {
      toast("No se pudo copiar. Seleccioná el texto y copialo.", "danger");
    }
  }

  async function setStatus(row: InquiryView, to: "cancelled" | "reopen") {
    const res = await runAction(() => changeInquiryStatusAction(row.id, to), {
      label: "Guardando…",
    });
    if (!res.ok) return;
    toast(
      to === "cancelled"
        ? row.saleId
          ? "Marcada como no se hizo: el pedido pendiente quedó cancelado"
          : "Marcada como no se hizo"
        : "Consulta reabierta",
      "success",
    );
  }

  const shown = inquiries.filter((r) => matches(r, filter));

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={cn("chip", filter === key && "active")}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label} · {inquiries.filter((r) => matches(r, key)).length}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="ui-card section-card text-dim p-8 text-center">
          No hay consultas en esta vista.
        </div>
      ) : (
        <div className="grid gap-3">
          {shown.map((r) => {
            const open = r.status === "pending" || r.status === "answered";
            const canRemove = canDelete || (r.mine && r.status === "pending");
            return (
              <article
                key={r.id}
                className="ui-card section-card flex flex-col gap-3 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-fg text-base font-semibold break-words">
                      {r.quantity > 1 ? `${r.quantity} × ` : ""}
                      {r.title}
                    </h2>
                    <div className="text-dim text-xs">
                      {r.customerName}
                      {r.customerPhone ? ` · ${r.customerPhone}` : ""} · cargó{" "}
                      {r.author} · {r.createdAt}
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[r.status]}>
                    {INQUIRY_STATUS_LABEL[r.status]}
                  </Badge>
                </div>

                {r.description ? (
                  <p className="text-sm break-words whitespace-pre-wrap">
                    {r.description}
                  </p>
                ) : null}

                {r.images.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {r.images.map((url, i) => (
                      <button
                        key={url}
                        type="button"
                        className="media-tile cursor-zoom-in p-0"
                        aria-label={`Ver foto ${i + 1} en grande`}
                        onClick={() => setZoom(url)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt=""
                          loading="lazy"
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}

                {r.files.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {r.files.map((f) =>
                      f.type.startsWith("audio/") ? (
                        <div key={f.url} className="flex flex-col gap-1">
                          <span className="text-dim text-xs break-all">
                            {f.name}
                          </span>
                          <audio
                            controls
                            preload="none"
                            src={f.url}
                            className="w-full max-w-md"
                          />
                        </div>
                      ) : (
                        <a
                          key={f.url}
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent text-sm break-all underline"
                        >
                          {f.name}
                        </a>
                      ),
                    )}
                  </div>
                ) : null}

                {r.message ? (
                  <div className="rounded-md border border-[var(--border)] p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-dim text-xs">
                        <b className="text-fg">
                          {r.unitPrice != null
                            ? `${formatQuoteMoney(r.unitPrice)}${r.quantity > 1 ? ` c/u · total ${formatQuoteMoney(r.unitPrice * r.quantity)}` : ""}`
                            : "Cotización"}
                        </b>
                        {r.answeredBy ? ` · cotizó ${r.answeredBy}` : ""}
                        {r.answeredAt ? ` · ${r.answeredAt}` : ""}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => void copy(r.message ?? "")}
                        >
                          Copiar mensaje
                        </button>
                        <a
                          className="btn btn-secondary btn-sm"
                          href={buildWhatsappUrl(r.customerPhone, r.message)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          WhatsApp
                        </a>
                      </div>
                    </div>
                    <pre className="[font-family:inherit] text-sm break-words whitespace-pre-wrap">
                      {r.message}
                    </pre>
                  </div>
                ) : null}

                {r.status === "answered" && r.saleId ? (
                  <div
                    className="rounded-md px-3 py-2 text-sm"
                    style={{
                      background: "rgba(var(--gold-rgb), 0.1)",
                      color: "var(--gold-bright)",
                    }}
                  >
                    <b>Pedido pendiente de pago.</b> Mandale la cotización al
                    cliente; cuando señe, tocá «Señó · Confirmar pedido».
                    {canSeeOrders ? (
                      <>
                        {" "}
                        <Link href="/admin/pedidos" className="underline">
                          Ver en Pedidos
                        </Link>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {r.status === "confirmed" ? (
                  <div className="text-dim text-sm">
                    Confirmada{r.confirmedAt ? ` el ${r.confirmedAt}` : ""}
                    {r.saleId ? " · el pedido ya está en Pedidos" : ""}
                    {r.saleId && canSeeOrders ? (
                      <>
                        {" · "}
                        <Link href="/admin/pedidos" className="underline">
                          Ver pedidos
                        </Link>
                      </>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2">
                  {canRemove ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setDeleting(r)}
                    >
                      Eliminar
                    </button>
                  ) : null}
                  {open && (canManage || canAnswer) ? (
                    <AttachButton inquiryId={r.id} />
                  ) : null}
                  {canChat ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setChatId(r.id);
                        setReadIds((s) => new Set(s).add(r.id));
                      }}
                    >
                      💬 Chat
                      {r.chatUnread > 0 && !readIds.has(r.id) ? (
                        <span className="badge badge-danger">
                          {r.chatUnread}
                        </span>
                      ) : r.chatMessages > 0 ? (
                        <span className="text-faint">· {r.chatMessages}</span>
                      ) : null}
                    </button>
                  ) : null}
                  {canManage &&
                  (r.status === "cancelled" ||
                    (r.status === "confirmed" && !r.saleId)) ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => void setStatus(r, "reopen")}
                    >
                      Reabrir
                    </button>
                  ) : null}
                  {canManage && open ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => void setStatus(r, "cancelled")}
                    >
                      No se hizo
                    </button>
                  ) : null}
                  {canAnswer && open ? (
                    <button
                      type="button"
                      className={cn(
                        "btn btn-sm",
                        r.status === "pending"
                          ? "btn-primary"
                          : "btn-secondary",
                      )}
                      onClick={() => setAnswering(r)}
                    >
                      {r.status === "pending"
                        ? "Crear cotización"
                        : "Cambiar cotización"}
                    </button>
                  ) : null}
                  {canManage && r.status === "answered" ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setConfirming(r)}
                    >
                      Señó · Confirmar pedido
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* El chat va primero: la foto en grande y la cotización se abren
          encima sin cerrarlo (no se pierde lo que se estaba escribiendo). */}
      <Modal
        open={!!chatting}
        onClose={() => {
          setChatId(null);
          router.refresh();
        }}
        title={
          chatting
            ? `Chat · ${chatting.customerName} — ${chatting.quantity > 1 ? `${chatting.quantity} × ` : ""}${chatting.title}`
            : "Chat"
        }
        size="lg"
      >
        {chatting ? (
          <div className="flex flex-col gap-3">
            <InquiryChat
              key={chatting.id}
              inquiryId={chatting.id}
              onZoom={setZoom}
            />
            {canAnswer &&
            (chatting.status === "pending" ||
              chatting.status === "answered") ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
                <span className="text-faint text-[12.5px]">
                  {chatting.status === "pending"
                    ? "¿Ya está todo definido y tenés el precio?"
                    : "Ya tiene cotización: el pedido espera la seña."}
                </span>
                <button
                  type="button"
                  className={cn(
                    "btn",
                    chatting.status === "pending"
                      ? "btn-primary"
                      : "btn-secondary",
                  )}
                  onClick={() => setAnswering(chatting)}
                >
                  {chatting.status === "pending"
                    ? "Crear cotización"
                    : "Cambiar cotización"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal open={!!zoom} onClose={() => setZoom(null)} title="Foto" size="lg">
        {zoom ? (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoom}
              alt=""
              className="max-h-[70vh] w-auto max-w-full rounded-md"
            />
            <a
              href={zoom}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-sm"
            >
              Abrir en tamaño completo
            </a>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!answering}
        onClose={() => setAnswering(null)}
        title={
          answering?.status === "answered"
            ? "Cambiar cotización"
            : "Crear cotización"
        }
        size="lg"
      >
        {answering && !estimator ? (
          <p className="text-dim text-sm">
            No se pudo cargar la calculadora. Actualizá la página y probá de
            nuevo.
          </p>
        ) : null}
        {answering && estimator ? (
          <AnswerForm
            key={answering.id}
            inquiry={answering}
            defaults={defaults}
            estimator={estimator}
            products={products}
            onDone={() => setAnswering(null)}
          />
        ) : null}
      </Modal>

      <Modal
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title="Confirmar pedido"
      >
        {confirming ? (
          <ConfirmSale
            key={confirming.id}
            inquiry={confirming}
            onDone={() => setConfirming(null)}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={
          deleting
            ? `¿Eliminar la consulta de ${deleting.customerName}?`
            : "¿Eliminar consulta?"
        }
        detail="Se borran también sus fotos y audios."
        onConfirm={async () => {
          if (deleting) await removeInquiry(deleting.id);
        }}
      />
    </>
  );
}

/**
 * El cliente señó: se elige cómo pagó y el pedido de la cotización pasa de
 * "pendiente de pago" a confirmado (entra a la cola de impresión).
 */
function ConfirmSale({
  inquiry,
  onDone,
}: {
  inquiry: InquiryView;
  onDone: () => void;
}) {
  const [method, setMethod] = useState<InquiryPaymentMethod>("transfer");
  const [busy, setBusy] = useState(false);
  const total = (inquiry.unitPrice ?? 0) * inquiry.quantity;

  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await runAction(
        () => changeInquiryStatusAction(inquiry.id, "confirmed", method),
        { label: "Confirmando el pedido…" },
      );
      if (!res.ok) return;
      toast("Confirmado: el pedido pasó a producción", "success");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        El pedido de <b>{inquiry.customerName}</b> (
        {inquiry.quantity > 1 ? `${inquiry.quantity} × ` : ""}
        {inquiry.title}, <b>{formatQuoteMoney(total)}</b>) pasa de pendiente de
        pago a <b>confirmado</b> y entra a la cola de impresión.
      </p>
      <div className="field">
        <label htmlFor="confirm-method">¿Cómo paga?</label>
        <select
          id="confirm-method"
          className="select"
          value={method}
          onChange={(e) => setMethod(e.target.value as InquiryPaymentMethod)}
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABEL[m]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={onDone}
        >
          Todavía no
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void confirm()}
        >
          Señó · Confirmar pedido
        </button>
      </div>
    </div>
  );
}
