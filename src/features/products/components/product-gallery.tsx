"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

type GalleryImage = { url: string; alt: string; position: string };

export function ProductGallery({ images }: { images: GalleryImage[] }) {
  const [active, setActive] = useState(0);
  const main = images[active] ?? images[0];

  return (
    <div>
      <div className="border-surface-2 bg-surface-2 relative aspect-square overflow-hidden rounded-lg border">
        {main ? (
          <Image
            src={main.url}
            style={{ objectPosition: main.position }}
            alt={main.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="mt-3 grid grid-cols-4 gap-2">
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
                sizes="120px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
