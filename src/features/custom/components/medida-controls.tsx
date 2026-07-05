"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/stores/toastStore";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCan } from "@/components/auth/perms-provider";
import {
  deleteCustomRequestAction,
  quoteCustomRequestAction,
  transitionCustomRequestAction,
} from "../actions";
import { CUSTOM_STATUS_LABEL, CUSTOM_TRANSITIONS } from "../transitions";
import type { CustomRequestStatus } from "../types";

/**
 * Select de estado en el header del chat. Respeta la máquina de estados:
 * solo ofrece el estado actual + las transiciones permitidas (Cap. 15/19).
 */
export function MedidaStatusSelect({
  id,
  status,
}: {
  id: string;
  status: CustomRequestStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const canEdit = useCan("medida", "editar");
  const options: CustomRequestStatus[] = [
    status,
    ...CUSTOM_TRANSITIONS[status],
  ];
  if (!canEdit) return null;

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const to = e.target.value as CustomRequestStatus;
    if (to === status) return;
    setPending(true);
    const res = await transitionCustomRequestAction(id, to);
    setPending(false);
    if (res.ok) {
      toast(`Estado: ${CUSTOM_STATUS_LABEL[to]}`, "success");
      router.refresh();
    } else {
      toast(res.error.message, "danger");
    }
  }

  return (
    <select
      className="select"
      style={{
        width: "auto",
        padding: "7px 30px 7px 11px",
        fontSize: "12.5px",
      }}
      value={status}
      onChange={onChange}
      disabled={pending || options.length === 1}
      aria-label="Cambiar estado del pedido"
    >
      {options.map((s) => (
        <option key={s} value={s}>
          {CUSTOM_STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

/**
 * Botón "Crear y presupuestar" / "Editar presupuesto". El service cotiza
 * solicitudes en estado pending o quoted (ver canQuote). Si recibe un monto
 * actual, precarga el input y muestra "Editar".
 */
export function MedidaQuoteButton({
  id,
  currentAmount,
}: {
  id: string;
  currentAmount?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(currentAmount ?? "");
  const [pending, setPending] = useState(false);
  const canEdit = useCan("medida", "editar");
  const editing = currentAmount != null && currentAmount !== "";
  if (!canEdit) return null;

  async function submit() {
    setPending(true);
    const res = await quoteCustomRequestAction(id, { amount });
    setPending(false);
    if (res.ok) {
      toast("Cotización enviada al cliente.", "success");
      setOpen(false);
      setAmount("");
      router.refresh();
    } else {
      toast(res.error.message, "danger");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-primary btn-sm"
        style={{
          background: "linear-gradient(135deg,#5ed29a,#3fa46a)",
          color: "#0a1a10",
        }}
        onClick={() => setOpen(true)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        {editing ? "Editar presupuesto" : "Crear y presupuestar"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        className="input"
        type="number"
        min="1"
        step="0.01"
        placeholder="Monto ARS"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ width: 130 }}
      />
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={pending || !amount}
        onClick={submit}
      >
        {pending ? "Enviando…" : "Enviar"}
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen(false)}
      >
        Cancelar
      </button>
    </div>
  );
}

/** Elimina la conversación (staff). Pide confirmación; el borrado es definitivo. */
export function MedidaDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const canDelete = useCan("medida", "eliminar");
  if (!canDelete) return null;

  return (
    <>
      <button
        type="button"
        className="btn btn-danger btn-icon btn-sm"
        onClick={() => setOpen(true)}
        title="Eliminar conversación"
        aria-label="Eliminar conversación"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
        </svg>
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="¿Eliminar esta conversación?"
        description="Se eliminará la conversación y todos sus mensajes. Esta acción no se puede deshacer."
        onConfirm={async () => {
          const res = await deleteCustomRequestAction(id);
          if (!res.ok) throw new Error(res.error.message);
          toast("Conversación eliminada.", "success");
          router.push("/admin/medida");
          router.refresh();
        }}
      />
    </>
  );
}
