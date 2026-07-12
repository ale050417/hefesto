import {
  countImages,
  countProductsInCategory,
  countChildCategories,
  deleteCategoryRow,
  deleteImageRow,
  findAllForAdmin,
  findBySlug,
  findCategories,
  findCategoryById,
  findFeatured,
  findImageById,
  findMaterials,
  findProductById,
  findPublished,
  findProductsForSale,
  findPublishedSlugs,
  findRelated,
  insertCategory,
  insertImage,
  insertProduct,
  listCategoriesWithCount,
  listImagesByProduct,
  setPrimaryImage,
  setProductStatus,
  updateCategoryRow,
  productSlugExists,
  updateProductRow,
} from "../repository";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { randomUUID } from "node:crypto";
import { deleteObject, optimizeImage, uploadObject } from "@/core/storage";
import {
  productFilterSchema,
  type CategoryInput,
  type ProductFilter,
  type ProductInput,
} from "../schemas";
import type {
  AdminProductPage,
  AdminProductRow,
  CatalogPage,
  Category,
  CategoryWithCount,
  HomeData,
  Product,
  ProductDetailView,
  ProductImage,
  ProductStatus,
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
export async function quickSearch(
  q: string,
  limit = 6,
): Promise<ProductView[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const { items } = await findPublished({
    q: term,
    sort: "newest",
    page: 1,
    pageSize: limit,
  });
  return items.map(toProductView);
}

const listProductsUncached = async (
  filter: ProductFilter,
): Promise<CatalogPage> => {
  const { items, total } = await findPublished(filter);
  return {
    items: items.map(toProductView),
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filter.pageSize)),
  };
};

// Catálogo cacheado 60 s POR COMBINACIÓN de filtros (la key incluye el filtro
// serializado). Igual que la home: evita pegarle a la base en cada visita.
export async function listProducts(
  filter: ProductFilter,
): Promise<CatalogPage> {
  const cached = unstable_cache(
    () => listProductsUncached(filter),
    ["catalog-list", JSON.stringify(filter)],
    { revalidate: 60 },
  );
  return cached();
}

// Dedupe POR REQUEST (React cache): la página de producto pide el mismo slug
// tres veces (generateMetadata + page + relacionados). Con esto la base se
// consulta UNA vez por request; entre requests no cachea nada (dato fresco).
const findBySlugCached = cache(findBySlug);

/** Detalle de un producto publicado (o null para 404). */
export async function getProductBySlug(
  slug: string,
): Promise<ProductDetailView | null> {
  const p = await findBySlugCached(slug);
  if (!p) return null;
  return {
    ...toProductView(p),
    description: p.description,
    printTimeMinutes: p.printTimeMinutes,
    weightGrams: p.weightGrams,
    dimensions: p.dimensions,
    colorMode: p.colorMode === "multi" ? "multi" : "single",
    colors: p.colors ?? [],
    colorPrices: p.colorPrices ?? {},
    layerHeight: p.layerHeight,
    infillPercent: p.infillPercent,
    productionTime: p.productionTime,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt ?? p.name })),
    variants: p.variants.map((v) => ({
      id: v.id,
      label: v.label,
      price: v.priceOverride !== null ? Number(v.priceOverride) : null,
    })),
  };
}

/** Categorías para filtros y navegación. */
// Categorías cacheadas 60 s: se leen en el footer (TODAS las páginas), la home
// y el catálogo, y casi no cambian. Quita una query por render en toda la app.
export const listCategories = unstable_cache(
  async (): Promise<Category[]> => findCategories(),
  ["categories-public"],
  { revalidate: 60 },
);

/** Productos relacionados (misma categoría) a partir del slug. */
export async function getRelatedProducts(
  slug: string,
  limit = 4,
): Promise<ProductView[]> {
  const product = await findBySlugCached(slug);
  if (!product) return [];
  const related = await findRelated({
    productId: product.id,
    categoryId: product.categoryId,
    limit,
  });
  return related.map(toProductView);
}

/** Datos para la Home: destacados, nuevos, ofertas y categorías. */
// Vidriera cacheada 60 s (estabilización 2026-07): la home es la página más
// visitada y disparaba 4 queries EN CADA visita (force-dynamic), lo que con el
// pool acotado saturaba las conexiones. Se sirve una foto fresca-cada-60s; un
// producto nuevo/editado aparece en ≤60 s (en /admin es instantáneo).
const getHomeDataUncached = async (): Promise<HomeData> => {
  const section = (extra: Record<string, unknown>) =>
    productFilterSchema.parse({ pageSize: 8, ...extra });

  const [featured, latest, onSale, categories] = await Promise.all([
    findFeatured(8),
    findPublished(section({ isNew: "true" })),
    findPublished(section({ onSale: "true" })),
    listCategoriesWithCount(),
  ]);

  return {
    featured: featured.map(toProductView),
    latest: latest.items.map(toProductView),
    onSale: onSale.items.map(toProductView),
    categories,
  };
};

export const getHomeData = unstable_cache(getHomeDataUncached, ["home-data"], {
  revalidate: 60,
});

/** Materiales disponibles para el filtro del catálogo. */
// Materiales cacheados 60 s (facetas del catálogo; casi estáticos).
export const listMaterials = unstable_cache(
  async (): Promise<string[]> => findMaterials(),
  ["materials-public"],
  { revalidate: 60 },
);

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
    colorMode: input.colorMode,
    colors: input.colors,
    colorPrices: input.colorPrices,
    layerHeight: input.layerHeight ?? null,
    infillPercent: input.infillPercent ?? null,
    productionTime: input.productionTime ?? null,
    amortization:
      input.amortization != null ? input.amortization.toString() : null,
    profit: input.profit != null ? input.profit.toString() : null,
    isFeatured: input.isFeatured,
    isNew: input.isNew,
  };
}

