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
    <div className="flex gap-3">
      {images.length > 1 ? (
        <div className="flex shrink-0 flex-col gap-2" style={{ width: 64 }}>
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Ver imagen ${i + 1}`}
              className={cn(
                "bg-surface-2 relative aspect-square overflow-hidden rounded-md border-2 transition-colors",
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
