"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { compressImageToWebp } from "@/lib/image-compress";
import {
  deleteProductImageAction,
  setImageColorAction,
  setPrimaryImageAction,
  uploadProductImageAction,
} from "../actions";
import type { ProductImage } from "../types";
import { runAction } from "@/lib/run-action";
import { useDeleteResource } from "@/hooks/use-delete-resource";

export function ImageUpload({
  productId,
  images,
  colorOptions = [],
  onChanged,
}: {
  productId: string;
  images: ProductImage[];
  /**
   * Colores/combinaciones a los que se puede asignar cada foto. Vacío = el
   * producto no tiene variaciones y no hay nada que elegir.
   *
   * Sin esto, toda foto subida desde acá quedaba SIN color y la galería de la
   * tienda no saltaba al elegir el color: el alta por wizard lo guardaba, la
   * edición no (bug 2026-08-09). Usar `photoColorOptions` para armarlo.
   */
  colorOptions?: string[];
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

  /** Asigna el color de esta foto (o lo saca con ""). */
  function handleColor(imageId: string, value: string) {
    setError(null);
    startTransition(async () => {
      const res = await runAction(
        () => setImageColorAction(imageId, value || null),
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

      {/* Aviso cuando el producto tiene colores pero ninguna foto tiene el suyo:
          es exactamente el caso en que la tienda "no cambia la imagen". */}
      {colorOptions.length > 0 &&
      images.length > 0 &&
      images.every((i) => !i.color) ? (
        <p className="bg-warning/10 text-warning rounded-md px-3 py-2 text-[12.5px] leading-relaxed">
          Ninguna foto tiene color asignado, así que en la tienda la imagen no
          cambia al elegir el color. Elegí abajo a qué color corresponde cada
          foto.
        </p>
      ) : null}

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
                {img.color ? (
                  <Badge
                    className="absolute right-1 bottom-1"
                    variant="neutral"
                  >
                    {img.color}
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-col gap-1 p-2">
                {/* A qué color/combinación corresponde ESTA foto. Es lo que la
                    tienda busca al elegir el color; sin esto la galería no
                    salta (bug 2026-08-09). */}
                {colorOptions.length > 0 ? (
                  <select
                    className="select"
                    style={{ height: 30, fontSize: 12 }}
                    disabled={isPending}
                    value={img.color ?? ""}
                    aria-label="Color de esta foto"
                    onChange={(e) => handleColor(img.id, e.target.value)}
                  >
                    <option value="">— Sin color —</option>
                    {/* El color guardado puede ya no estar en la lista (se
                        renombró o se sacó): se muestra igual para no perderlo
                        en silencio. */}
                    {(img.color && !colorOptions.includes(img.color)
                      ? [img.color, ...colorOptions]
                      : colorOptions
                    ).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : null}
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
