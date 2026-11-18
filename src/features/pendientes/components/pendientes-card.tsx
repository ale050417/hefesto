"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCan } from "@/components/auth/perms-provider";
import { useDeleteResource } from "@/hooks/use-delete-resource";
import { runAction } from "@/lib/run-action";
import { cn } from "@/lib/utils";
import { toast } from "@/stores/toastStore";
import {
  createTaskAction,
  deleteTaskAction,
  setTaskDoneAction,
} from "../actions";
import { TASK_BODY_MAX } from "../schemas";

/** Pendiente con las fechas ya formateadas por la página (hora de Argentina). */
export type TaskRow = {
  id: string;
  body: string;
  author: string;
  /** Lo anotó el usuario que está mirando. */
  mine: boolean;
  createdAt: string;
  doneBy: string | null;
  doneAt: string | null;
};

/**
 * "Pendientes del equipo" (pedido de Agustín, 2026-11-17): lista compartida
 * arriba de Pedidos. Cualquiera anota lo que falta (un pedido sin cargar, una
 * cotización por mandar, un caso olvidado) y cualquiera lo tilda. La lista se
 * refresca sola después de cada cambio (la action revalida la página); lo que
 * anotó otra persona aparece al recargar.
 */
export function PendientesCard({
  open,
  done,
}: {
  open: TaskRow[];
  done: TaskRow[];
}) {
  // Mismos permisos que Pedidos: "crear" para anotar y tildar.
  const canWrite = useCan("pedidos", "crear");
  const canDelete = useCan("pedidos", "eliminar");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  /** Pendientes con un tilde en viaje: no se pueden volver a tocar. */
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<TaskRow | null>(null);

  const { deleteResource: removeTask } = useDeleteResource({
    action: (id: string) => deleteTaskAction(id),
    successMessage: "Pendiente borrado",
  });

  async function add() {
    const body = text.trim();
    if (!body || saving) return;
    setSaving(true);
    try {
      // Sin el overlay de pantalla completa: es una anotación rápida y se
      // suelen cargar varias seguidas.
      const res = await runAction(() => createTaskAction({ body }), {
        overlay: false,
      });
      if (res.ok) setText("");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(task: TaskRow, toDone: boolean) {
    if (busy.has(task.id)) return;
    setBusy((prev) => new Set(prev).add(task.id));
    try {
      const res = await runAction(
        () => setTaskDoneAction(task.id, { done: toDone }),
        { overlay: false },
      );
      if (res.ok && toDone) toast("Pendiente hecho", "success");
    } finally {
      setBusy((prev) => {
        const n = new Set(prev);
        n.delete(task.id);
        return n;
      });
    }
  }

  const row = (t: TaskRow, isDone: boolean) => (
    <li key={t.id} className="flex items-start gap-2.5 py-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={isDone}
        aria-label={
          isDone ? `Volver a pendiente: ${t.body}` : `Marcar hecho: ${t.body}`
        }
        disabled={!canWrite || busy.has(t.id)}
        onClick={() => void toggle(t, !isDone)}
        // Zona de toque más grande que el cuadradito (se usa desde el celular).
        className="-m-1.5 grid h-8 w-8 shrink-0 place-items-center p-1.5 disabled:opacity-50"
      >
        <span
          className={cn(
            "grid h-[18px] w-[18px] place-items-center rounded border transition-colors",
            isDone
              ? "border-accent bg-accent text-accent-fg"
              : "border-surface-3",
          )}
        >
          {isDone ? (
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : null}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-sm break-words whitespace-pre-wrap",
            isDone ? "text-dim line-through" : "text-fg",
          )}
        >
          {t.body}
        </div>
        <div className="text-faint text-[11.5px]">
          {t.author} · {t.createdAt}
          {isDone && t.doneBy
            ? ` · lo tildó ${t.doneBy}${t.doneAt ? ` el ${t.doneAt}` : ""}`
            : ""}
        </div>
      </div>
      {t.mine || canDelete ? (
        <button
          type="button"
          className="text-faint hover:text-fg -m-1 grid h-8 w-8 shrink-0 place-items-center"
          aria-label={`Borrar pendiente: ${t.body}`}
          onClick={() => setConfirming(t)}
        >
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </li>
  );

  return (
    <section className="ui-card section-card mb-4" aria-label="Pendientes">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="section-title">Pendientes del equipo</div>
        <span className="text-faint text-[12.5px]">
          {open.length === 0
            ? "Nada pendiente"
            : open.length === 1
              ? "1 pendiente"
              : `${open.length} pendientes`}
        </span>
      </div>

      {canWrite ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <input
            className="input min-w-0 flex-1"
            type="text"
            aria-label="Nuevo pendiente"
            placeholder="Anotá un pendiente y Enter"
            maxLength={TASK_BODY_MAX}
            enterKeyHint="done"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-secondary shrink-0"
            disabled={saving || !text.trim()}
          >
            Anotar
          </button>
        </form>
      ) : null}

      {open.length === 0 ? (
        <p className="text-dim mt-3 text-sm">
          No hay pendientes. Acá se anota lo que falta: un pedido sin cargar,
          una cotización por mandar, un caso que quedó colgado.
        </p>
      ) : (
        // Alto con tope y scroll propio: con muchos pendientes la tabla de
        // pedidos no queda enterrada al fondo de la página.
        <ul className="divide-surface-2 mt-2 max-h-56 divide-y overflow-y-auto overscroll-contain pr-1">
          {open.map((t) => row(t, false))}
        </ul>
      )}

      {done.length > 0 ? (
        <details className="border-surface-2 mt-2 border-t pt-2">
          <summary className="text-primary cursor-pointer text-[12.5px] hover:underline">
            Hechos ({done.length})
          </summary>
          <ul className="divide-surface-2 mt-1 max-h-56 divide-y overflow-y-auto overscroll-contain pr-1">
            {done.map((t) => row(t, true))}
          </ul>
        </details>
      ) : null}

      <ConfirmDialog
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title="¿Borrar este pendiente?"
        detail={confirming?.body}
        confirmLabel="Borrar"
        onConfirm={async () => {
          if (confirming) await removeTask(confirming.id);
        }}
      />
    </section>
  );
}