/** Crea un producto (nace como borrador). */
/** Slug unico: si el derivado del nombre ya existe, agrega -2, -3, ... */
async function ensureUniqueSlug(base: string): Promise<string> {
  const clean = base || "producto";
  let slug = clean;
  let n = 2;
  while (await productSlugExists(slug)) {
    slug = `${clean}-${n++}`;
  }
  return slug;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const slug = await ensureUniqueSlug(input.slug);
  return insertProduct({
    ...toRow(input),
    slug,
    status: input.status ?? "draft",
  });
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

/**
 * Material + peso de un producto, para el descuento de filamento por ventas
 * (hook de stock en orders). Liviano a propósito: no arrastra imágenes.
 */
export async function getProductPrintSpecs(
  id: string,
): Promise<{ material: string | null; weightGrams: number | null } | null> {
  const product = await findProductById(id);
  if (!product) return null;
  return {
    material: product.material ?? null,
    weightGrams: product.weightGrams ?? null,
  };
}

/** Trae un producto (cualquier estado) + sus imágenes, para el form de edición. */
export async function getProductAdmin(
  id: string,
): Promise<{ product: Product; images: ProductImage[] } | null> {
  const product = await findProductById(id);
  if (!product) return null;
  const images = await listImagesByProduct(id);
  return { product, images };
}

// --- Listado admin ---

function toAdminRow(p: ProductWithRelations): AdminProductRow {
  const primary = p.images.find((i) => i.isPrimary) ?? p.images[0] ?? null;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    status: p.status,
    price: Number(p.price),
    salePrice: p.salePrice != null ? Number(p.salePrice) : null,
    material: p.material ?? null,
    isNew: p.isNew,
    categoryId: p.categoryId ?? null,
    categoryName: p.category?.name ?? null,
    primaryImage: primary?.url ?? null,
  };
}

export async function listProductsAdmin(opts: {
  search?: string;
  status?: ProductStatus;
  page: number;
  pageSize: number;
}): Promise<AdminProductPage> {
  const { items, total } = await findAllForAdmin(opts);
  return {
    items: items.map(toAdminRow),
    total,
    page: opts.page,
    pageSize: opts.pageSize,
    totalPages: Math.max(1, Math.ceil(total / opts.pageSize)),
  };
}

// --- Categorías (admin) ---

export async function listCategoriesAdmin(): Promise<CategoryWithCount[]> {
  return listCategoriesWithCount();
}

export async function getCategoryAdmin(id: string): Promise<Category | null> {
  return findCategoryById(id);
}

/** Regla de subcategorías (1 nivel): el padre debe existir y ser raíz. */
async function assertValidParent(
  parentId: string | null | undefined,
  selfId?: string,
): Promise<void> {
  if (!parentId) return;
  if (selfId && parentId === selfId) {
    throw new Error("Una categoría no puede ser su propio padre.");
  }
  const parent = await findCategoryById(parentId);
  if (!parent) throw new Error("La categoría padre no existe.");
  if (parent.parentId) {
    throw new Error(
      "Solo hay un nivel de subcategorías: elegí una categoría raíz como padre.",
    );
  }
  if (selfId) {
    // Un padre con hijas no puede convertirse en hija (dejaría 2 niveles).
    const children = await countChildCategories(selfId);
    if (children > 0) {
      throw new Error(
        "Esta categoría tiene subcategorías: no puede ser hija de otra.",
      );
    }
  }
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  await assertValidParent(input.parentId);
  return insertCategory({
    name: input.name,
    slug: input.slug,
    icon: input.icon ?? null,
    color: input.color ?? null,
    sortOrder: input.sortOrder,
    parentId: input.parentId ?? null,
  });
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<Category> {
  await assertValidParent(input.parentId, id);
  const row = await updateCategoryRow(id, {
    name: input.name,
    slug: input.slug,
    icon: input.icon ?? null,
    color: input.color ?? null,
    sortOrder: input.sortOrder,
    parentId: input.parentId ?? null,
  });
  if (!row) throw new Error("Categoría no encontrada");
  return row;
}

/** Borra una categoría. Reglas: sin productos y sin subcategorías. */
export async function deleteCategory(id: string): Promise<void> {
  const count = await countProductsInCategory(id);
  if (count > 0) {
    throw new Error(
      `No se puede borrar: la categoría tiene ${count} producto(s). Reasignalos primero.`,
    );
  }
  const children = await countChildCategories(id);
  if (children > 0) {
    throw new Error(
      `No se puede borrar: tiene ${children} subcategoría(s). Borralas o reasignalas primero.`,
    );
  }
  await deleteCategoryRow(id);
}

/** Lista de ProductView por ids (favoritos del cliente). */
export async function listProductsByIds(ids: string[]): Promise<ProductView[]> {
  const { findByIds } = await import("../repository");
  const rows = await findByIds(ids);
  return rows.map(toProductView);
}

export type ProductForSale = {
  id: string;
  name: string;
  price: number;
  material: string | null;
  weightGrams: number | null;
  printMinutes: number | null;
  colors: string[];
  categoryName: string | null;
};

/** Productos publicados para el selector "cargar desde la tienda" de una venta
 * manual: autocompletan detalle, material, gramos, minutos y precio. */
export async function listProductsForSale(): Promise<ProductForSale[]> {
  const rows = await findProductsForSale();
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    material: p.material,
    weightGrams: p.weightGrams,
    printMinutes: p.printTimeMinutes,
    colors: p.colors ?? [],
    categoryName: p.categoryName,
  }));
}
