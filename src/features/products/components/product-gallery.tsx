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
        ) : (
          /* Producto sin foto cargada: antes quedaba un rectángulo NEGRO
             enorme y parecía que la página estaba rota (2026-08-03). */
          <div className="text-faint absolute inset-0 grid place-items-center gap-2 text-center">
            <div>
              <svg
                viewBox="0 0 24 24"
                width="46"
                height="46"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto opacity-60"
                aria-hidden
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              <p className="mt-2 text-[13px]">Foto en camino</p>
              <p className="mt-0.5 text-[11.5px] opacity-80">
                Escribinos por WhatsApp y te la mandamos
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
