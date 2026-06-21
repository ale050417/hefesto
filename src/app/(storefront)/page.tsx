import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ProductGrid } from "@/features/products/components/product-grid";
import { getHomeData } from "@/features/products/services/catalogService";
import { getBrandSettings } from "@/features/settings/service";
import { Newsletter } from "@/features/cart/components/newsletter";
import type { ProductView } from "@/features/products/types";

export const dynamic = "force-dynamic";

const paths: Record<string, ReactNode> = {
  truck: (
    <>
      <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  layers: <path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5" />,
  refresh: (
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
  ),
  box: (
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.3 7 12 12l8.7-5M12 22V12" />
    </>
  ),
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
  star: (
    <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
  ),
  printer: (
    <>
      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v8H6z" />
    </>
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  ),
  sparkles: (
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  ),
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
      {paths[name]}
    </svg>
  );
}

const heroStats = [
  { n: "3.490+", l: "Productos impresos" },
  { n: "4.9★", l: "Valoración media" },
  { n: "48h", l: "Producción promedio" },
];
const trust = [
  {
    ic: "truck",
    t: "Producción en 48 h",
    d: "Imprimimos y despachamos rápido",
  },
  {
    ic: "shield",
    t: "Pago 100% seguro",
    d: "MercadoPago, transferencia y efectivo",
  },
  { ic: "layers", t: "Materiales premium", d: "PLA, PETG, TPU y resina" },
  {
    ic: "refresh",
    t: "Reimpresión garantizada",
    d: "Si algo sale mal, lo rehacemos",
  },
];
const statsNums = [
  { n: "3.490+", l: "Piezas impresas", ic: "box" },
  { n: "1.200+", l: "Clientes felices", ic: "users" },
  { n: "12", l: "Materiales y acabados", ic: "layers" },
  { n: "4.9★", l: "Valoración promedio", ic: "star" },
];
const materials: Array<[string, string, string, string]> = [
  [
    "PLA",
    "#4CB782",
    "Resistente y versátil",
    "Ideal para deco, figuras y prototipos.",
  ],
  [
    "PETG",
    "#5A9CD9",
    "Fuerte y flexible",
    "Piezas funcionales y de exterior. Durable.",
  ],
  ["TPU", "#C9A84C", "Flexible tipo goma", "Fundas, topes y piezas elásticas."],
  [
    "Resina",
    "#9B7BD4",
    "Máximo detalle",
    "Figuras y miniaturas con acabado ultra fino.",
  ],
];
const gallery = [
  "Lámpara lunar",
  "Dragón flex",
  "Set de dados",
  "Maceta hexa",
  "Llaveros custom",
  "Reloj engranaje",
  "Figura golem",
  "Soporte joystick",
];
const steps = [
  {
    n: 1,
    t: "Elegís tu diseño",
    d: "Explorá el catálogo o pedí algo personalizado.",
  },
  {
    n: 2,
    t: "Lo imprimimos",
    d: "Forjamos tu pieza capa por capa con control de calidad.",
  },
  {
    n: 3,
    t: "Llega a tu puerta",
    d: "Envío a todo el país o retiro en el taller.",
  },
];
const testimonials: Array<[string, string]> = [
  [
    "Martina A.",
    "La lámpara lunar superó mis expectativas. Calidad impecable y llegó en 2 días.",
  ],
  ["Lucas F.", "Pedí un set de dados personalizado. Detalle increíble."],
  ["Sofía B.", "El dragón articulado es una locura. Mis hijos lo aman."],
];
const faqs: Array<[string, string]> = [
  [
    "¿Cuánto tarda mi pedido?",
    "Todo se imprime a pedido. El tiempo figura en cada producto, en general 24 a 48 hs.",
  ],
  [
    "¿Puedo elegir el color?",
    "¡Sí! Muchos productos permiten elegir color. Lo ves en la página del producto.",
  ],
  [
    "¿Hacen diseños personalizados?",
    "Claro. Contanos tu idea y te pasamos un presupuesto sin compromiso.",
  ],
  [
    "¿Cómo son los envíos?",
    "Envíos a todo el país y retiro gratis en el taller.",
  ],
  [
    "¿Qué medios de pago aceptan?",
    "MercadoPago, transferencia bancaria y efectivo al retirar.",
  ],
];

