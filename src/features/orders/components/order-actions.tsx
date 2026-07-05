"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteOrderAction } from "../actions";

/**
 * Sección "Acciones" del detalle de pedido (solo admin). Hoy: eliminar un
 * pedido creado por error. El botón se deshabilita cuando el estado no permite
 * el borrado; el servidor re-valida igual (canDeleteOrder en el service).
 */
export function OrderActions({
  orderId,
  orderNumber,
  canDelete,
}: {
  orderId: string;
  orderNumber: string;
  /** true solo para pedidos pendientes de pago o cancelados. */
  canDelete: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!canDelete) return;
    if (
      !confirm(
        `¿Eliminar el pedido ${orderNumber}? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await deleteOrderAction(orderId);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      router.push("/admin/pedidos");
      router.refresh();
    });
  }

  return (
    <div className="ui-card space-y-3 p-4">
      <h3 className="text-fg font-display text-sm">Acciones</h3>

      {error ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}

      <div>
        <Button
          type="button"
          variant="danger"
          size="sm"
          loading={isPending}
          disabled={!canDelete || isPending}
          title={
            canDelete
              ? "Eliminar pedido"
              : "Solo se pueden eliminar pedidos pendientes de pago o cancelados"
          }
          onClick={handleDelete}
        >
          Eliminar pedido
        </Button>
        <p className="text-faint mt-2 text-xs">
          Solo pedidos pendientes de pago o cancelados. Para uno pagado,
          cancelalo primero.
        </p>
      </div>
    </div>
  );
}
