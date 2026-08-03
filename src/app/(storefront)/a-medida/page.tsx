import { getBrandSettings } from "@/features/settings/service";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Pedí tu pieza personalizada",
  description:
    "¿Tenés una idea? La diseñamos e imprimimos en 3D para vos. Pedila por WhatsApp, sin cuenta.",
};

/**
 * Landing de pedidos a medida. ADELGAZADA el 2026-08-03 (Ale: "parece muy
 * pesada; que la gente entre y ya le diga todo simple, y el botón de WhatsApp").
 *
 * Antes tenía seis bloques (hero + 3 tarjetas de beneficios + título + 3
 * tarjetas de pasos + tarjeta de cierre con OTRO botón), y los beneficios
 * repetían lo que ya decían los pasos. Quedaron DOS: lo que hacemos + cómo se
 * pide. El botón va arriba de todo, que es lo único que tiene que hacer el
 * cliente; los pasos son texto liviano, sin tarjetas, para que no pese.
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

/** Lo que el cliente necesita saber antes de escribir, en cuatro palabras. */
const TRUST = [
  "Sin cuenta",
  "Presupuesto sin cargo",
  "Cualquier color",
  "Entrega o envío",
];

const STEPS: [string, string][] = [
  [
    "Escribinos",
    "Contanos la idea, el tamaño y el color. Si tenés foto, mejor.",
  ],
  ["Te cotizamos", "Te pasamos el precio por el mismo chat, sin compromiso."],
  [
    "Lo imprimimos",
    "Aprobás, lo fabricamos y coordinamos la entrega o el envío.",
  ],
];

export default async function AMedidaPage() {
  const brand = await getBrandSettings();
  const wa = waHref(brand.whatsapp);

  return (
    <section className="store-section">
      <div className="store-wrap" style={{ maxWidth: 780 }}>
        <div className="text-center">
          <div className="eyebrow">Hecho para vos</div>
          <h1 className="sec-title mt-1">Pedí tu pieza personalizada</h1>
          <p className="text-dim mx-auto mt-3 max-w-md text-[15px] leading-relaxed">
            Contanos qué necesitás por WhatsApp y te pasamos el presupuesto. Lo
            diseñamos e imprimimos para vos.
          </p>

          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer noopener"
              className="btn btn-primary btn-lg mt-6 inline-flex"
              style={{ gap: 8 }}
            >
              <WaIcon size={19} /> Pedila por WhatsApp
            </a>
          ) : (
            <p className="text-faint mx-auto mt-6 max-w-sm text-[13px]">
              Configurá tu número de WhatsApp en Ajustes para habilitar el
              botón.
            </p>
          )}

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

        {/* Los tres pasos, livianos: sin tarjetas ni títulos de sección. */}
        <ol className="mt-12 grid gap-6 sm:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="text-center sm:text-left">
              <span
                className="mb-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-bold"
                style={{
                  background: "rgba(var(--gold-rgb),.14)",
                  color: "var(--gold-bright)",
                }}
              >
                {i + 1}
              </span>
              <div className="text-fg text-[15px] font-semibold">{t}</div>
              <p className="text-dim mt-1 text-[13.5px] leading-relaxed">{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
