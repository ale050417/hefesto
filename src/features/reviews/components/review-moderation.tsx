"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    await fn();
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-2">
      {!isApproved ? (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => run(() => approveReviewAction(id))}
        >
          Aprobar
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="danger"
        disabled={busy}
        onClick={() => run(() => deleteReviewAction(id))}
      >
        Eliminar
      </Button>
    </div>
  );
}
