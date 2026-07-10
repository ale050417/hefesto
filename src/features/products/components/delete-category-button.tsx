"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteCategoryAction } from "../actions";
import { useDeleteResource } from "@/hooks/use-delete-resource";

export function DeleteCategoryButton({
  id,
  name,
  productCount,
}: {
  id: string;
  name?: string;
  productCount: number;
}) {
  const [open, setOpen] = useState(false);
  const { deleteResource: deleteCategory } = useDeleteResource({
    action: (categoryId: string) => deleteCategoryAction(categoryId),
    successMessage: "Categoría eliminada",
  });
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
        onConfirm={() => deleteCategory(id)}
      />
    </>
  );
}
