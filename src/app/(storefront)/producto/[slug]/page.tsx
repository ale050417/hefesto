import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PriceTag } from "@/components/shared/price-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductGallery } from "@/features/products/components/product-gallery";
import { ProductGrid } from "@/features/products/components/product-grid";
import {
  getProductBySlug,
  getRelatedProducts,
} from "@/features/products/services/catalogService";
import { formatMinutes, formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Producto no encontrado · Hefesto 3D" };
  return {
    title: `${product.name} · Hefesto 3D`,
    description:
      product.description ?? `${product.name}, impreso en 3D a pedido.`,
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(slug);

  const specs: { label: string; value: string }[] = [];
  if (product.material)
    specs.push({ label: "Material", value: product.material });
  if (product.printTimeMinutes) {
    specs.push({
      label: "Tiempo de impresión",
      value: formatMinutes(product.printTimeMinutes),
    });
  }
  if (product.weightGrams) {
    specs.push({ label: "Peso", value: `${product.weightGrams} g` });
  }
  if (product.dimensions) {
    specs.push({ label: "Dimensiones", value: product.dimensions });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="text-dim text-sm">
        <Link href="/" className="hover:text-fg">
          Inicio
        </Link>{" "}
        /{" "}
        <Link href="/catalogo" className="hover:text-fg">
          Catálogo
        </Link>{" "}
        / <span className="text-fg">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <ProductGallery images={product.images} />

        <div>
          {product.category ? (
            <p className="text-faint text-sm">{product.category.name}</p>
          ) : null}
          <h1 className="font-display text-fg mt-1 text-3xl">{product.name}</h1>

          {product.isOnSale || product.isNew ? (
            <div className="mt-3 flex items-center gap-2">
              {product.isOnSale && product.discountPercent ? (
                <Badge variant="danger">-{product.discountPercent}%</Badge>
              ) : null}
              {product.isNew ? <Badge variant="info">Nuevo</Badge> : null}
            </div>
          ) : null}

          <PriceTag
            className="mt-4"
            price={product.price}
            salePrice={product.salePrice}
            isOnSale={product.isOnSale}
            from={product.hasVariants}
          />

          {product.description ? (
            <p className="text-dim mt-4">{product.description}</p>
          ) : null}

          {product.variants.length > 0 ? (
            <div className="mt-6">
              <p className="text-fg mb-2 text-sm font-medium">Tamaños</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <span
                    key={v.id}
                    className="border-surface-3 bg-surface-2 text-fg rounded-md border px-3 py-2 text-sm"
                  >
                    {v.label}
                    {v.price != null ? ` · ${formatPrice(v.price)}` : ""}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <Button disabled title="Disponible próximamente">
              Agregar al carrito
            </Button>
            <p className="text-faint mt-2 text-xs">
              La compra online estará disponible próximamente.
            </p>
          </div>

          {specs.length > 0 ? (
            <dl className="border-surface-2 mt-8 border-t text-sm">
              {specs.map((s) => (
                <div
                  key={s.label}
                  className="border-surface-2 flex justify-between border-b py-2"
                >
                  <dt className="text-dim">{s.label}</dt>
                  <dd className="text-fg">{s.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <p className="border-surface-2 bg-surface-1 text-dim mt-6 rounded-md border p-3 text-xs">
            El costo de envío corre por cuenta del cliente. Coordinamos el envío
            y registramos el código de seguimiento.
          </p>
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-16">
          <h2 className="font-display text-fg mb-5 text-2xl">
            También te puede gustar
          </h2>
          <ProductGrid products={related} />
        </section>
      ) : null}
    </div>
  );
}
