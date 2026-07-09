"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/stores/toastStore";
import { cn } from "@/lib/utils";
import { deleteManualSaleAction } from "../actions";
import { runAction } from "@/lib/run-action";

const TrashIcon = (
  <svg
    viewBox="0 0 24 24"
    width={16}
    height={16}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
  </svg>
);

/**
 * Elimina una venta manual (cargada mal / duplicada). Solo se monta para admin;
 * la action re-valida el rol en el servidor. Abre el modal de confirmación
 * estándar.
 */
export function DeleteManualSaleButton({
  id,
  label,
  className,
}: {
  id: string;
  /** Nombre del cliente para el título del modal. */
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={cn("btn-icon btn-ghost text-danger", className)}
        title="Eliminar venta"
        aria-label="Eliminar venta manual"
        onClick={() => setOpen(true)}
      >
        {TrashIcon}
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={label ? `¿Eliminar la venta de ${label}?` : "¿Eliminar venta?"}
        description="Se elimina de forma permanente y deja de sumar a facturación, ganancias y reportes."
        onConfirm={async () => {
          const res = await runAction(() => deleteManualSaleAction(id), {
            silent: true,
          });
          if (!res.ok) throw new Error(res.error.message);
          toast("Venta eliminada", "danger");
          router.refresh();
        }}
      />
    </>
  );
}
