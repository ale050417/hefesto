"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/stores/toastStore";
import { deleteCategoryAction } from "../actions";

export function DeleteCategoryButton({
  id,
  name,
  productCount,
}: {
  id: string;
  name?: string;
  productCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const blocked = productCount > 0;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={blocked}
        title={
          blocked ? "No se puede borrar: tiene productos" : "Borrar categoría"
        }
        onClick={() => setOpen(true)}
      >
        Borrar
      </Button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={name ? `¿Eliminar categoría "${name}"?` : "¿Eliminar categoría?"}
        onConfirm={async () => {
          const res = await deleteCategoryAction(id);
          if (!res.ok) throw new Error(res.error.message);
          toast("Categoría eliminada", "danger");
          router.refresh();
        }}
      />
    </>
  );
}
