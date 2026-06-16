import {
  findBySlug,
  findCategories,
  findFeatured,
  findMaterials,
  findPublished,
  findPublishedSlugs,
  findRelated,
} from "../repository";
import { productFilterSchema, type ProductFilter } from "../schemas";
import type {
  CatalogPage,
  Category,
  HomeData,
  ProductDetailView,
  ProductView,
  ProductWithRelations,
} from "../types";

/**
 * Convierte un producto de la base en un DTO de vista con todo calculado
 * (precio efectivo, % de descuento, imagen principal, "desde"). Pura y testeable.
 */
export function toProductView(p: ProductWithRelations): ProductView {
  const price = Number(p.price);
  const sale = p.salePrice !== null ? Number(p.salePrice) : null;
  const isOnSale = sale !== null && sale < price;
  const effectivePrice = isOnSale ? sale : price;
  const discountPercent = isOnSale
    ? Math.round((1 - sale / price) * 100)
    : null;
  const primary = p.images.find((i) => i.isPrimary) ?? p.images[0] ?? null;

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price,
    salePrice: sale,
    effectivePrice,
    isOnSale,
    discountPercent,
    hasVariants: p.variants.length > 0,
    isNew: p.isNew,
    isFeatured: p.isFeatured,
    material: p.material,
    category: p.category
      ? { name: p.category.name, slug: p.category.slug }
      : null,
    primaryImage: primary
      ? { url: primary.url, alt: primary.alt ?? p.name }
      : null,
  };
}

/** Catálogo público: productos publicados con filtros, orden y paginación. */
export async function listProducts(
  filter: ProductFilter,
): Promise<CatalogPage> {
  const { items, total } = await findPublished(filter);
  return {
    items: items.map(toProductView),
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filter.pageSize)),
  };
}

/** Detalle de un producto publicado (o null para 404). */
export async function getProductBySlug(
  slug: string,
): Promise<ProductDetailView | null> {
  const p = await findBySlug(slug);
  if (!p) return null;
  return {
    ...toProductView(p),
    description: p.description,
    printTimeMinutes: p.printTimeMinutes,
    weightGrams: p.weightGrams,
    dimensions: p.dimensions,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt ?? p.name })),
    variants: p.variants.map((v) => ({
      id: v.id,
      label: v.label,
      price: v.priceOverride !== null ? Number(v.priceOverride) : null,
    })),
  };
}

/** Categorías para filtros y navegación. */
export async function listCategories(): Promise<Category[]> {
  return findCategories();
}

/** Productos relacionados (misma categoría) a partir del slug. */
export async function getRelatedProducts(
  slug: string,
  limit = 4,
): Promise<ProductView[]> {
  const product = await findBySlug(slug);
  if (!product) return [];
  const related = await findRelated({
    productId: product.id,
    categoryId: product.categoryId,
    limit,
  });
  return related.map(toProductView);
}

/** Datos para la Home: destacados, nuevos, ofertas y categorías. */
export async function getHomeData(): Promise<HomeData> {
  const section = (extra: Record<string, unknown>) =>
    productFilterSchema.parse({ pageSize: 8, ...extra });

  const [featured, latest, onSale, categories] = await Promise.all([
    findFeatured(8),
    findPublished(section({ isNew: "true" })),
    findPublished(section({ onSale: "true" })),
    findCategories(),
  ]);

  return {
    featured: featured.map(toProductView),
    latest: latest.items.map(toProductView),
    onSale: onSale.items.map(toProductView),
    categories,
  };
}

/** Materiales disponibles para el filtro del catálogo. */
export async function listMaterials(): Promise<string[]> {
  return findMaterials();
}

/** Slugs publicados (para el sitemap). */
export async function listPublishedSlugs(): Promise<
  { slug: string; updatedAt: Date }[]
> {
  return findPublishedSlugs();
}
