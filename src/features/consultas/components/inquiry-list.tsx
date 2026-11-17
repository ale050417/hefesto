"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { useCan } from "@/components/auth/perms-provider";
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
import {
  INQUIRY_STATUS_LABEL,
  type InquiryStatus,
  type InquiryStatusChange,
} from "../schemas";
import type { InquiryView } from "../view";
import { AnswerForm } from "./answer-form";

type Filter = "open" | InquiryStatus | "all";

const FILTERS: Array<[Filter, string]> = [
  ["open", "Abiertas"],
  ["pending", "Sin responder"],
  ["answered", "Respondidas"],
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
 * - Quien tiene "editar" (operador) responde con el precio.
 * - Quien tiene "crear" (atención al cliente) copia el mensaje armado, lo
 *   manda y después marca Confirmado / No se hizo.
 */
export function InquiryList({
  inquiries,
  defaults,
}: {
  inquiries: InquiryView[];
  defaults: QuoteDefaults;
}) {
  const canAnswer = useCan("consultas", "editar");
  const canManage = useCan("consultas", "crear");
  const canDelete = useCan("consultas", "eliminar");
  const [filter, setFilter] = useState<Filter>("open");
  const [zoom, setZoom] = useState<string | null>(null);
  const [answering, setAnswering] = useState<InquiryView | null>(null);
  const [confirming, setConfirming] = useState<InquiryView | null>(null);

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

  async function setStatus(row: InquiryView, to: InquiryStatusChange) {
    const res = await runAction(() => changeInquiryStatusAction(row.id, to), {
      label: "Guardando…",
    });
    if (!res.ok) return;
    toast(
      to === "confirmed"
        ? "Consulta confirmada"
        : to === "cancelled"
          ? "Marcada como no se hizo"
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

                {r.message ? (
                  <div className="rounded-md border border-[var(--border)] p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-dim text-xs">
                        <b className="text-fg">
                          {r.unitPrice != null
                            ? `${formatQuoteMoney(r.unitPrice)}${r.quantity > 1 ? ` c/u · total ${formatQuoteMoney(r.unitPrice * r.quantity)}` : ""}`
                            : "Respuesta"}
                        </b>
                        {r.answeredBy ? ` · respondió ${r.answeredBy}` : ""}
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

                <div className="flex flex-wrap justify-end gap-2">
                  {canRemove ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setConfirming(r)}
                    >
                      Eliminar
                    </button>
                  ) : null}
                  {canManage && !open ? (
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
                        ? "Responder"
                        : "Cambiar respuesta"}
                    </button>
                  ) : null}
                  {canManage && r.status === "answered" ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => void setStatus(r, "confirmed")}
                    >
                      Confirmado
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

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
        title="Responder consulta"
        size="lg"
      >
        {answering ? (
          <AnswerForm
            key={answering.id}
            inquiry={answering}
            defaults={defaults}
            onDone={() => setAnswering(null)}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title={
          confirming
            ? `¿Eliminar la consulta de ${confirming.customerName}?`
            : "¿Eliminar consulta?"
        }
        detail="Se borran también sus fotos."
        onConfirm={async () => {
          if (confirming) await removeInquiry(confirming.id);
        }}
      />
    </>
  );
}
