import { getBrandSettings } from "@/features/settings/service";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Pedí tu pieza personalizada",
  description:
    "¿Tenés una idea? La imprimimos en 3D para vos. Escribinos por WhatsApp y coordinamos todo por ahí, sin cuenta.",
};

// Mensaje pre-armado que se abre en WhatsApp al tocar el botón.
const WA_TEMPLATE = `¡Hola Hefesto! Quiero pedir una pieza personalizada 🖨️

• Qué quiero:
• Tamaño aprox:
• Color / material:
• Para cuándo:
• Ciudad (envío):

(Si tengo una foto o referencia, la mando por acá 🙌)`;

const STEPS: [string, string][] = [
  [
    "Escribinos",
    "Contanos tu idea por WhatsApp: qué querés, tamaño, color y para cuándo.",
  ],
  [
    "Te cotizamos",
    "Vemos la idea y te pasamos el presupuesto por el mismo chat, sin compromiso.",
  ],
  ["Lo imprimimos", "Apenas aprobás, lo fabricamos y coordinamos la entrega."],
];

const INCLUDE = [
  "Qué pieza querés (o una foto de referencia)",
  "Tamaño aproximado",
  "Color o material",
  "Para cuándo la necesitás",
  "Tu ciudad, para coordinar el envío",
];

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

function waHref(whatsapp: string | null): string | null {
  if (!whatsapp) return null;
  const d = whatsapp.replace(/[^\d]/g, "");
  return d
    ? `https://wa.me/${d}?text=${encodeURIComponent(WA_TEMPLATE)}`
    : null;
}

export default async function AMedidaPage() {
  const brand = await getBrandSettings();
  const wa = waHref(brand.whatsapp);
  return (
    <section className="store-section">
      <div className="store-wrap" style={{ maxWidth: 780 }}>
        <div className="text-center">
          <div className="eyebrow">Hecho para vos</div>
          <h1 className="sec-title mt-1">Pedí tu pieza personalizada</h1>
          <p className="text-dim mx-auto mt-2 max-w-lg text-sm leading-relaxed">
            ¿Tenés una idea? La imprimimos en 3D para vos. Escribinos por
            WhatsApp y coordinamos todo por ahí — sin cuenta, sin vueltas.
          </p>
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer noopener"
              className="btn btn-primary mt-5 inline-flex"
              style={{ gap: 8 }}
            >
              <WaIcon size={18} />
              Pedila por WhatsApp
            </a>
          ) : (
            <p className="text-faint mx-auto mt-5 max-w-sm text-[13px]">
              Configurá tu número de WhatsApp en Ajustes para habilitar el
              botón.
            </p>
          )}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <div key={t} className="ui-card p-4">
              <div
                className="mb-2 flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-bold"
                style={{
                  background: "rgba(var(--gold-rgb),.14)",
                  color: "var(--gold-bright)",
                }}
              >
                {i + 1}
              </div>
              <div className="text-fg text-[14px] font-semibold">{t}</div>
              <div className="text-dim mt-0.5 text-[12.5px] leading-relaxed">
                {d}
              </div>
            </div>
          ))}
        </div>

        <div className="ui-card mt-4 p-5">
          <div className="text-fg text-[14px] font-semibold">
            Contanos esto para cotizarte más rápido
          </div>
          <ul className="mt-3 grid gap-2">
            {INCLUDE.map((t) => (
              <li
                key={t}
                className="text-dim flex items-start gap-2 text-[13px]"
              >
                <span
                  className="mt-0.5 flex-shrink-0"
                  style={{ color: "var(--gold-bright)" }}
                  aria-hidden
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                {t}
              </li>
            ))}
          </ul>
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer noopener"
              className="btn btn-primary mt-4 inline-flex"
              style={{ gap: 8 }}
            >
              <WaIcon size={17} />
              Escribinos por WhatsApp
            </a>
          ) : null}
          <p className="text-faint mt-3 text-[12px]">
            La foto de referencia mandala directamente por WhatsApp — es más
            fácil desde el chat.
          </p>
        </div>
      </div>
    </section>
  );
}
