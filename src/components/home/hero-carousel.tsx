"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";

const P: Record<string, ReactNode> = {
  sparkles: (
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  ),
  cart: (
    <>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
    </>
  ),
  box: (
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.3 7 12 12l8.7-5M12 22V12" />
    </>
  ),
  layers: <path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5" />,
  printer: (
    <>
      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v8H6z" />
    </>
  ),
  star: (
    <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  ),
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
};

function Icon({ name, size = 21 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === "star" || name === "heart" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {P[name]}
    </svg>
  );
}

const heroStats = [
  { n: "3.490+", l: "Productos impresos" },
  { n: "4.9★", l: "Valoración media" },
  { n: "48h", l: "Producción promedio" },
];

type Banner = {
  title: string;
  sub: string;
  cta: string;
  href: string;
  align: "left" | "center";
  /** Imagen de fondo opcional (banner del hero o imagen del hero configurada). */
  image?: string | null;
  /** Encuadre de la imagen de fondo (background-position). Ej: "50% 30%". */
  position?: string | null;
};

const banners: Banner[] = [
  {
    title: "Diseños imposibles, impresos en 3D",
    sub: "Del archivo a tu puerta. Productos únicos forjados capa por capa.",
    cta: "Explorar catálogo",
    href: "/catalogo",
    align: "left",
  },
  {
    title: "Envío gratis en toda Argentina",
    sub: "En compras superiores a $30.000. Recibí tus piezas donde estés.",
    cta: "Ver catálogo",
    href: "/catalogo",
    align: "center",
  },
];

// El index resalta en dorado la última palabra del título.
function HeroTitle({ title }: { title: string }) {
  const words = title.trim().split(" ");
  if (words.length < 2) return <>{title}</>;
  const last = words.pop();
  return (
    <>
      {words.join(" ")} <span className="gold">{last}</span>
    </>
  );
}

function Cube() {
  return (
    <div className="scene">
      <div className="cube">
        <div className="face f-front">
          <Icon name="box" size={54} />
        </div>
        <div className="face f-back">
          <Icon name="layers" size={54} />
        </div>
        <div className="face f-right">
          <Icon name="printer" size={54} />
        </div>
        <div className="face f-left">
          <Icon name="sparkles" size={54} />
        </div>
        <div className="face f-top">
          <Icon name="star" size={54} />
        </div>
        <div className="face f-bottom">
          <Icon name="heart" size={54} />
        </div>
      </div>
    </div>
  );
}

export function HeroCarousel({ slides }: { slides?: Banner[] } = {}) {
  const data = slides && slides.length > 0 ? slides : banners;
  const [idx, setIdx] = useState(0);
  const count = data.length;

  const go = (n: number) => setIdx(((n % count) + count) % count);

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % count), 5500);
    return () => clearInterval(t);
  }, [count, idx]);

  return (
    <section className="hero-carousel">
      <div className="hc-track">
        {data.map((b, i) => {
          const hasImg = Boolean(b.image);
          const copy = (
            <div
              className="hc-copy"
              style={hasImg ? { color: "#fff" } : undefined}
            >
              <div className={`hero-tag${hasImg ? "max-md:hidden" : ""}`}>
                <Icon name="sparkles" size={15} /> Impresión 3D premium · Hecho
                en Argentina
              </div>
              <h1 className="hero-title">
                <HeroTitle title={b.title} />
              </h1>
              <p
                className="hero-sub"
                style={hasImg ? { color: "rgba(255,255,255,.92)" } : undefined}
              >
                {b.sub}
              </p>
              <div className="hc-cta flex flex-wrap gap-3">
                <Link href={b.href} className="btn btn-primary btn-lg">
                  <Icon name="cart" size={17} /> {b.cta}
                </Link>
              </div>
              {hasImg ? null : (
                <div className="hero-stats">
                  {heroStats.map((s) => (
                    <div key={s.l} className="hero-stat">
                      <div className="n">{s.n}</div>
                      <div className="l">{s.l}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
          return (
            <div
              key={i}
              className={`hc-slide ${i === idx ? "on" : ""} ${hasImg ? "aspect-[16/10] overflow-hidden rounded-b-[26px] sm:aspect-[16/6] sm:rounded-none md:aspect-auto" : ""}`}
              aria-hidden={i !== idx}
              style={hasImg ? { padding: 0, minHeight: 0 } : undefined}
            >
              {hasImg ? (
                <>
                  {/* Banner: la imagen se ve ENTERA (nada cortado) en todo
                      dispositivo. En móvil, como es ancha, va centrada sobre un
                      fondo difuminado de sí misma → se ve premium, no una tira
                      finita, y sin depender del encuadre ni perder el motivo. En
                      desktop, entera a su aspecto natural. Cualquier banner que
                      subas se acopla solo. */}
                  {/* Fondo: imagen difuminada + capa oscura = marco premium (no
                      queda "embarrado"). Solo móvil/tablet. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.image ?? ""}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl md:hidden"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 z-[1] md:hidden"
                    style={{ background: "rgba(9,7,4,.64)" }}
                  />
                  {/* Imagen ENTERA, nítida y enmarcada (padding en móvil). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.image ?? ""}
                    alt={b.title}
                    className="relative z-[2] block h-full w-full object-contain p-4 md:h-auto md:p-0"
                  />
                  {/* Velo móvil: oscurece abajo (ahí va el texto). */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-[3] md:hidden"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(8,6,3,.92) 0%, rgba(8,6,3,.55) 34%, rgba(8,6,3,0) 66%)",
                    }}
                  />
                  {/* Velo desktop: oscurece a la izquierda (ahí va el texto). */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-[3] hidden md:block"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(8,6,3,.82) 0%, rgba(8,6,3,.45) 42%, rgba(8,6,3,0) 68%)",
                    }}
                  />
                  <div className="absolute inset-0 z-[4] flex items-end md:items-center">
                    <div className="store-wrap w-full pb-6 md:pb-0">{copy}</div>
                  </div>
                </>
              ) : (
                <div className={`store-wrap hc-inner align-${b.align}`}>
                  {copy}
                  <Cube />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            className="hc-arrow hc-prev max-md:hidden"
            onClick={() => go(idx - 1)}
            aria-label="Anterior"
          >
            <Icon name="chevronLeft" size={20} />
          </button>
          <button
            type="button"
            className="hc-arrow hc-next max-md:hidden"
            onClick={() => go(idx + 1)}
            aria-label="Siguiente"
          >
            <Icon name="chevronRight" size={20} />
          </button>
          <div className="hc-dots">
            {data.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`hc-dot ${i === idx ? "on" : ""}`}
                onClick={() => go(i)}
                aria-label={`Banner ${i + 1}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
