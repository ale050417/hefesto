import type { ReactNode } from "react";
import { getBrandSettings } from "@/features/settings/service";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Pedí tu pieza personalizada",
  description:
    "¿Tenés una idea? La diseñamos e imprimimos en 3D para vos. Pedila por WhatsApp, sin cuenta.",
};

// Mensaje pre-armado que se abre en WhatsApp al tocar cualquier botón, así el
// cliente ya nos manda qué quiere (idea, tamaño, color, etc.) de una.
const WA_TEMPLATE = `¡Hola Hefesto! Quiero pedir una pieza personalizada 🖨️

• Qué quiero:
• Tamaño aprox:
• Color / material:
• Para cuándo:
• Ciudad (envío):

(Si tengo una foto o referencia, la mando por acá 🙌)`;

function waHref(whatsapp: string | null): string | null {
  if (!whatsapp) return null;
  const d = whatsapp.replace(/[^\d]/g, "");
  return d
    ? `https://wa.me/${d}?text=${encodeURIComponent(WA_TEMPLATE)}`
    : null;
}

function WaIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.4.5-.3.3c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.7-.9c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z" />
    </svg>
  );
}

const FEATURES: { title: string; desc: string; icon: ReactNode }[] = [
  {
    title: "Diseño a tu medida",
    desc: "Traés tu idea (o una foto de referencia) y la modelamos e imprimimos en 3D para vos.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
      </svg>
    ),
  },
  {
    title: "Cualquier color y material",
    desc: "Elegís el color y el acabado; trabajamos con distintos filamentos y calidades.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5" />
      </svg>
    ),
  },
  {
    title: "Coordinamos por WhatsApp",
    desc: "Te pasamos el presupuesto sin cargo y ajustamos todos los detalles por chat.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.3 8.7 8.7 0 0 1-3.8-.9L3 20l1.1-4.1A8.3 8.3 0 0 1 3 11.5a8.4 8.4 0 0 1 9-8.3 8.4 8.4 0 0 1 9 8.3z" />
      </svg>
    ),
  },
];

const STEPS: [string, string][] = [
  [
    "Escribinos",
    "Contanos qué querés por WhatsApp: la idea, el tamaño, el color y para cuándo.",
  ],
  [
    "Te cotizamos",
    "Revisamos y te pasamos el presupuesto por el mismo chat, sin compromiso.",
  ],
  [
    "Lo imprimimos",
    "Aprobás y lo fabricamos. Coordinamos la entrega o el envío a tu ciudad.",
  ],
];

const TRUST = ["Sin cuenta", "Presupuesto sin cargo", "Entrega o envío"];

export default async function AMedidaPage() {
  const brand = await getBrandSettings();
  const wa = waHref(brand.whatsapp);

  const cta = (label: string, size = 18) =>
    wa ? (
      <a
        href={wa}
        target="_blank"
        rel="noreferrer noopener"
        className="btn btn-primary inline-flex"
        style={{ gap: 8 }}
      >
        <WaIcon size={size} />
        {label}
      </a>
    ) : (
      <p className="text-faint mx-auto max-w-sm text-[13px]">
        Configurá tu número de WhatsApp en Ajustes para habilitar el botón.
      </p>
    );

  return (
    <section className="store-section">
      <div className="store-wrap" style={{ maxWidth: 920 }}>
        {/* Hero */}
        <div className="text-center">
          <div className="eyebrow">Hecho para vos</div>
          <h1 className="sec-title mt-1">Pedí tu pieza personalizada</h1>
          <p className="text-dim mx-auto mt-3 max-w-xl text-[15px] leading-relaxed">
            ¿Tenés una idea? La diseñamos e imprimimos en 3D para vos.
            Escribinos por WhatsApp con lo que querés —y una foto si tenés— y
            coordinamos todo por ahí, sin cuenta y sin vueltas.
          </p>
          <div className="mt-6">{cta("Pedila por WhatsApp", 18)}</div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {TRUST.map((t) => (
              <span
                key={t}
                className="text-dim inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px]"
                style={{ background: "rgba(var(--gold-rgb),.10)" }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="var(--gold-bright)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="ui-card p-6">
              <span
                className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full"
                style={{
                  background: "rgba(var(--gold-rgb),.14)",
                  color: "var(--gold-bright)",
                }}
              >
                {f.icon}
              </span>
              <div className="text-fg text-[15px] font-semibold">{f.title}</div>
              <p className="text-dim mt-1 text-[13px] leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Cómo funciona */}
        <div className="mt-10 text-center">
          <div className="eyebrow">Simple y rápido</div>
          <h2 className="sec-title mt-1 text-[22px]">Cómo funciona</h2>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <div key={t} className="ui-card p-6">
              <div
                className="mb-3 flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-bold"
                style={{
                  background: "rgba(var(--gold-rgb),.14)",
                  color: "var(--gold-bright)",
                }}
              >
                {i + 1}
              </div>
              <div className="text-fg text-[15px] font-semibold">{t}</div>
              <p className="text-dim mt-1 text-[13px] leading-relaxed">{d}</p>
            </div>
          ))}
        </div>

        {/* Cierre */}
        <div
          className="ui-card mt-10 p-8 text-center sm:p-10"
          style={{ borderColor: "rgba(var(--gold-rgb),.25)" }}
        >
          <h2 className="text-fg font-display text-xl font-bold sm:text-2xl">
            ¿Ya tenés la idea?
          </h2>
          <p className="text-dim mx-auto mt-2 max-w-md text-sm leading-relaxed">
            Mandanos un mensaje y empezamos. Si tenés una foto o boceto,
            adjuntala en el chat: nos ayuda a cotizarte más rápido.
          </p>
          <div className="mt-5">{cta("Escribinos por WhatsApp", 17)}</div>
        </div>
      </div>
    </section>
  );
}
