"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteCategoryAction } from "../actions";

export function DeleteCategoryButton({
  id,
  productCount,
}: {
  id: string;
  productCount: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const blocked = productCount > 0;

  function handleDelete() {
    if (blocked) return;
    if (!confirm("¿Borrar esta categoría?")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteCategoryAction(id);
      if (!res.ok) setError(res.error.message);
      router.refresh();
    });
  }

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        loading={isPending}
        disabled={blocked || isPending}
        title={
          blocked ? "No se puede borrar: tiene productos" : "Borrar categoría"
        }
        onClick={handleDelete}
      >
        Borrar
      </Button>
      {error ? <p className="text-danger mt-1 text-xs">{error}</p> : null}
    </div>
  );
}
