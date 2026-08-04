"use client";

import { cn } from "@/lib/utils";

/**
 * Muestrario de colores en círculos: el MISMO control en toda la app (tienda,
 * alta de producto y venta manual), como en las tiendas grandes.
 *
 * Por qué un solo componente y no tres copias: hasta 2026-08-03 cada pantalla
 * dibujaba sus propios chips con estilos parecidos pero distintos, y al mejorar
 * uno los otros quedaban viejos. Un patrón único se aprende una vez.
 *
 * Reglas de diseño (las tres importan, no son adorno):
 *  1. El NOMBRE del color elegido se muestra siempre fuera del círculo. Sin
 *     eso, nadie sabe cuál de dos verdes es "verde kriptonita".
 *  2. El elegido lleva un TILDE adentro, no solo un borde: cerca del 8% de los
 *     hombres tiene algún grado de daltonismo, y sobre un círculo blanco el aro
 *     dorado casi no se ve. El tilde va en blanco o negro según el color.
 *  3. 44px de área táctil en celular (el círculo se ve más chico). Un swatch
 *     chico en el teléfono es el error clásico de este patrón.
 */

/**
 * ¿El tilde va en blanco o en negro sobre este color? Se decide por la
 * luminancia percibida (el ojo ve el verde mucho más claro que el azul, de ahí
 * los pesos). Sin esto, el tilde blanco desaparecía sobre un swatch amarillo.
 */
export function readableOn(hex: string): string {
  const h = (hex || "").replace("#", "").trim();
  const full = h.length === 3 ? h.replace(/./g, (ch) => ch + ch) : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "#ffffff";
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111111" : "#ffffff";
}

export type SwatchOption = {
  /** Nombre del color, tal cual está en el catálogo de filamentos. */
  name: string;
  hex: string;
  /** Nota corta bajo el nombre (ej. un precio distinto, "sin stock"). */
  note?: string;
  /** Marca el círculo con un punto dorado (ej. cuesta distinto). */
  flag?: boolean;
  disabled?: boolean;
};

export function ColorSwatches({
  options,
  selected,
  onSelect,
  size = "md",
  className,
}: {
  options: SwatchOption[];
  /** Uno (tienda, venta manual) o varios (alta de producto). */
  selected: string[];
  onSelect: (name: string) => void;
  /** `sm` para formularios densos del panel; `md` para la tienda. */
  size?: "sm" | "md";
  className?: string;
}) {
  const box =
    size === "sm" ? "h-10 w-10 sm:h-9 sm:w-9" : "h-11 w-11 sm:h-10 sm:w-10";
  const dot = size === "sm" ? 26 : 30;
  const tick = size === "sm" ? 14 : 16;

  return (
    <div className={cn("flex flex-wrap gap-2.5", className)}>
      {options.map((o) => {
        const active = selected.includes(o.name);
        return (
          <button
            key={o.name}
            type="button"
            title={o.note ? `${o.name} · ${o.note}` : o.name}
            aria-label={o.note ? `${o.name}, ${o.note}` : o.name}
            aria-pressed={active}
            disabled={o.disabled}
            onClick={() => onSelect(o.name)}
            className={cn(
              "relative grid place-items-center rounded-full transition-transform",
              box,
              active && "scale-105",
              o.disabled && "cursor-not-allowed opacity-40",
            )}
            style={{
              outline: active
                ? "2px solid var(--gold-bright)"
                : "1px solid var(--border)",
              outlineOffset: active ? 2 : -1,
            }}
          >
            <span
              style={{
                width: dot,
                height: dot,
                borderRadius: "50%",
                background: o.hex || "#888",
                // Aro tenue: un color casi blanco necesita un límite para no
                // perderse contra el fondo.
                border: "1px solid rgba(128,128,128,.35)",
                display: "inline-block",
              }}
            />
            {active ? (
              <svg
                viewBox="0 0 24 24"
                width={tick}
                height={tick}
                fill="none"
                stroke={readableOn(o.hex)}
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute"
                aria-hidden
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : null}
            {o.flag ? (
              <span
                aria-hidden
                className="bg-primary absolute top-0 right-0 h-2.5 w-2.5 rounded-full"
                style={{ border: "1.5px solid var(--surface-1)" }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
