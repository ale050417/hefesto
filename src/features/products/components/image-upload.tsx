"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { compressImageToWebp } from "@/lib/image-compress";
import {
  deleteProductImageAction,
  setPrimaryImageAction,
  uploadProductImageAction,
} from "../actions";
import type { ProductImage } from "../types";
import { runAction } from "@/lib/run-action";
import { useDeleteResource } from "@/hooks/use-delete-resource";

export function ImageUpload({
  productId,
  images,
  onChanged,
}: {
  productId: string;
  images: ProductImage[];
  /** Aviso extra tras cada operación (para refrescar dentro de un modal). */
  onChanged?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Patrón único de eliminación (modo toast; el error se ve como toast).
  const { deleteResource: removeImage } = useDeleteResource({
    action: (imageId: string) => deleteProductImageAction(imageId),
    successMessage: "Imagen eliminada",
    notify: "toast",
    label: "Eliminando imagen…",
    onDeleted: () => onChanged?.(),
  });
  const [isPending, startTransition] = useTransition();

  function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const remaining = Math.max(0, 5 - images.length); // máximo 5 fotos
    if (remaining === 0) {
      setError("Máximo 5 fotos por producto.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const files = Array.from(fileList).slice(0, remaining);
    startTransition(async () => {
      for (const file of files) {
        const compact = await compressImageToWebp(file, 1600);
        const fd = new FormData();
        fd.set("productId", productId);
        fd.set("file", compact);
        const res = await runAction(() => uploadProductImageAction(fd), {
          silent: true,
        });
        if (!res.ok) setError(res.error.message);
      }
      if (inputRef.current) inputRef.current.value = "";
      onChanged?.();
    });
  }

  function handleDelete(imageId: string) {
    setError(null);
    void removeImage(imageId);
  }

  function handlePrimary(imageId: string) {
    setError(null);
    startTransition(async () => {
      const res = await runAction(
        () => setPrimaryImageAction(productId, imageId),
        { silent: true },
      );
      if (!res.ok) setError(res.error.message);
      onChanged?.();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-dim mb-1 block text-xs font-medium">
          Subir imagen (hasta 5, se convierte a WebP). Recomendado: cuadrada,
          1000×1000 px o más — así llena la tarjeta sin recortes raros.
        </label>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={isPending}
          onChange={(e) => handleUpload(e.target.files)}
          className="text-dim text-sm"
        />
        {isPending ? (
          <p className="text-dim mt-2 text-xs">Procesando...</p>
        ) : null}
        {error ? <p className="text-danger mt-2 text-xs">{error}</p> : null}
      </div>

      {images.length === 0 ? (
        <p className="text-faint text-sm">Todavía no hay imágenes.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((img) => (
            <div
              key={img.id}
              className="border-surface-2 bg-surface-2 overflow-hidden rounded-md border"
            >
              <div className="relative aspect-square">
                <Image
                  src={img.url}
                  alt={img.alt ?? ""}
                  fill
                  sizes="160px"
                  className="object-cover"
                />
                {img.isPrimary ? (
                  <Badge className="absolute top-1 left-1" variant="primary">
                    Principal
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-col gap-1 p-2">
                {!img.isPrimary ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handlePrimary(img.id)}
                  >
                    Principal
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleDelete(img.id)}
                >
                  Borrar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
