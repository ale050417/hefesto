import {
  findBySlug,
  findCategories,
  findPublished,
  findRelated,
} from "../repository";
import type { ProductFilter } from "../schemas";
import type {
  CatalogPage,
  Category,
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
