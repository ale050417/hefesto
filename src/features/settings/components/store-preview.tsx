"use client";

import { HOME_SECTIONS } from "../home-sections";
import type { StoreBanner } from "../types";

// Mockup en vivo de la portada del cliente (no es un iframe; refleja el form).
// Cada sección se dibuja parecido a como se ve en la tienda real (no pastillas).
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

  const card = {
    background: "var(--surface-1)",
    border: "1px solid var(--border)",
    borderRadius: 8,
  } as const;

  const titleRow = (label: string) => (
    <div className="mb-1.5 flex items-center justify-between">
      <div className="text-[10.5px] font-bold">{label}</div>
      <div className="text-faint text-[8.5px]">Ver todo →</div>
    </div>
  );

  const prodCard = (i: number) => (
    <div key={i} style={{ ...card, overflow: "hidden" }}>
      <div
        style={{
          height: 36,
          background: `linear-gradient(135deg, ${accent}33, var(--surface-2))`,
        }}
      />
      <div className="px-1.5 py-1">
        <div
          className="mb-1 rounded"
          style={{ height: 4, width: "80%", background: "var(--border)" }}
        />
        <div className="text-[9px] font-bold" style={{ color: accent }}>
          $9.900
        </div>
      </div>
    </div>
  );

  const prodGrid = (
    <div className="grid grid-cols-3 gap-1.5">{[0, 1, 2].map(prodCard)}</div>
  );

  function renderSection(id: string, label: string) {
    switch (id) {
      case "trustBar":
        return (
          <div
            className="flex items-center justify-around px-2 py-2"
            style={card}
          >
            {["Envío a todo el país", "Pago seguro", "Hecho a pedido"].map(
              (t) => (
                <div key={t} className="flex items-center gap-1">
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      background: accent,
                    }}
                  />
                  <span className="text-faint text-[8px]">{t}</span>
                </div>
              ),
            )}
          </div>
        );
      case "categorias":
        return (
          <div>
            {titleRow("Categorías")}
            <div className="grid grid-cols-4 gap-1.5">
              {["Llaveros", "Macetas", "Deco", "Gamer"].map((c) => (
                <div
                  key={c}
                  className="flex flex-col items-center gap-1 px-1 py-2"
                  style={card}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 6,
                      background: `${accent}33`,
                      border: `1px solid ${accent}`,
                    }}
                  />
                  <span className="text-[7.5px]">{c}</span>
                </div>
              ))}
            </div>
          </div>
        );
      case "nuevos":
      case "masVendidos":
      case "ofertas":
        return (
          <div>
            {titleRow(label)}
            {prodGrid}
          </div>
        );
      case "stats":
        return (
          <div className="grid grid-cols-3 gap-1.5 px-2 py-2.5" style={card}>
            {[
              ["+500", "piezas"],
              ["4.9★", "rating"],
              ["48h", "entrega"],
            ].map(([n, l]) => (
              <div key={l} className="text-center">
                <div
                  className="text-[12px] font-extrabold"
                  style={{ color: accent }}
                >
                  {n}
                </div>
                <div className="text-faint text-[7.5px]">{l}</div>
              </div>
            ))}
          </div>
        );
      case "materiales":
        return (
          <div>
            {titleRow("Materiales")}
            <div className="flex flex-wrap gap-1">
              {["PLA", "PETG", "TPU", "Resina", "Madera"].map((m) => (
                <span
                  key={m}
                  className="rounded-full px-2 py-0.5 text-[8px]"
                  style={card}
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        );
      case "galeria":
        return (
          <div>
            {titleRow("Hecho por Hefesto")}
            <div className="grid grid-cols-4 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    ...card,
                    aspectRatio: "1",
                    background: `linear-gradient(135deg, ${accent}2e, var(--surface-2))`,
                  }}
                />
              ))}
            </div>
          </div>
        );
      case "comoFunciona":
        return (
          <div>
            {titleRow("¿Cómo funciona?")}
            <div className="grid grid-cols-3 gap-1.5">
              {["Elegís", "Imprimimos", "Recibís"].map((t, i) => (
                <div
                  key={t}
                  className="flex flex-col items-center gap-1 py-2"
                  style={card}
                >
                  <span
                    className="grid place-items-center text-[8px] font-bold"
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      background: accent,
                      color: "#1a1505",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[7.5px]">{t}</span>
                </div>
              ))}
            </div>
          </div>
        );
      case "testimonios":
        return (
          <div className="px-2.5 py-2" style={card}>
            <div className="text-[9px]" style={{ color: accent }}>
              ★★★★★
            </div>
            <div className="text-faint mt-1 text-[8.5px] leading-snug">
              “Quedó impecable, mejor de lo que esperaba. Vuelvo a comprar.”
            </div>
            <div className="mt-1 text-[8px] font-semibold">— Cliente feliz</div>
          </div>
        );
      case "faq":
        return (
          <div>
            {titleRow("Preguntas frecuentes")}
            <div className="flex flex-col gap-1">
              {["¿Cuánto tarda?", "¿Hacen envíos?", "¿Puedo elegir color?"].map(
                (q) => (
                  <div
                    key={q}
                    className="flex items-center justify-between px-2 py-1.5 text-[8.5px]"
                    style={card}
                  >
                    {q}
                    <span className="text-faint">+</span>
                  </div>
                ),
              )}
            </div>
          </div>
        );
      case "pedidoMedida":
        return (
          <div
            className="flex items-center justify-between px-2.5 py-2.5"
            style={{
              borderRadius: 8,
              background: `linear-gradient(135deg, ${accent}, ${accent}aa)`,
            }}
          >
            <div className="text-[9px] font-bold" style={{ color: "#1a1505" }}>
              ¿Tenés una idea? La imprimimos
            </div>
            <span
              className="rounded-full px-2 py-1 text-[8px] font-bold"
              style={{ background: "#1a1505", color: accent }}
            >
              Pedir
            </span>
          </div>
        );
      case "newsletter":
        return (
          <div className="px-2.5 py-2" style={card}>
            <div className="mb-1 text-[9px] font-bold">
              Sumate al newsletter
            </div>
            <div className="flex gap-1">
              <div
                className="flex-1 rounded px-1.5 py-1 text-[8px]"
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text-faint)",
                }}
              >
                tu@email.com
              </div>
              <span
                className="rounded px-2 py-1 text-[8px] font-bold"
                style={{ background: accent, color: "#1a1505" }}
              >
                Unirme
              </span>
            </div>
          </div>
        );
      default:
        return (
          <div className="px-2 py-2 text-[9px]" style={card}>
            {label}
          </div>
        );
    }
  }

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
        {["#e0605a", "#e0b34a", "#5ed29a"].map((c) => (
          <span
            key={c}
            style={{ width: 9, height: 9, borderRadius: 999, background: c }}
          />
        ))}
        <span className="text-faint ml-2 text-[11px]">tutienda.com</span>
      </div>

      <div style={{ maxHeight: 480, overflowY: "auto" }}>
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
            background: banner?.imageUrl
              ? `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), center/cover url('${banner.imageUrl}')`
              : `linear-gradient(135deg, ${accent}26, transparent 60%), var(--surface-2)`,
            textAlign: banner?.align === "center" ? "center" : "left",
            color: banner?.imageUrl ? "#fff" : undefined,
          }}
        >
          <div className="font-display text-[15px] leading-tight font-extrabold">
            {banner?.title ?? "Diseños imposibles, impresos en 3D"}
          </div>
          <div
            className="mt-1 text-[10px]"
            style={{ opacity: banner?.imageUrl ? 0.9 : 0.6 }}
          >
            {banner?.subtitle ?? "Del archivo a tu puerta, capa por capa."}
          </div>
          <span
            className="mt-3 inline-block rounded-full px-3 py-1 text-[10px] font-semibold"
            style={{ background: accent, color: "#1a1505" }}
          >
            {banner?.ctaText ?? "Explorar catálogo"}
          </span>
        </div>

        {/* secciones activas, dibujadas como en la tienda */}
        <div className="flex flex-col gap-3 p-4">
          {enabled.map((s) => (
            <div key={s.id}>{renderSection(s.id, s.label)}</div>
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
