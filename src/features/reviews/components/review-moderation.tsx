"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCan } from "@/components/auth/perms-provider";
import { approveReviewAction, deleteReviewAction } from "../actions";

export function ReviewModeration({
  id,
  isApproved,
}: {
  id: string;
  isApproved: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const canEdit = useCan("resenas", "editar");
  const canDelete = useCan("resenas", "eliminar");

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    await fn();
    setBusy(false);
    router.refresh();
  }

  if (!canEdit && !canDelete) {
    return <span className="text-faint text-[12px]">Solo lectura</span>;
  }

  return (
    <div className="flex justify-end gap-2">
      {!isApproved && canEdit ? (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => run(() => approveReviewAction(id))}
        >
          Aprobar
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          size="sm"
          variant="danger"
          disabled={busy}
          onClick={() => run(() => deleteReviewAction(id))}
        >
          Eliminar
        </Button>
      ) : null}
    </div>
  );
}
