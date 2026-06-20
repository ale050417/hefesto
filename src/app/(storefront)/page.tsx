import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ProductGrid } from "@/features/products/components/product-grid";
import { getHomeData } from "@/features/products/services/catalogService";
import { getBrandSettings } from "@/features/settings/service";
import type { ProductView } from "@/features/products/types";

// SSR en cada request; el caché/ISR se afina en la Fase 10.
export const dynamic = "force-dynamic";

function Section({
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
      <div className="sec-head">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="sec-title">{title}</h2>
        </div>
        {href ? (
          <Link href={href} className={buttonVariants({ variant: "ghost" })}>
            Ver todos →
          </Link>
        ) : null}
      </div>
      <ProductGrid products={products} />
    </section>
  );
}

const steps = [
  { t: "Elegís", d: "Explorá el catálogo y elegí tu producto y color." },
  { t: "Imprimimos", d: "Lo imprimimos a pedido, especialmente para vos." },
  { t: "Te llega", d: "Coordinamos el envío y registramos el seguimiento." },
];

export default async function Home() {
  const [{ featured, latest, onSale, categories }, brand] = await Promise.all([
    getHomeData(),
    getBrandSettings(),
  ]);

  return (
    <div>
      {/* HERO */}
      <section className="hero">
        <div className="store-wrap grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <span className="hero-tag">✦ Impresión 3D a pedido</span>
            <h1 className="hero-title">
              Diseños <span className="gold">imposibles</span>,
              <br />
              impresos en 3D
            </h1>
            <p className="hero-sub">
              Objetos únicos hechos a pedido, en el color que elijas. Elegí,
              imprimimos y te llega a casa.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/catalogo"
                className={buttonVariants({ variant: "primary", size: "lg" })}
              >
                Ver catálogo
              </Link>
              <Link
                href="/catalogo?sale=true"
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                Ofertas
              </Link>
            </div>
            <div className="hero-stats">
              <div className="hero-stat">
                <div className="n">100%</div>
                <div className="l">Hecho a pedido</div>
              </div>
              <div className="hero-stat">
                <div className="n">24–48h</div>
                <div className="l">Producción</div>
              </div>
              <div className="hero-stat">
                <div className="n">+50</div>
                <div className="l">Colores</div>
              </div>
            </div>
          </div>

          {/* Panel decorativo (placeholder del render 3D del demo) */}
          <div className="relative hidden lg:block">
            <div
              className="ui-card relative aspect-square w-full overflow-hidden"
              style={{
                background:
                  "radial-gradient(120% 120% at 30% 20%, rgba(var(--gold-rgb),.18), transparent 55%), linear-gradient(135deg, var(--surface-2), var(--surface-1))",
                borderColor: "rgba(var(--gold-rgb),.22)",
              }}
            >
              {brand.heroImageUrl ? (
                <Image
                  src={brand.heroImageUrl}
                  alt="Hefesto 3D"
                  fill
                  sizes="(max-width: 1024px) 0px, 600px"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span
                    className="font-display text-7xl font-black"
                    style={{
                      background:
                        "linear-gradient(120deg, var(--gold-bright), var(--gold-deep))",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    3D
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORÍAS */}
      {categories.length > 0 ? (
        <section className="store-section pt-0">
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
                Ver todo →
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
                  <span className="cat-chip-ic">◆</span>
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

      <div className="store-wrap">
        <Section
          eyebrow="Recién salidos"
          title="Nuevos lanzamientos"
          products={latest}
          href="/catalogo"
        />
        <Section
          eyebrow="Por tiempo limitado"
          title="En oferta esta semana"
          products={onSale}
          href="/catalogo?sale=true"
        />
        <Section
          eyebrow="Favoritos del público"
          title="Más vendidos"
          products={featured}
          href="/catalogo"
        />
      </div>

      {/* CÓMO FUNCIONA */}
      <section className="store-section">
        <div className="store-wrap">
          <div className="sec-head flex-col items-center text-center">
            <div>
              <div className="eyebrow">Simple y rápido</div>
              <h2 className="sec-title">¿Cómo funciona?</h2>
            </div>
          </div>
          <div className="grid-3">
            {steps.map((s, i) => (
              <div key={s.t} className="step">
                <div className="step-n">{i + 1}</div>
                <h4>{s.t}</h4>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
