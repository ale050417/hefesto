import { getBrandSettings } from "@/features/settings/service";
import { GuestRequestForm } from "@/features/custom/components/guest-request-form";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Pedido a medida",
  description:
    "¿Tenés una idea? Contanos qué querés y lo imprimimos en 3D para vos. Sin cuenta, seguimos por WhatsApp.",
};

const STEPS: [string, string][] = [
  [
    "Contanos tu idea",
    "Escribinos qué querés, el tamaño, color y para cuándo.",
  ],
  [
    "Te pasamos el precio",
    "Coordinamos por WhatsApp y te enviamos el presupuesto.",
  ],
  ["Lo imprimimos", "Apenas aprobás, lo fabricamos y te lo entregamos."],
];

export default async function AMedidaPage() {
  const brand = await getBrandSettings();
  return (
    <section className="store-section">
      <div className="store-wrap" style={{ maxWidth: 760 }}>
        <div className="text-center">
          <div className="eyebrow">Hecho para vos</div>
          <h1 className="sec-title mt-1">Pedido a medida</h1>
          <p className="text-dim mx-auto mt-2 max-w-lg text-sm leading-relaxed">
            ¿Tenés una idea? No hace falta que te registres. Contanos qué querés
            y seguimos la charla por WhatsApp.
          </p>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
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

        <div className="mx-auto mt-6" style={{ maxWidth: 560 }}>
          <GuestRequestForm whatsapp={brand.whatsapp} />
        </div>
      </div>
    </section>
  );
}
