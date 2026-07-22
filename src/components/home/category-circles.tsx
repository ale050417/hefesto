"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type {
  CSSProperties,
  MouseEvent as RMouseEvent,
  PointerEvent as RPointerEvent,
} from "react";
import { catIconPath } from "@/features/products/category-icons";
import type { CategoryWithCount } from "@/features/products/types";

/** Ícono SVG de la categoría (mismo set que el panel). */
function CircleIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: catIconPath(name) }}
    />
  );
}

/**
 * Carrusel de categorías padre en círculos (estilo "historias").
 * - Auto-scroll continuo con loop sin costura (duplicamos la lista).
 * - Se pausa al pasar el mouse / mientras se arrastra.
 * - Arrastrable con el mouse (desktop) y con scroll nativo en touch.
 * - Respeta `prefers-reduced-motion` (sin animación).
 * Con pocas categorías (<5) no tiene sentido moverse: quedan centradas.
 */
export function CategoryCircles({
  categories,
}: {
  categories: CategoryWithCount[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const drag = useRef({ down: false, moved: false, startX: 0, startScroll: 0 });

  const loop = categories.length >= 5;
  // Duplicamos para que el loop no tenga costura (la 2da mitad continúa la 1ra).
  const items = loop ? [...categories, ...categories] : categories;

  useEffect(() => {
    if (!loop) return;
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const step = () => {
      if (!pausedRef.current && !drag.current.down) {
        track.scrollLeft += 0.4;
        const half = track.scrollWidth / 2;
        if (half > 0 && track.scrollLeft >= half) track.scrollLeft -= half;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [loop]);

  function onPointerDown(e: RPointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track) return;
    drag.current = {
      down: true,
      moved: false,
      startX: e.clientX,
      startScroll: track.scrollLeft,
    };
  }
  function onPointerMove(e: RPointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track || !drag.current.down) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 5) drag.current.moved = true;
    track.scrollLeft = drag.current.startScroll - dx;
  }
  function endDrag() {
    drag.current.down = false;
  }
  // Si el click viene de un arrastre, no navegamos.
  function onLinkClick(e: RMouseEvent) {
    if (drag.current.moved) {
      e.preventDefault();
      drag.current.moved = false;
    }
  }

  return (
    <div
      ref={trackRef}
      className={`cat-carousel${loop ? "" : "cat-carousel--static"}`}
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => {
        pausedRef.current = false;
        endDrag();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {items.map((category, i) => (
        <Link
          key={`${category.id}-${i}`}
          href={`/catalogo?category=${category.slug}`}
          className="cat-circle"
          style={{ "--cc": category.color ?? "var(--gold)" } as CSSProperties}
          draggable={false}
          onClick={onLinkClick}
          aria-label={category.name}
        >
          <span className="cat-circle-ring">
            {category.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={category.imageUrl}
                alt=""
                draggable={false}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : category.icon ? (
              <CircleIcon name={category.icon} />
            ) : (
              <span style={{ fontSize: 24 }}>&#9670;</span>
            )}
          </span>
          <span className="cat-circle-name">{category.name}</span>
          <span className="cat-circle-count">
            {category.productCount}{" "}
            {category.productCount === 1 ? "producto" : "productos"}
          </span>
        </Link>
      ))}
    </div>
  );
}
