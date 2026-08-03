"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
      width={34}
      height={34}
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

/** Flecha de navegación (solo desktop). */
function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
    </svg>
  );
}

/**
 * Categorías padre en círculos (estilo "historias"), una al lado de la otra.
 *
 * SIN loop infinito ni auto-scroll (2026-08-03). Antes, con 5 o más categorías,
 * la lista se DUPLICABA para que el desplazamiento automático no tuviera
 * costura: en pantalla ancha se veía la misma categoría dos veces a la vez y
 * parecía un error. Ale: "tiene que aparecer una vez nomás y ya". Ahora cada
 * categoría aparece EXACTAMENTE UNA VEZ:
 *  - si entran todas, quedan centradas;
 *  - si no entran, se desplazan con el dedo (swipe) o con las flechas ‹ › en
 *    compu, que es lo que la gente ya espera de una fila así.
 */
export function CategoryCircles({
  categories,
}: {
  categories: CategoryWithCount[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Arrastrar con el mouse (en touch manda el scroll NATIVO del navegador: si
  // los dos pelean por scrollLeft, se traba — incidente 2026-07-24).
  const drag = useRef({ down: false, moved: false, startX: 0, startScroll: 0 });
  const [overflowing, setOverflowing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // ¿Es una compu con mouse? (para mostrar flechas). En touch, no.
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Si el mouse se suelta FUERA del carrusel, el drag quedaba "agarrado".
  useEffect(() => {
    const up = () => {
      drag.current.down = false;
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  // ¿El contenido desborda? Define si hay flechas y si se centra o no.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () =>
      setOverflowing(track.scrollWidth > track.clientWidth + 8);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [categories.length]);

  function onPointerDown(e: RPointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track) return;
    // Touch: el scroll lo hace el NAVEGADOR (nativo, fluido).
    if (e.pointerType !== "mouse") return;
    drag.current = {
      down: true,
      moved: false,
      startX: e.clientX,
      startScroll: track.scrollLeft,
    };
  }
  function onPointerMove(e: RPointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return; // touch = scroll nativo
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

  /** Flechas: desplazan ~3 círculos. Al llegar al borde, se frena (no da la
   *  vuelta): la lista tiene principio y fin, como lo que ve el cliente. */
  function nudge(dir: 1 | -1) {
    trackRef.current?.scrollBy({ left: dir * 340, behavior: "smooth" });
  }

  const showArrows = isDesktop && overflowing;
  const arrowStyle = (side: "left" | "right"): CSSProperties => ({
    position: "absolute",
    top: 53,
    transform: "translateY(-50%)",
    ...(side === "left" ? { left: -2 } : { right: -2 }),
    zIndex: 3,
    width: 40,
    height: 40,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: "var(--surface-1)",
    border: "1px solid var(--border)",
    color: "var(--text-dim)",
    cursor: "pointer",
    boxShadow: "0 6px 16px -6px rgba(0,0,0,.45)",
  });

  return (
    <div style={{ position: "relative" }}>
      {showArrows ? (
        <button
          type="button"
          aria-label="Anterior"
          onClick={() => nudge(-1)}
          style={arrowStyle("left")}
        >
          <Chevron dir="left" />
        </button>
      ) : null}

      <div
        ref={trackRef}
        className={`cat-carousel ${overflowing ? "" : "cat-carousel--static"}`}
        style={{
          display: "flex",
          gap: 20,
          overflowX: "auto",
          padding: "8px 2px 12px",
          scrollSnapType: "none",
          scrollbarWidth: "none",
          // Si entran todas, centradas; si no, se arrastran de a una pasada.
          cursor: overflowing ? "grab" : "default",
          justifyContent: overflowing ? "flex-start" : "center",
          flexWrap: "nowrap",
          // Deja el pan horizontal NATIVO en touch (sin esto, el navegador
          // duda entre scrollear la página o el carrusel y se traba).
          touchAction: "pan-x",
        }}
        // Sin pausa por hover (Ale: "no debe pararse"); el mouseleave solo
        // suelta un drag de mouse que quedó a medias.
        onMouseLeave={endDrag}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {categories.map((category) => {
          const cc = category.color ?? "#C9A84C";
          return (
            <Link
              key={category.id}
              href={`/catalogo?category=${category.slug}`}
              className="cat-circle"
              style={{
                flex: "0 0 auto",
                width: 108,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                textAlign: "center",
                scrollSnapAlign: "none",
                userSelect: "none",
                textDecoration: "none",
              }}
              draggable={false}
              onClick={onLinkClick}
              aria-label={category.name}
            >
              <span
                className="cat-circle-ring"
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                  background: `${cc}22`,
                  border: `2px solid ${cc}66`,
                  color: cc,
                }}
              >
                {category.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={category.imageUrl}
                    alt=""
                    draggable={false}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : category.icon ? (
                  <CircleIcon name={category.icon} />
                ) : (
                  <span style={{ fontSize: 24 }}>&#9670;</span>
                )}
              </span>
              <span
                className="cat-circle-name"
                style={{
                  fontFamily: "var(--font-display), sans-serif",
                  fontWeight: 600,
                  fontSize: 13.5,
                  lineHeight: 1.15,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {category.name}
              </span>
              <span
                className="cat-circle-count"
                style={{ fontSize: 11, color: "var(--text-faint)" }}
              >
                {category.productCount}{" "}
                {category.productCount === 1 ? "producto" : "productos"}
              </span>
            </Link>
          );
        })}
      </div>

      {showArrows ? (
        <button
          type="button"
          aria-label="Siguiente"
          onClick={() => nudge(1)}
          style={arrowStyle("right")}
        >
          <Chevron dir="right" />
        </button>
      ) : null}
    </div>
  );
}
