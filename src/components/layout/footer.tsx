import Image from "next/image";
import Link from "next/link";
import { getBusinessSettings } from "@/features/settings/service";
import { listCategories } from "@/features/products/services/catalogService";
import { BrandMark } from "./brand-mark";

function waHref(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "https://wa.me/";
  return `https://wa.me/${digits.length <= 10 ? "54" + digits : digits}`;
}
function igHref(raw: string | null | undefined): string {
  const h = (raw ?? "").replace(/^@/, "").trim();
  if (!h) return "#";
  return h.startsWith("http") ? h : `https://instagram.com/${h}`;
}
function mapsHref(raw: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw)}`;
}

const Ic = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    aria-hidden
    dangerouslySetInnerHTML={{ __html: d }}
  />
);

const ICONS = {
  wa: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>',
  ig: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>',
  store:
    '<path d="M3 9l1-5h16l1 5M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M3 9h18M9 21v-6h6v6"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
};

export async function Footer() {
  const year = new Date().getFullYear();
  const [s, categories] = await Promise.all([
    getBusinessSettings(),
    listCategories(),
  ]);
  const name = s?.storeName?.trim() || "Hefesto 3D";
  const slogan = s?.slogan?.trim() || "Forjado en capas";
  const desc =
    s?.description?.trim() ||
    "Impresión 3D premium hecha en Argentina. Diseños únicos forjados capa por capa.";
  const wa = s?.whatsapp?.trim() || "+54 11 5512-8834";
  const ig = s?.instagram?.trim() || "hefesto3d";
  const email = s?.contactEmail?.trim() || "hola@hefesto3d.com";
  const address =
    s?.addressText?.trim() || "Av. Victoria Aguirre 320, Puerto Iguazú";
  const topCats = categories.slice(0, 3);

  return (
    <footer className="footer">
      <div className="store-wrap">
        <div className="foot-grid">
          <div>
            <Link href="/" className="brand mb-3">
              {s?.logoUrl ? (
                <Image
                  src={s.logoUrl}
                  alt={name}
                  width={150}
                  height={40}
                  className="h-9 w-auto object-contain"
                />
              ) : (
                <>
                  <BrandMark size={40} />
                  <span className="brand-name">
                    HEFESTO<b> 3D</b>
                  </span>
                </>
              )}
            </Link>
            <p className="text-faint max-w-[280px] text-sm leading-relaxed">
              {desc}
            </p>
            <div className="mt-4 flex gap-2">
              <a
                href={waHref(wa)}
                target="_blank"
                rel="noreferrer noopener"
                className="icon-btn"
                style={{ background: "var(--surface-2)" }}
                aria-label="WhatsApp"
              >
                <Ic d={ICONS.wa} />
              </a>
              <a
                href={igHref(ig)}
                target="_blank"
                rel="noreferrer noopener"
                className="icon-btn"
                style={{ background: "var(--surface-2)" }}
                aria-label="Instagram"
              >
                <Ic d={ICONS.ig} />
              </a>
              <Link
                href="/catalogo"
                className="icon-btn"
                style={{ background: "var(--surface-2)" }}
                aria-label="Catálogo"
              >
                <Ic d={ICONS.store} />
              </Link>
            </div>
          </div>

          <div>
            <h5>Tienda</h5>
            <Link href="/catalogo">Catálogo</Link>
            <Link href="/catalogo?sale=true">Ofertas</Link>
            {topCats.map((c) => (
              <Link key={c.id} href={`/catalogo?category=${c.slug}`}>
                {c.name}
              </Link>
            ))}
          </div>

          <div>
            <h5>Ayuda</h5>
            <Link href="/#faq">Envíos y devoluciones</Link>
            <Link href="/cuenta/pedidos">Seguir mi pedido</Link>
            <Link href="/#faq">Preguntas frecuentes</Link>
            <Link href="/cuenta/a-medida">Pedidos personalizados</Link>
          </div>

          <div>
            <h5>Contacto</h5>
            {wa ? (
              <a
                href={waHref(wa)}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-2"
              >
                <Ic d={ICONS.wa} size={15} /> {wa}
              </a>
            ) : null}
            {email ? (
              <a href={`mailto:${email}`} className="flex items-center gap-2">
                <Ic d={ICONS.mail} size={15} /> {email}
              </a>
            ) : null}
            {address ? (
              <a
                href={mapsHref(address)}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-2"
              >
                <Ic d={ICONS.pin} size={15} /> {address}
              </a>
            ) : null}
          </div>
        </div>

        <div className="text-faint flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-6 text-xs">
          <span>
            &copy; {year} {name} · {slogan}
          </span>
          <span className="flex items-center gap-4">
            <Link href="/#faq" className="hover:text-fg">
              Políticas
            </Link>
            <Link href="/#faq" className="hover:text-fg">
              Privacidad
            </Link>
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-[var(--gold-bright)]"
            >
              <Ic d={ICONS.shield} size={14} /> Panel de gestión
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
