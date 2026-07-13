import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PriceTag } from "@/components/shared/price-tag";
import { Badge } from "@/components/ui/badge";
import { AddToCart } from "@/features/cart/components/add-to-cart";
import { ProductGallery } from "@/features/products/components/product-gallery";
import { ProductGrid } from "@/features/products/components/product-grid";
import {
  getProductBySlug,
  getRelatedProducts,
} from "@/features/products/services/catalogService";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Producto no encontrado" };
  const description =
    product.description ?? `${product.name}, impreso en 3D a pedido.`;
  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      images: product.primaryImage ? [product.primaryImage.url] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  // Antes: 4 awaits secuenciales (waterfall). Ahora 2 tandas paralelas; el
  // producto además se dedupea con generateMetadata (React cache en el service).
  // Reseñas ocultas (2026-07): ya no se necesita el user acá (era para "puede
  // reseñar"). Reactivar reseñas → volver a traer el usuario en paralelo.
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  // Reseñas ocultas (2026-07): no se traen ni se muestran. Reactivar: volver a
  // pedir getProductReviewsFor y renderizar <ProductReviews/> más abajo.
  const related = await getRelatedProducts(slug);

  // Solo lo que le interesa al cliente. Nada técnico (gramos, tiempo de
  // impresión, material, altura de capa): eso es interno del taller.
  const specs: { label: string; value: string }[] = [];
  if (product.dimensions) {
    specs.push({ label: "Tamaño", value: product.dimensions });
  }

  const effectivePrice =
    product.isOnSale && product.salePrice ? product.salePrice : product.price;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description:
      product.description ?? `${product.name}, impreso en 3D a pedido.`,
    ...(product.primaryImage ? { image: product.primaryImage.url } : {}),
    ...(product.category ? { category: product.category.name } : {}),
    offers: {
      "@type": "Offer",
      price: String(effectivePrice),
      priceCurrency: "ARS",
      availability: "https://schema.org/InStock",
      url: `${siteUrl}/producto/${product.slug}`,
    },
  };

  return (
    <div className="store-wrap py-10">
      {/* JSON.stringify no escapa "</script>": si un texto del producto lo
          contuviera, cortaría el tag e inyectaría HTML. Escapar "<" lo hace
          inofensivo y el JSON-LD sigue siendo válido (Cap. 14). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c"),
        }}
      />
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

          <div className="mt-6">
            <AddToCart
              product={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                price: product.price,
                salePrice: product.salePrice,
                isOnSale: product.isOnSale,
                image: product.primaryImage?.url ?? null,
                variants: product.variants,
                colorMode: product.colorMode,
                colors: product.colors,
                colorPrices: product.colorPrices,
              }}
            />
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
