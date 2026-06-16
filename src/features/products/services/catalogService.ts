import {
  countImages,
  deleteImageRow,
  findBySlug,
  findCategories,
  findFeatured,
  findImageById,
  findMaterials,
  findProductById,
  findPublished,
  findPublishedSlugs,
  findRelated,
  insertImage,
  insertProduct,
  listImagesByProduct,
  setPrimaryImage,
  setProductStatus,
  updateProductRow,
} from "../repository";
import { randomUUID } from "node:crypto";
import { deleteObject, optimizeImage, uploadObject } from "@/core/storage";
import {
  productFilterSchema,
  type ProductFilter,
  type ProductInput,
} from "../schemas";
import type {
  CatalogPage,
  Category,
  HomeData,
  Product,
  ProductDetailView,
  ProductImage,
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

// --- Escrituras (admin, Cap. 11) ---

function toRow(input: ProductInput) {
  return {
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    categoryId: input.categoryId ?? null,
    price: input.price.toString(),
    salePrice: input.salePrice != null ? input.salePrice.toString() : null,
    material: input.material ?? null,
    printTimeMinutes: input.printTimeMinutes ?? null,
    weightGrams: input.weightGrams ?? null,
    dimensions: input.dimensions ?? null,
    isFeatured: input.isFeatured,
    isNew: input.isNew,
  };
}

/** Crea un producto (nace como borrador). */
export async function createProduct(input: ProductInput): Promise<Product> {
  return insertProduct({ ...toRow(input), status: "draft" });
}

/** Actualiza un producto existente. */
export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<Product> {
  const row = await updateProductRow(id, toRow(input));
  if (!row) throw new Error("Producto no encontrado");
  return row;
}

/** Publica un producto. Regla: no se puede publicar sin imágenes (Cap. 11). */
export async function publishProduct(id: string): Promise<Product> {
  const product = await findProductById(id);
  if (!product) throw new Error("Producto no encontrado");
  const images = await countImages(id);
  if (images === 0) {
    throw new Error("No se puede publicar un producto sin imágenes");
  }
  const row = await setProductStatus(id, "published");
  if (!row) throw new Error("Producto no encontrado");
  return row;
}

/** Archiva un producto (borrado lógico). */
export async function archiveProduct(id: string): Promise<Product> {
  const row = await setProductStatus(id, "archived");
  if (!row) throw new Error("Producto no encontrado");
  return row;
}

// --- Imágenes de producto (admin) ---

const IMAGES_BUCKET = "products";

function storagePathFromUrl(url: string): string | null {
  const marker = `/object/public/${IMAGES_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

/** Procesa (webp + resize), sube a Storage y registra la imagen. */
export async function addProductImage(
  productId: string,
  bytes: Buffer,
): Promise<ProductImage> {
  const webp = await optimizeImage(bytes);
  const path = `${productId}/${randomUUID()}.webp`;
  const url = await uploadObject(IMAGES_BUCKET, path, webp, "image/webp");
  const count = await countImages(productId);
  return insertImage({
    productId,
    url,
    alt: null,
    sortOrder: count,
    isPrimary: count === 0,
  });
}

/** Borra una imagen (Storage + base) y devuelve el productId. */
export async function removeProductImage(imageId: string): Promise<string> {
  const image = await findImageById(imageId);
  if (!image) throw new Error("Imagen no encontrada");
  const path = storagePathFromUrl(image.url);
  if (path) await deleteObject(IMAGES_BUCKET, path);
  await deleteImageRow(imageId);
  const rest = await listImagesByProduct(image.productId);
  const first = rest[0];
  if (first && !rest.some((i) => i.isPrimary)) {
    await setPrimaryImage(image.productId, first.id);
  }
  return image.productId;
}

export async function makeImagePrimary(
  productId: string,
  imageId: string,
): Promise<void> {
  await setPrimaryImage(productId, imageId);
}

export async function listProductImages(
  productId: string,
): Promise<ProductImage[]> {
  return listImagesByProduct(productId);
}
