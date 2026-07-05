"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { archiveProductAction, publishProductAction } from "../actions";
import type { ProductStatus } from "../types";

const statusLabel: Record<ProductStatus, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

const statusVariant: Record<ProductStatus, "neutral" | "success" | "warning"> =
  {
    draft: "warning",
    published: "success",
    archived: "neutral",
  };

export function ProductStatusActions({
  productId,
  status,
}: {
  productId: string;
  status: ProductStatus;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Qué botón está corriendo, para mostrar el spinner solo en ese.
  const [pendingAction, setPendingAction] = useState<
    "publish" | "archive" | null
  >(null);

  function run(
    key: "publish" | "archive",
    action: () => Promise<{ ok: boolean; error?: { message: string } }>,
  ) {
    setError(null);
    setPendingAction(key);
    startTransition(async () => {
      const res = await action();
      if (!res.ok && res.error) setError(res.error.message);
      setPendingAction(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-dim text-sm">Estado:</span>
        <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>
      </div>
      <div className="flex gap-2">
        {status !== "published" ? (
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            loading={pendingAction === "publish"}
            onClick={() =>
              run("publish", () => publishProductAction(productId))
            }
          >
            Publicar
          </Button>
        ) : null}
        {status !== "archived" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            loading={pendingAction === "archive"}
            onClick={() =>
              run("archive", () => archiveProductAction(productId))
            }
          >
            Archivar
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-danger text-xs">{error}</p> : null}
    </div>
  );
}
