"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCan } from "@/components/auth/perms-provider";
import { runAction } from "@/lib/run-action";
import { toast } from "@/stores/toastStore";
import { useDeleteResource } from "@/hooks/use-delete-resource";
import { approveReviewAction, deleteReviewAction } from "../actions";

/**
 * Moderación de una reseña. Bug 2026-07-10: las actions se llamaban PELADAS
 * (sin runAction: sin timeout, sin toast) y el resultado se ignoraba — si el
 * backend fallaba, no pasaba nada visible. Ahora: aprobar va por runAction
 * (toast de error automático) y eliminar usa el patrón único
 * useDeleteResource + ConfirmDialog (era el único borrado del admin sin
 * confirmación).
 */
export function ReviewModeration({
  id,
  isApproved,
}: {
  id: string;
  isApproved: boolean;
}) {
  const [approving, setApproving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const canEdit = useCan("resenas", "editar");
  const canDelete = useCan("resenas", "eliminar");

  const { deleteResource, deleting } = useDeleteResource({
    action: (reviewId: string) => deleteReviewAction(reviewId),
    successMessage: "Reseña eliminada",
  });
  const busy = approving || deleting;

  async function approve() {
    setApproving(true);
    const res = await runAction(() => approveReviewAction(id), {
      label: "Aprobando…",
    });
    setApproving(false);
    if (res.ok) toast("Reseña aprobada", "success");
  }

  if (!canEdit && !canDelete) {
    return <span className="text-faint text-[12px]">Solo lectura</span>;
  }

  return (
    <div className="flex justify-end gap-2">
      {!isApproved && canEdit ? (
        <Button size="sm" disabled={busy} loading={approving} onClick={approve}>
          Aprobar
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          size="sm"
          variant="danger"
          disabled={busy}
          loading={deleting}
          onClick={() => setConfirming(true)}
        >
          Eliminar
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="¿Eliminar la reseña?"
        description="Se elimina de forma permanente y deja de contar para el puntaje del producto."
        onConfirm={() => deleteResource(id)}
      />
    </div>
  );
}
