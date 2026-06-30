"use client";

import { HOME_SECTIONS } from "../home-sections";
import type { StoreBanner } from "../types";

// Mockup en vivo de la portada del cliente (no es un iframe; refleja el form).
export function StorePreview({
  accent,
  name,
  slogan,
  banner,
  sections,
}: {
  accent: string;
  name: string;
  slogan: string;
  banner: StoreBanner | null;
  sections: Record<string, boolean>;
}) {
  const enabled = HOME_SECTIONS.filter((s) => sections[s.id] !== false);

  return (
    <div
      className="ui-card overflow-hidden"
      style={{ padding: 0, background: "var(--surface-2)" }}
    >
      {/* barra del navegador */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-1)",
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 999,
            background: "#e0605a",
          }}
        />
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 999,
            background: "#e0b34a",
          }}
        />
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 999,
            background: "#5ed29a",
          }}
        />
        <span className="text-faint ml-2 text-[11px]">tutienda.com</span>
      </div>

      <div style={{ maxHeight: 460, overflowY: "auto" }}>
        {/* header de la tienda */}
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-1)",
          }}
        >
          <span
            className="grid place-items-center font-bold"
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: accent,
              color: "#1a1505",
              fontSize: 12,
            }}
          >
            {(name[0] ?? "H").toUpperCase()}
          </span>
          <div className="leading-none">
            <div className="text-[12px] font-bold">{name}</div>
            <div className="text-faint text-[9px]">{slogan}</div>
          </div>
          <span className="ml-auto flex gap-1.5">
            {["Inicio", "Catálogo", "A medida"].map((l) => (
              <span key={l} className="text-faint text-[9px]">
                {l}
              </span>
            ))}
          </span>
        </div>

        {/* hero */}
        <div
          className="px-5 py-7"
          style={{
            background: `linear-gradient(135deg, ${accent}26, transparent 60%), var(--surface-2)`,
            textAlign: banner?.align === "center" ? "center" : "left",
          }}
        >
          <div className="font-display text-[15px] leading-tight font-extrabold">
            {banner?.title ?? "Diseños imposibles, impresos en 3D"}
          </div>
          <div className="text-faint mt-1 text-[10px]">
            {banner?.subtitle ?? "Del archivo a tu puerta, capa por capa."}
          </div>
          <span
            className="mt-3 inline-block rounded-full px-3 py-1 text-[10px] font-semibold"
            style={{ background: accent, color: "#1a1505" }}
          >
            {banner?.ctaText ?? "Explorar catálogo"}
          </span>
        </div>

        {/* secciones activas */}
        <div className="flex flex-col gap-2 p-4">
          {enabled.map((s) => (
            <div
              key={s.id}
              className="rounded-md px-3 py-2 text-[10.5px]"
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
              }}
            >
              <span
                className="mr-2 inline-block"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: accent,
                }}
              />
              {s.label}
            </div>
          ))}
          {enabled.length === 0 ? (
            <div className="text-faint text-center text-[11px]">
              Sin secciones activas.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
