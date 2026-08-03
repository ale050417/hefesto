"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type GalleryImage = {
  url: string;
  alt: string;
  position: string;
  scale: number;
  color?: string | null;
};

/**
 * Galería con miniaturas en BARRA LATERAL IZQUIERDA + imagen grande a la
 * derecha. Puede funcionar sola (no controlada) o controlada por un padre
 * (activeIndex/onSelect) para, por ejemplo, cambiar la foto al elegir un color.
 */
export function ProductGallery({
  images,
  activeIndex,
  onSelect,
}: {
  images: GalleryImage[];
  activeIndex?: number;
  onSelect?: (i: number) => void;
}) {
  const [internal, setInternal] = useState(0);
  const active = activeIndex ?? internal;
  const setActive = (i: number) => {
    onSelect?.(i);
    setInternal(i);
  };
  const main = images[active] ?? images[0];

  return (
    // En celular las miniaturas van DEBAJO en fila (el riel vertical de 64px se
    // comía el 18% del ancho y achicaba la foto principal); de lg para arriba
    // vuelve la barra lateral izquierda de siempre.
    <div className="flex flex-col-reverse gap-3 lg:flex-row">
      {images.length > 1 ? (
        <div className="flex shrink-0 gap-2 overflow-x-auto lg:w-16 lg:flex-col lg:overflow-visible">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Ver imagen ${i + 1}`}
              className={cn(
                "bg-surface-2 relative aspect-square w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors lg:w-auto",
                i === active
                  ? "border-[var(--gold)]"
                  : "border-surface-2 hover:border-surface-3",
              )}
            >
              <Image
                src={img.url}
                alt={img.alt}
                fill
                sizes="64px"
                className="object-cover"
                style={{ objectPosition: img.position }}
              />
            </button>
          ))}
        </div>
      ) : null}
      {/* object-contain: se ve la imagen ENTERA tal cual se cargó (sin recortar),
          centrada y adaptada a cualquier dispositivo. El fondo rellena lo que
          sobra si la imagen no es cuadrada. */}
      <div className="border-surface-2 bg-surface-2 relative aspect-square flex-1 overflow-hidden rounded-lg border">
        {main ? (
          <Image
            src={main.url}
            alt={main.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-contain"
            priority
          />
        ) : null}
      </div>
    </div>
  );
}
