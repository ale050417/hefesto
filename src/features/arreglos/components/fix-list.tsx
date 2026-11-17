"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { useCan } from "@/components/auth/perms-provider";
import { useDeleteResource } from "@/hooks/use-delete-resource";
import { runAction } from "@/lib/run-action";
import { cn } from "@/lib/utils";
import { toast } from "@/stores/toastStore";
import { deleteFixAction, updateFixAction } from "../actions";
import { FIX_STATUSES, FIX_STATUS_LABEL, type FixStatus } from "../schemas";

export type FixRow = {
  id: string;
  title: string;
  description: string;
  urgent: boolean;
  status: FixStatus;
  images: string[];
  ownerNote: string | null;
  author: string;
  /** Lo cargó el usuario que está mirando. */
  mine: boolean;
  createdAt: string;
  resolvedAt: string | null;
};

type Filter = "open" | FixStatus | "all";

const FILTERS: Array<[Filter, string]> = [
  ["open", "Por resolver"],
  ["pending", "Pendientes"],
  ["in_progress", "En curso"],
  ["done", "Resueltos"],
  ["all", "Todos"],
];

const STATUS_VARIANT: Record<FixStatus, "warning" | "info" | "success"> = {
  pending: "warning",
  in_progress: "info",
  done: "success",
};

function matches(row: FixRow, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "open") return row.status !== "done";
  return row.status === filter;
}

export function FixList({ fixes }: { fixes: FixRow[] }) {
  const canEdit = useCan("arreglos", "editar");
  const canDelete = useCan("arreglos", "eliminar");
  const [filter, setFilter] = useState<Filter>("open");
  const [zoom, setZoom] = useState<string | null>(null);
  const [answering, setAnswering] = useState<FixRow | null>(null);
  const [confirming, setConfirming] = useState<FixRow | null>(null);

  const { deleteResource: removeFix } = useDeleteResource({
    action: (id: string) => deleteFixAction(id),
    successMessage: "Arreglo eliminado",
  });

  const shown = fixes.filter((f) => matches(f, filter));

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
            {label} · {fixes.filter((f) => matches(f, key)).length}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="ui-card section-card text-dim p-8 text-center">
          No hay arreglos en esta vista.
        </div>
      ) : (
        <div className="grid gap-3">
          {shown.map((f) => (
            <article
              key={f.id}
              className="ui-card section-card flex flex-col gap-3 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-fg text-base font-semibold break-words">
                    {f.title}
                  </h2>
                  <div className="text-dim text-xs">
                    {f.author} · {f.createdAt}
                    {f.resolvedAt ? ` · resuelto el ${f.resolvedAt}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {f.urgent && f.status !== "done" ? (
                    <Badge variant="danger">Urgente</Badge>
                  ) : null}
                  <Badge variant={STATUS_VARIANT[f.status]}>
                    {FIX_STATUS_LABEL[f.status]}
                  </Badge>
                </div>
              </div>

              <p className="text-sm break-words whitespace-pre-wrap">
                {f.description}
              </p>

              {f.images.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {f.images.map((url, i) => (
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

              {f.ownerNote ? (
                <div className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
                  <div className="text-dim mb-0.5 text-xs font-semibold">
                    Respuesta
                  </div>
                  <p className="break-words whitespace-pre-wrap">
                    {f.ownerNote}
                  </p>
                </div>
              ) : null}

              {canEdit || canDelete || (f.mine && f.status === "pending") ? (
                <div className="flex flex-wrap justify-end gap-2">
                  {canDelete || (f.mine && f.status === "pending") ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setConfirming(f)}
                    >
                      Eliminar
                    </button>
                  ) : null}
                  {canEdit ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setAnswering(f)}
                    >
                      Responder / cambiar estado
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
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
        title={answering?.title}
      >
        {answering ? (
          <AnswerForm
            key={answering.id}
            fix={answering}
            onDone={() => setAnswering(null)}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title={
          confirming ? `¿Eliminar "${confirming.title}"?` : "¿Eliminar arreglo?"
        }
        detail="Se borran también sus fotos."
        onConfirm={async () => {
          if (confirming) await removeFix(confirming.id);
        }}
      />
    </>
  );
}

function AnswerForm({ fix, onDone }: { fix: FixRow; onDone: () => void }) {
  const [status, setStatus] = useState<FixStatus>(fix.status);
  const [note, setNote] = useState(fix.ownerNote ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await runAction(
        () => updateFixAction(fix.id, { status, ownerNote: note }),
        { label: "Guardando…" },
      );
      if (!res.ok) return;
      toast("Arreglo actualizado", "success");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="field">
        <label htmlFor="fix-status">Estado</label>
        <select
          id="fix-status"
          className="select"
          value={status}
          onChange={(e) => setStatus(e.target.value as FixStatus)}
        >
          {FIX_STATUSES.map((s) => (
            <option key={s} value={s}>
              {FIX_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="fix-note">Respuesta (opcional)</label>
        <textarea
          id="fix-note"
          className="textarea"
          rows={4}
          maxLength={2000}
          value={note}
          placeholder="Qué se hizo, o qué falta para poder hacerlo."
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={onDone}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void save()}
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
