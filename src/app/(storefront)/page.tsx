import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ProductGrid } from "@/features/products/components/product-grid";
import { getHomeData } from "@/features/products/services/catalogService";
import type { ProductView } from "@/features/products/types";

// Trae datos de la base en cada request (SSR). El caché estático/ISR se afina
// en la Fase 10.
export const dynamic = "force-dynamic";

function Section({
  title,
  products,
}: {
  title: string;
  products: ProductView[];
}) {
  if (products.length === 0) return null;
  return (
    <section className="mt-14">
      <h2 className="font-display text-fg mb-5 text-2xl">{title}</h2>
      <ProductGrid products={products} />
    </section>
  );
}

const steps = [
  {
    n: "1",
    t: "Elegís",
    d: "Explorá el catálogo y elegí tu producto y color.",
  },
  {
    n: "2",
    t: "Imprimimos",
    d: "Lo imprimimos a pedido, especialmente para vos.",
  },
  {
    n: "3",
    t: "Te llega",
    d: "Coordinamos el envío y registramos el seguimiento.",
  },
];

export default async function Home() {
  const { featured, latest, onSale, categories } = await getHomeData();

  return (
    <div>
      <section className="border-surface-2 bg-surface-1 border-b">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <p className="eyebrow">Impresión 3D a pedido</p>
          <h1 className="font-display text-fg mt-4 text-3xl font-bold sm:text-[2.75rem]">
            Objetos únicos,{" "}
            <span className="text-primary">impresos para vos</span>
          </h1>
          <p className="text-dim mx-auto mt-4 max-w-xl">
            Diseños en 3D hechos a pedido, en el color que elijas. Elegí,
            imprimimos y te llega.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              href="/catalogo"
              className={buttonVariants({ variant: "primary", size: "lg" })}
            >
              Ver catálogo
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-20">
        {categories.length > 0 ? (
          <section className="mt-12">
            <h2 className="font-display text-fg mb-5 text-2xl">Categorías</h2>
            <div className="flex flex-wrap gap-3">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/catalogo?category=${category.slug}`}
                  className="border-surface-3 bg-surface-1 text-fg hover:border-primary hover:text-primary rounded-md border px-4 py-2 text-sm transition-colors"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <Section title="Destacados" products={featured} />
        <Section title="Novedades" products={latest} />
        <Section title="Ofertas" products={onSale} />

        <section className="mt-16">
          <h2 className="font-display text-fg mb-5 text-2xl">
            ¿Cómo funciona?
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.n}
                className="border-surface-2 bg-surface-1 rounded-lg border p-5"
              >
                <span className="font-display text-primary text-2xl">
                  {step.n}
                </span>
                <h3 className="text-fg mt-2 font-medium">{step.t}</h3>
                <p className="text-dim mt-1 text-sm">{step.d}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