function ProductSection({
  eyebrow,
  title,
  products,
  href,
}: {
  eyebrow: string;
  title: string;
  products: ProductView[];
  href?: string;
}) {
  if (products.length === 0) return null;
  return (
    <section className="store-section pt-0">
      <div className="store-wrap">
        <div className="sec-head">
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h2 className="sec-title">{title}</h2>
          </div>
          {href ? (
            <Link href={href} className={buttonVariants({ variant: "ghost" })}>
              Ver todos &rarr;
            </Link>
          ) : null}
        </div>
        <ProductGrid products={products} />
      </div>
    </section>
  );
}

export default async function Home() {
  const [{ featured, latest, onSale, categories }, brand] = await Promise.all([
    getHomeData(),
    getBrandSettings(),
  ]);

  return (
    <div>
      <section className="hero">
        <div className="store-wrap grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <span className="hero-tag">
              <Icon name="sparkles" size={15} /> Impresión 3D a pedido
            </span>
            <h1 className="hero-title">
              Diseños <span className="gold">imposibles</span>,
              <br />
              impresos en 3D
            </h1>
            <p className="hero-sub">
              Del archivo a tu puerta. Productos únicos forjados capa por capa,
              en el color que elijas.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/catalogo"
                className={buttonVariants({ variant: "primary", size: "lg" })}
              >
                Explorar catálogo
              </Link>
              <Link
                href="/catalogo?sale=true"
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                Ofertas
              </Link>
            </div>
            <div className="hero-stats">
              {heroStats.map((s) => (
                <div key={s.l} className="hero-stat">
                  <div className="n">{s.n}</div>
                  <div className="l">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {brand.heroImageUrl ? (
            <div
              className="ui-card relative hidden aspect-square w-full overflow-hidden lg:block"
              style={{ borderColor: "rgba(var(--gold-rgb),.22)" }}
            >
              <Image
                src={brand.heroImageUrl}
                alt="Hefesto 3D"
                fill
                sizes="(max-width:1024px) 0px, 560px"
                className="object-cover"
                priority
              />
            </div>
          ) : (
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
          )}
        </div>
      </section>

      <section className="trust-bar">
        <div className="store-wrap">
          <div className="trust-grid">
            {trust.map((t) => (
              <div key={t.t} className="trust-item">
                <span className="trust-ic">
                  <Icon name={t.ic} />
                </span>
                <div>
                  <div className="trust-t">{t.t}</div>
                  <div className="trust-d">{t.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="store-section">
          <div className="store-wrap">
            <div className="sec-head">
              <div>
                <div className="eyebrow">Explorá</div>
                <h2 className="sec-title">Categorías destacadas</h2>
              </div>
              <Link
                href="/catalogo"
                className={buttonVariants({ variant: "ghost" })}
              >
                Ver todo &rarr;
              </Link>
            </div>
            <div className="cat-row">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/catalogo?category=${category.slug}`}
                  className="cat-chip"
                  style={
                    { "--cc": category.color ?? "var(--gold)" } as CSSProperties
                  }
                >
                  <span className="cat-chip-ic">&#9670;</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="cat-chip-name truncate">
                      {category.name}
                    </span>
                    <span className="cat-chip-count">Ver productos</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <ProductSection
        eyebrow="Recién salidos"
        title="Nuevos lanzamientos"
        products={latest}
        href="/catalogo"
      />

      <section className="store-section pt-0">
        <div className="store-wrap">
          <div className="sec-head flex-col items-center text-center">
            <div>
              <div className="eyebrow">Forjando confianza</div>
              <h2 className="sec-title">Hefesto en números</h2>
            </div>
          </div>
          <div className="stats-grid">
            {statsNums.map((s) => (
              <div key={s.l} className="stat-card">
                <span className="stat-ic">
                  <Icon name={s.ic} size={22} />
                </span>
                <div className="stat-n">{s.n}</div>
                <div className="stat-l">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {onSale.length > 0 ? (
        <section className="store-section pt-0">
          <div className="store-wrap">
            <div
              className="ui-card p-8"
              style={{
                background:
                  "linear-gradient(120deg, rgba(var(--danger-rgb),.10), transparent 55%), var(--surface-1)",
                borderColor: "rgba(var(--danger-rgb),.2)",
              }}
            >
              <div className="sec-head">
                <div>
                  <div className="eyebrow" style={{ color: "var(--danger)" }}>
                    Por tiempo limitado
                  </div>
                  <h2 className="sec-title">En oferta esta semana</h2>
                </div>
                <Link
                  href="/catalogo?sale=true"
                  className={buttonVariants({ variant: "ghost" })}
                >
                  Ver todas &rarr;
                </Link>
              </div>
              <ProductGrid products={onSale} />
            </div>
          </div>
        </section>
      ) : null}

      <section className="store-section pt-0">
        <div className="store-wrap">
          <div className="sec-head">
            <div>
              <div className="eyebrow">Calidad de taller</div>
              <h2 className="sec-title">Materiales que imprimimos</h2>
              <div className="sec-sub">
                Elegimos el filamento ideal según tu pieza
              </div>
            </div>
          </div>
          <div className="grid-4">
            {materials.map(([m, c, t, d]) => (
              <div
                key={m}
                className="mat-card"
                style={{ "--mc": c } as CSSProperties}
              >
                <div className="mat-top">
                  <span
                    className="mat-chip"
                    style={{ background: `${c}1f`, color: c }}
                  >
                    {m}
                  </span>
                  <span className="mat-dot" style={{ background: c }} />
                </div>
                <div className="mat-t">{t}</div>
                <div className="mat-d">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ProductSection
        eyebrow="Favoritos del público"
        title="Más vendidos"
        products={featured}
      />

      <section className="store-section pt-0">
        <div className="store-wrap">
          <div className="sec-head">
            <div>
              <div className="eyebrow">De nuestro taller</div>
              <h2 className="sec-title">Hecho por Hefesto</h2>
            </div>
          </div>
          <div className="gallery-grid">
            {gallery.map((cap, i) => (
              <div key={cap} className={`gal-item ${i === 0 ? "gal-lg" : ""}`}>
                <div className="ph h-full w-full" />
                <div className="gal-cap">
                  <Icon name="heart" size={13} /> {cap}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="store-section pt-0">
        <div className="store-wrap">
          <div className="sec-head flex-col items-center text-center">
            <div>
              <div className="eyebrow">Simple y rápido</div>
              <h2 className="sec-title">¿Cómo funciona?</h2>
            </div>
          </div>
          <div className="grid-3">
            {steps.map((s) => (
              <div key={s.t} className="step">
                <div className="step-n">{s.n}</div>
                <h4>{s.t}</h4>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="store-section pt-0">
        <div className="store-wrap">
          <div className="sec-head">
            <div>
              <div className="eyebrow">Lo que dicen</div>
              <h2 className="sec-title">Clientes felices</h2>
            </div>
          </div>
          <div className="grid-3">
            {testimonials.map(([name, quote]) => (
              <div key={name} className="testi">
                <div className="stars">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Icon key={i} name="star" size={16} />
                  ))}
                </div>
                <p>&ldquo;{quote}&rdquo;</p>
                <div className="flex items-center gap-2">
                  <span className="avatar">{name[0]}</span>
                  <b className="text-sm">{name}</b>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="store-section pt-0">
        <div className="store-wrap">
          <div className="faq-grid">
            <div className="faq-intro">
              <div className="eyebrow">¿Dudas?</div>
              <h2 className="sec-title mt-2 mb-3">Preguntas frecuentes</h2>
              <p className="text-dim text-sm leading-relaxed">
                Todo lo que necesitás saber antes de tu pedido.
              </p>
            </div>
            <div className="faq-list">
              {faqs.map(([q, a]) => (
                <details key={q} className="faq-item">
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
      <Newsletter />
    </div>
  );
}
