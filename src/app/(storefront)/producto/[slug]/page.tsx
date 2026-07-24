import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductShowcase } from "@/features/products/components/product-showcase";
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

      {/* Vitrina: galería + info conectadas (al elegir un color, la galería
          salta a la foto de ese color). */}
      <ProductShowcase
        images={product.images}
        product={{
          id: product.id,
          slug: product.slug,
          name: product.name,
          categoryName: product.category?.name ?? null,
          description: product.description,
          price: product.price,
          salePrice: product.salePrice,
          isOnSale: product.isOnSale,
          discountPercent: product.discountPercent,
          isNew: product.isNew,
          image: product.primaryImage?.url ?? null,
          variants: product.variants,
          colorMode: product.colorMode,
          colors: product.colors,
          colorPrices: product.colorPrices,
          specs,
        }}
      />

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
