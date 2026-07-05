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
  const [pending, setPending] = useState<"approve" | "delete" | null>(null);
  const busy = pending !== null;
  const canEdit = useCan("resenas", "editar");
  const canDelete = useCan("resenas", "eliminar");

  async function run(key: "approve" | "delete", fn: () => Promise<unknown>) {
    setPending(key);
    await fn();
    setPending(null);
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
          loading={pending === "approve"}
          onClick={() => run("approve", () => approveReviewAction(id))}
        >
          Aprobar
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          size="sm"
          variant="danger"
          disabled={busy}
          loading={pending === "delete"}
          onClick={() => run("delete", () => deleteReviewAction(id))}
        >
          Eliminar
        </Button>
      ) : null}
    </div>
  );
}
