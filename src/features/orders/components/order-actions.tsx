"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { deleteOrderAction } from "../actions";
import { useDeleteResource } from "@/hooks/use-delete-resource";

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
 * Botón para ELIMINAR un pedido de forma permanente (hard delete), en cualquier
 * estado. Solo se renderiza para admin (quien lo monta decide). Abre el modal de
 * confirmación estándar; la action re-valida el rol en el servidor.
 *
 * Se usa igual en la tabla, en las tarjetas móviles y en el detalle, siempre al
 * lado del Total.
 */
export function DeleteOrderButton({
  orderId,
  orderNumber,
  redirectTo,
  onDeleted,
  className,
}: {
  orderId: string;
  orderNumber: string;
  /** Si se pasa, navega ahí tras borrar (ej. volver a la lista desde el detalle). */
  redirectTo?: string;
  /** Callback tras borrar (ej. limpiar la selección en la tabla). */
  onDeleted?: () => void;
  className?: string;
}) {
  const router = useRouter();
  // Patrón único de eliminación (hooks/use-delete-resource): serializa,
  // toast garantizado y navegación recién tras confirmar el backend.
  const { deleteResource: deleteOrder } = useDeleteResource({
    action: (id: string) => deleteOrderAction(id),
    successMessage: "Pedido eliminado",
    onDeleted: () => {
      onDeleted?.();
      if (redirectTo) router.push(redirectTo);
    },
  });
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={cn("btn-icon btn-ghost text-danger", className)}
        title={`Eliminar pedido ${orderNumber}`}
        aria-label={`Eliminar pedido ${orderNumber}`}
        onClick={() => setOpen(true)}
      >
        {TrashIcon}
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`¿Eliminar pedido ${orderNumber}?`}
        detail="Se eliminarán también sus ítems, historial y chat. Los puntos y el uso de cupón que haya generado se revierten."
        onConfirm={() => deleteOrder(orderId)}
      />
    </>
  );
}
