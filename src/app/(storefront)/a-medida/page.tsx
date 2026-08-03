import type { ReactNode } from "react";
import { getBrandSettings } from "@/features/settings/service";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Pedí tu pieza personalizada",
  description:
    "¿Tenés una idea? La diseñamos e imprimimos en 3D para vos. Pedila por WhatsApp, sin cuenta.",
};

/**
 * Landing de pedidos a medida (rediseñada 2026-08-03).
 *
 * Historia: primero tenía SEIS bloques y se sentía pesada; la achiqué a texto
 * plano y quedó pobre ("se ve horrible"). Este es el punto medio: DOS bloques,
 * pero con el peso visual de la marca.
 *
 * Reusa a propósito el lenguaje del inicio en vez de inventar estilos nuevos:
 * la tarjeta con degradé dorado (`cust-cta`/`cust-grid`/`cust-art`) y el CUBO
 * 3D girando (`scene`/`cube`/`face` + `layer-lines`), que es la firma visual de
 * Hefesto. Así la página se ve parte del sitio y no un parche. En celular el
 * cubo se oculta solo (regla de `.cust-art` a 900px) para no pesar.
 */

// Mensaje pre-armado que se abre en WhatsApp: el cliente ya nos manda qué
// quiere (idea, tamaño, color) de una, sin que se lo tengamos que preguntar.
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

/** Glifos de las 6 caras del cubo (mismos trazos que el inicio). */
const FACE_PATHS: Record<string, ReactNode> = {
  sparkles: (
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  ),
  box: (
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.3 7 12 12l8.7-5M12 22V12" />
    </>
  ),
  printer: (
    <>
      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v8H6z" />
    </>
  ),
  layers: <path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5" />,
  palette: (
    <>
      <circle cx="13.5" cy="6.5" r="1.5" />
      <circle cx="17.5" cy="10.5" r="1.5" />
      <circle cx="8.5" cy="7.5" r="1.5" />
      <circle cx="6.5" cy="12.5" r="1.5" />
      <path d="M12 2a10 10 0 0 0 0 20c1 0 1.5-.8 1.5-1.5 0-.5-.3-.9-.3-1.4 0-.6.5-1.1 1.1-1.1H16a5 5 0 0 0 5-5c0-5.5-4.5-9-9-9z" />
    </>
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  ),
};

function FaceIcon({ name }: { name: keyof typeof FACE_PATHS }) {
  return (
    <svg
      width={54}
      height={54}
      viewBox="0 0 24 24"
      fill={name === "heart" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {FACE_PATHS[name]}
    </svg>
  );
}

function WaIcon({ size = 19 }: { size?: number }) {
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

/** Lo que el cliente necesita saber antes de escribir. */
const TRUST = [
  "Sin cuenta",
  "Presupuesto sin cargo",
  "Cualquier color",
  "Entrega o envío",
];

const STEPS: [string, string][] = [
  [
    "Escribinos",
    "Contanos la idea, el tamaño y el color. Si tenés una foto, mejor todavía.",
  ],
  [
    "Te cotizamos",
    "Te pasamos el precio por el mismo chat, sin cargo y sin compromiso.",
  ],
  [
    "Lo imprimimos",
    "Aprobás, lo fabricamos capa por capa y coordinamos la entrega.",
  ],
];

export default async function AMedidaPage() {
  const brand = await getBrandSettings();
  const wa = waHref(brand.whatsapp);

  return (
    <section className="store-section">
      <div className="store-wrap" style={{ maxWidth: 1000 }}>
        {/* ---- Bloque 1: la propuesta + el botón, con el cubo de la marca ---- */}
        <div
          className="ui-card cust-cta overflow-hidden"
          style={{ borderColor: "rgba(var(--gold-rgb),.25)" }}
        >
          <div className="cust-grid">
            <div className="p-7 sm:p-11">
              <div className="eyebrow">Hecho para vos</div>
              <h1 className="sec-title mt-2 mb-3">
                Pedí tu pieza <span className="gold">personalizada</span>
              </h1>
              <p className="text-dim mb-6 max-w-[430px] text-[15px] leading-relaxed">
                ¿Tenés una idea? La diseñamos y la imprimimos en 3D para vos.
                Escribinos por WhatsApp con lo que necesitás y te pasamos el
                presupuesto.
              </p>

              {wa ? (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn btn-primary btn-lg inline-flex"
                  style={{ gap: 9 }}
                >
                  <WaIcon /> Pedila por WhatsApp
                </a>
              ) : (
                <p className="text-faint max-w-sm text-[13px]">
                  Configurá tu número de WhatsApp en Ajustes para habilitar el
                  botón.
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-2">
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

            {/* El cubo dorado girando: la misma pieza visual del inicio. */}
            <div className="cust-art">
              <div className="scene" style={{ height: 300, width: "100%" }}>
                <div className="cube">
                  <div className="face f-front">
                    <FaceIcon name="sparkles" />
                  </div>
                  <div className="face f-back">
                    <FaceIcon name="box" />
                  </div>
                  <div className="face f-right">
                    <FaceIcon name="printer" />
                  </div>
                  <div className="face f-left">
                    <FaceIcon name="layers" />
                  </div>
                  <div className="face f-top">
                    <FaceIcon name="palette" />
                  </div>
                  <div className="face f-bottom">
                    <FaceIcon name="heart" />
                  </div>
                </div>
                <div className="layer-lines" />
              </div>
            </div>
          </div>
        </div>

        {/* ---- Bloque 2: cómo se pide, en tres pasos ---- */}
        <div className="sec-head mt-14 flex-col items-center text-center">
          <div>
            <div className="eyebrow">Simple y rápido</div>
            <h2 className="sec-title mt-1">Cómo se pide</h2>
          </div>
        </div>
        <ol className="steps-grid mt-8">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="step">
              <div className="step-n">{i + 1}</div>
              <h4>{t}</h4>
              <p>{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
