import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProductGrid } from "@/features/products/components/product-grid";
import { getHomeData } from "@/features/products/services/catalogService";
import { HeroCarousel } from "@/components/home/hero-carousel";
import {
  getActiveBanners,
  getBrandSettings,
} from "@/features/settings/service";
import { getHomeStats } from "@/features/orders/services/publicStats";
import { safeLoad } from "@/lib/safe-load";
import { sectionOn } from "@/features/settings/home-sections";
import { PreviewBridge } from "@/features/settings/components/preview-bridge";
import { CountUp } from "@/components/home/count-up";
import { CategoryCircles } from "@/components/home/category-circles";
import { DEFAULT_FAQ } from "@/features/settings/faq-defaults";
import type { ProductView } from "@/features/products/types";

export const dynamic = "force-dynamic";
// Red de seguridad: la base está lejos; damos aire a la función para que la
// latencia no corte un render que estaba por resolver (estabilización 2026-07).
export const maxDuration = 30;

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
  zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  send: <path d="m22 2-7 20-4-9-9-4 20-7z" />,
  whatsapp: (
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
  ),
  palette: (
    <>
      <circle cx="13.5" cy="6.5" r="1.5" />
      <circle cx="17.5" cy="10.5" r="1.5" />
      <circle cx="8.5" cy="7.5" r="1.5" />
      <circle cx="6.5" cy="12.5" r="1.5" />
      <path d="M12 2a10 10 0 0 0 0 20c1 0 1.5-.8 1.5-1.5 0-.5-.3-.9-.3-1.4 0-.6.5-1.1 1.1-1.1H16a5 5 0 0 0 5-5c0-5.5-4.5-9-9-9z" />
    </>
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

const DEFAULT_TRUST = [
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
const materials: Array<[string, string, string, string]> = [
  [
    "PLA",
    "#4CB782",
    "Resistente y versátil",
    "Ideal para deco, figuras y prototipos. Amplia gama de colores.",
  ],
  [
    "PETG",
    "#5A9CD9",
    "Fuerte y flexible",
    "Soportes, piezas funcionales y de exterior. Muy durable.",
  ],
  [
    "TPU",
    "#C9A84C",
    "Flexible tipo goma",
    "Fundas, topes y piezas que necesitan elasticidad.",
  ],
  [
    "Resina",
    "#9B7BD4",
    "Máximo detalle",
    "Figuras y miniaturas con acabado ultra fino 8K.",
  ],
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
// Las preguntas del FAQ salen de brand.faq (editable desde Config → Tienda);
// si no se editó nada, se usan las DEFAULT_FAQ (importadas arriba).

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

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Modo preview (iframe del admin): se renderizan TODAS las secciones y el
  // PreviewBridge aplica el borrador (mostrar/ocultar, acento, textos) en vivo.
  const isPreview = "_preview" in (await searchParams);
  const [{ featured, latest, onSale, categories }, banners, brand, statsR] =
    await Promise.all([
      getHomeData(),
      getActiveBanners(),
      getBrandSettings(),
      safeLoad("estadísticas", getHomeStats(), { pieces: 0, customers: 0 }),
    ]);
  // En el home mostramos SOLO las categorías padre (las subcategorías se
  // navegan dentro del catálogo). Se ven como círculos en un carrusel.
  const parentCategories = categories.filter((c) => !c.parentId);
  // FAQ editable: si el dueño cargó preguntas desde Config, usamos esas; si no,
  // las de por defecto (compactas).
  const faqList = brand.faq?.length ? brand.faq : DEFAULT_FAQ;
  // "Hefesto en números": piezas y clientes REALES (pedidos finalizados); si la
  // consulta falla, el fallback deja el bloque en 0 sin romper el home.
  const stats = statsR.value;
  // Banda de confianza: textos editables desde Config; si no hay, los default.
  const trust = brand.trustBar?.length ? brand.trustBar : DEFAULT_TRUST;
  const statsNums: Array<{
    value: number;
    suffix?: string;
    decimals?: number;
    l: string;
    ic: string;
  }> = [
    {
      value: stats.pieces,
      suffix: stats.pieces > 0 ? "+" : "",
      l: "Piezas impresas",
      ic: "box",
    },
    {
      value: stats.customers,
      suffix: stats.customers > 0 ? "+" : "",
      l: "Clientes felices",
      ic: "users",
    },
    { value: 12, l: "Materiales y acabados", ic: "layers" },
    {
      value: 4.9,
      decimals: 1,
      suffix: "★",
      l: "Valoración promedio",
      ic: "star",
    },
  ];
  const show = (id: string) => isPreview || sectionOn(brand.homeSections, id);
  const previewHidden = (id: string) =>
    isPreview && !sectionOn(brand.homeSections, id)
      ? ({ display: "none" } as const)
      : undefined;

  const slides = banners.map((b) => ({
    title: b.title,
    sub: b.subtitle ?? "",
    cta: b.ctaText ?? "Ver catálogo",
    href: b.ctaHref ?? "/catalogo",
    align: (b.align === "center" ? "center" : "left") as "left" | "center",
    image: b.imageUrl ?? null,
    position: b.position ?? "center",
  }));

  // Sin banners pero con imagen de hero configurada: un slide con esa imagen.
  if (slides.length === 0 && brand.heroImageUrl) {
    slides.push({
      title: brand.storeName || "Diseños imposibles, impresos en 3D",
      sub: brand.slogan || "Del archivo a tu puerta, capa por capa.",
      cta: "Explorar catálogo",
      href: "/catalogo",
      align: "left",
      image: brand.heroImageUrl,
      position: "center",
    });
  }

  return (
    <div>
      <HeroCarousel
        slides={slides}
        intervalMs={brand.bannerIntervalSec * 1000}
      />

      {show("trustBar") ? (
        <section
          data-home-section="trustBar"
          style={previewHidden("trustBar")}
          className="trust-bar"
        >
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
      ) : null}

      {parentCategories.length > 0 && show("categorias") ? (
        <section
          data-home-section="categorias"
          style={previewHidden("categorias")}
          className="store-section"
        >
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
            <CategoryCircles categories={parentCategories} />
          </div>
        </section>
      ) : null}

      {show("nuevos") ? (
        <div data-home-section="nuevos" style={previewHidden("nuevos")}>
          <ProductSection
            eyebrow="Recién salidos"
            title="Nuevos lanzamientos"
            products={latest}
            href="/catalogo"
          />
        </div>
      ) : null}

      {show("stats") ? (
        <section
          data-home-section="stats"
          style={previewHidden("stats")}
          className="store-section pt-0"
        >
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
                  <div className="stat-n">
                    <CountUp
                      value={s.value}
                      decimals={s.decimals ?? 0}
                      suffix={s.suffix ?? ""}
                    />
                  </div>
                  <div className="stat-l">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {onSale.length > 0 && show("ofertas") ? (
        <section
          data-home-section="ofertas"
          style={previewHidden("ofertas")}
          className="store-section pt-0"
        >
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
                  <div
                    className="eyebrow flex items-center gap-1.5"
                    style={{ color: "var(--danger)" }}
                  >
                    <Icon name="zap" size={14} /> Ofertas por tiempo limitado
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

      {show("materiales") ? (
        <section
          data-home-section="materiales"
          style={previewHidden("materiales")}
          className="store-section pt-0"
        >
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
      ) : null}

      {show("masVendidos") ? (
        <div
          data-home-section="masVendidos"
          style={previewHidden("masVendidos")}
        >
          <ProductSection
            eyebrow="Favoritos del público"
            title="Más vendidos"
            products={featured}
          />
        </div>
      ) : null}

      {show("comoFunciona") ? (
        <section
          data-home-section="comoFunciona"
          style={previewHidden("comoFunciona")}
          className="store-section pt-0"
        >
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
      ) : null}

      {/* Reseñas ocultas (2026-07): reactivar → show("testimonios") */}
      {false ? (
        <section
          data-home-section="testimonios"
          style={previewHidden("testimonios")}
          className="store-section pt-0"
        >
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
      ) : null}

      {show("faq") ? (
        <section
          data-home-section="faq"
          style={previewHidden("faq")}
          id="faq"
          className="store-section pt-0"
        >
          <div className="store-wrap">
            <div className="faq-grid">
              <div className="faq-intro">
                <div className="eyebrow">¿Dudas?</div>
                <h2 className="sec-title mt-2 mb-3">Preguntas frecuentes</h2>
                <p className="text-dim mb-5 text-sm leading-relaxed">
                  Todo lo que necesitás saber antes de tu pedido. ¿Algo más?
                  Escribinos por WhatsApp.
                </p>
                <a
                  href="https://wa.me/541155128834"
                  target="_blank"
                  rel="noreferrer noopener"
                  className={buttonVariants({ variant: "secondary" })}
                >
                  <Icon name="whatsapp" size={17} /> Hablar con nosotros
                </a>
              </div>
              <div className="faq-list">
                {faqList.map((f) => (
                  <details key={f.q} className="faq-item">
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {show("pedidoMedida") ? (
        <section
          data-home-section="pedidoMedida"
          style={previewHidden("pedidoMedida")}
          className="store-section pt-0"
        >
          <div className="store-wrap">
            <div
              className="ui-card cust-cta overflow-hidden"
              style={{ borderColor: "rgba(var(--gold-rgb),.25)" }}
            >
              <div className="cust-grid">
                <div style={{ padding: "42px 44px" }}>
                  <div className="eyebrow">¿No encontrás lo que buscás?</div>
                  <h2 className="sec-title mt-2 mb-3">
                    Pedí tu pieza personalizada
                  </h2>
                  <p className="text-dim mb-5 max-w-[420px] text-[15px] leading-relaxed">
                    Contanos qué necesitás y mandanos una foto de referencia. Lo
                    diseñamos e imprimimos para vos. Te contactamos con un
                    presupuesto sin compromiso.
                  </p>
                  <div className="mb-6 flex flex-col gap-3">
                    {(
                      [
                        ["palette", "Diseño personalizado según tu idea"],
                        ["printer", "Cualquier color y material"],
                        ["heart", "Te escribimos para coordinar"],
                      ] as Array<[string, string]>
                    ).map(([ic, t]) => (
                      <div
                        key={t}
                        className="text-dim flex items-center gap-3 text-sm"
                      >
                        <span style={{ color: "var(--gold-bright)" }}>
                          <Icon name={ic} size={18} />
                        </span>
                        {t}
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/a-medida"
                    className={cn(buttonVariants({ size: "lg" }))}
                  >
                    <Icon name="sparkles" size={17} /> Pedí la tuya
                  </Link>
                </div>
                <div className="cust-art">
                  <div
                    className="scene"
                    style={{ height: "300px", width: "100%" }}
                  >
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
                        <Icon name="box" size={54} />
                      </div>
                      <div className="face f-bottom">
                        <Icon name="layers" size={54} />
                      </div>
                    </div>
                    <div className="layer-lines"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {isPreview ? <PreviewBridge /> : null}
    </div>
  );
}
