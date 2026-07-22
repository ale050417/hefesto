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
 * Carrusel de categorías padre en círculos (estilo "historias"), uno al lado
 * del otro.
 * - Auto-scroll LENTO y continuo con loop sin costura (duplicamos la lista).
 * - Se pausa al pasar el mouse / mientras se arrastra.
 * - Desktop: flechas ‹ › cuando hay muchas y desbordan.
 * - Tablet/celular: swipe con el dedo (scroll nativo); sin flechas.
 * - Respeta `prefers-reduced-motion` (sin animación).
 * La estructura va en estilos inline (no depende de recargar el CSS).
 */
export function CategoryCircles({
  categories,
}: {
  categories: CategoryWithCount[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const arrowScrolling = useRef(false);
  const drag = useRef({ down: false, moved: false, startX: 0, startScroll: 0 });
  const [overflowing, setOverflowing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const loop = categories.length >= 5;
  // Duplicamos para que el loop no tenga costura (la 2da mitad continúa la 1ra).
  const items = loop ? [...categories, ...categories] : categories;

  // ¿Es una compu con mouse? (para mostrar flechas). En touch, no.
  // Patrón de suscripción (evita setState suelto en el effect) y de paso
  // reacciona si cambia el tipo de puntero.
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // ¿El contenido desborda? (para mostrar flechas solo si hace falta).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () =>
      setOverflowing(track.scrollWidth > track.clientWidth + 8);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [items.length]);

  // Auto-scroll lento y continuo. Usamos un acumulador en JS (`pos`) porque el
  // navegador redondea `scrollLeft` a enteros: si hiciéramos `scrollLeft += 0.3`
  // leyendo el valor ya redondeado, nunca avanzaría (por eso "no se movía").
  // Con el float aparte, cada ~3 frames avanza 1px real → movimiento suave.
  useEffect(() => {
    if (!loop) return;
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let pos = track.scrollLeft;
    let last = performance.now();
    const SPEED = 22; // px por segundo: despacito, e igual en cualquier monitor
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); // clamp si hubo un lag
      last = now;
      if (!pausedRef.current && !drag.current.down && !arrowScrolling.current) {
        const half = track.scrollWidth / 2;
        pos += SPEED * dt;
        if (half > 0 && pos >= half) pos -= half;
        track.scrollLeft = pos;
      } else {
        pos = track.scrollLeft; // el usuario movió a mano: resincronizamos
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

  // Flechas: desplazan ~2 círculos, con wrap para que se sienta infinito.
  function nudge(dir: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    // Pausamos el auto-scroll mientras corre la animación suave (si no, el
    // rAF le pisa el scrollLeft y la flecha no mueve).
    arrowScrolling.current = true;
    const half = track.scrollWidth / 2;
    if (dir < 0 && loop && track.scrollLeft < 300) track.scrollLeft += half;
    track.scrollBy({ left: dir * 300, behavior: "smooth" });
    window.setTimeout(() => {
      arrowScrolling.current = false;
    }, 650);
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
        className={`cat-carousel${loop ? "" : "cat-carousel--static"}`}
        style={{
          display: "flex",
          gap: 20,
          overflowX: "auto",
          padding: "8px 2px 12px",
          scrollSnapType: "none",
          scrollbarWidth: "none",
          cursor: loop ? "grab" : "default",
          justifyContent: loop ? "flex-start" : "center",
          flexWrap: loop ? "nowrap" : "wrap",
        }}
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
        {items.map((category, i) => {
          const cc = category.color ?? "#C9A84C";
          return (
            <Link
              key={`${category.id}-${i}`}
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
