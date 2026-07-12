import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/core/db";
import { categories, productImages, products } from "@/core/db/schema";
import type { ProductFilter } from "./schemas";
import type {
  Category,
  CategoryWithCount,
  NewCategory,
  NewProduct,
  NewProductImage,
  Product,
  ProductImage,
  ProductStatus,
  ProductWithRelations,
} from "./types";

// Inyección ligera (Cap. 6): por defecto usa la conexión real; en tests se
// puede pasar otra base. El repository es la ÚNICA puerta a la base (Cap. 5).
type Database = typeof db;

/** Categorías ordenadas para los filtros y la navegación. */
export async function findCategories(
  database: Database = db,
): Promise<Category[]> {
  // Resiliente: se lee en el footer (shell del layout) y corre al prerenderizar
  // páginas estáticas en el build. Si la base no responde, se devuelve [] en vez
  // de romper el build/app (mismo criterio que getSettings).
  try {
    return await database.query.categories.findMany({
      orderBy: (c, { asc }) => [asc(c.sortOrder), asc(c.name)],
    });
  } catch (error) {
    console.error("[catalog] no se pudieron leer las categorías:", error);
    return [];
  }
}

/** Productos publicados, con filtros, orden y paginación. */
export async function findPublished(
  filter: ProductFilter,
  database: Database = db,
): Promise<{ items: ProductWithRelations[]; total: number }> {
  const conditions: SQL[] = [eq(products.status, "published")];
  if (filter.q) conditions.push(ilike(products.name, `%${filter.q}%`));

  if (filter.category) {
    // Filtrar por una categoría incluye sus subcategorías (Fase 6): ids cuya
    // slug coincide O cuyo padre tiene esa slug.
    conditions.push(
      inArray(
        products.categoryId,
        database
          .select({ id: categories.id })
          .from(categories)
          .where(
            or(
              eq(categories.slug, filter.category),
              inArray(
                categories.parentId,
                database
                  .select({ id: categories.id })
                  .from(categories)
                  .where(eq(categories.slug, filter.category)),
              ),
            ),
          ),
      ),
    );
  }
  if (filter.material) conditions.push(eq(products.material, filter.material));
  if (filter.minPrice !== undefined) {
    conditions.push(sql`${products.price} >= ${filter.minPrice}`);
  }
  if (filter.maxPrice !== undefined) {
    conditions.push(sql`${products.price} <= ${filter.maxPrice}`);
  }
  if (filter.isNew) conditions.push(eq(products.isNew, true));
  if (filter.onSale) conditions.push(sql`${products.salePrice} IS NOT NULL`);

  const where = and(...conditions);

  const orderBy = {
    newest: [desc(products.createdAt)],
    price_asc: [asc(products.price)],
    price_desc: [desc(products.price)],
    name: [asc(products.name)],
  }[filter.sort];

  const offset = (filter.page - 1) * filter.pageSize;

  const [items, totalRows] = await Promise.all([
    database.query.products.findMany({
      where,
      with: {
        category: true,
        images: { orderBy: (img, { asc }) => [asc(img.sortOrder)] },
        variants: true,
      },
      orderBy,
      limit: filter.pageSize,
      offset,
    }),
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(where),
  ]);

  return { items, total: totalRows[0]?.count ?? 0 };
}

/** Un producto publicado por slug, con sus relaciones (o null). */
export async function findBySlug(
  slug: string,
  database: Database = db,
): Promise<ProductWithRelations | null> {
  const product = await database.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.status, "published")),
    with: {
      category: true,
      images: { orderBy: (img, { asc }) => [asc(img.sortOrder)] },
      variants: true,
    },
  });
  return product ?? null;
}

/** Productos relacionados (misma categoría, publicados, excluyendo el actual). */
export async function findRelated(
  params: { productId: string; categoryId: string | null; limit?: number },
  database: Database = db,
): Promise<ProductWithRelations[]> {
  if (!params.categoryId) return [];
  return database.query.products.findMany({
    where: and(
      eq(products.status, "published"),
      eq(products.categoryId, params.categoryId),
      ne(products.id, params.productId),
    ),
    with: {
      category: true,
      images: { orderBy: (img, { asc }) => [asc(img.sortOrder)] },
      variants: true,
    },
    limit: params.limit ?? 4,
  });
}

/** Productos destacados publicados (para la Home). */
export async function findFeatured(
  limit = 8,
  database: Database = db,
): Promise<ProductWithRelations[]> {
  return database.query.products.findMany({
    where: and(eq(products.status, "published"), eq(products.isFeatured, true)),
    with: {
      category: true,
      images: { orderBy: (img, { asc }) => [asc(img.sortOrder)] },
      variants: true,
    },
    orderBy: [desc(products.createdAt)],
    limit,
  });
}

/** Materiales distintos de productos publicados (para el filtro). */
export async function findMaterials(
  database: Database = db,
): Promise<string[]> {
  const rows = await database
    .selectDistinct({ material: products.material })
    .from(products)
    .where(and(eq(products.status, "published"), isNotNull(products.material)));
  return rows
    .map((r) => r.material)
    .filter((m): m is string => m !== null)
    .sort((a, b) => a.localeCompare(b));
}

/** Slugs de productos publicados (para el sitemap). */
export async function findPublishedSlugs(
  database: Database = db,
): Promise<{ slug: string; updatedAt: Date }[]> {
  return database
    .select({ slug: products.slug, updatedAt: products.updatedAt })
    .from(products)
    .where(eq(products.status, "published"));
}

/** Inserta un producto y lo devuelve. */
export async function insertProduct(
  values: NewProduct,
  database: Database = db,
): Promise<Product> {
  const [row] = await database.insert(products).values(values).returning();
  if (!row) throw new Error("No se pudo crear el producto");
  return row;
}

/** Actualiza un producto por id (o null si no existe). */
export async function updateProductRow(
  id: string,
  values: Partial<NewProduct>,
  database: Database = db,
): Promise<Product | null> {
  const [row] = await database
    .update(products)
    .set(values)
    .where(eq(products.id, id))
    .returning();
  return row ?? null;
}

/** Cambia el estado de un producto (draft/published/archived). */
export async function setProductStatus(
  id: string,
  status: ProductStatus,
  database: Database = db,
): Promise<Product | null> {
  const [row] = await database
    .update(products)
    .set({ status })
    .where(eq(products.id, id))
    .returning();
  return row ?? null;
}

/** Busca un producto por id sin filtrar por estado (admin). */
export async function findProductById(
  id: string,
  database: Database = db,
): Promise<Product | null> {
  const row = await database.query.products.findFirst({
    where: eq(products.id, id),
  });
  return row ?? null;
}

/** Cuenta las imágenes de un producto (para la regla de publicación). */
export async function countImages(
  productId: string,
  database: Database = db,
): Promise<number> {
  const rows = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(productImages)
    .where(eq(productImages.productId, productId));
  return rows[0]?.count ?? 0;
}

// --- Imágenes de producto ---

export async function insertImage(
  values: NewProductImage,
  database: Database = db,
): Promise<ProductImage> {
  const [row] = await database.insert(productImages).values(values).returning();
  if (!row) throw new Error("No se pudo guardar la imagen");
  return row;
}

export async function listImagesByProduct(
  productId: string,
  database: Database = db,
): Promise<ProductImage[]> {
  return database
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.sortOrder));
}

export async function findImageById(
  id: string,
  database: Database = db,
): Promise<ProductImage | null> {
  const [row] = await database
    .select()
    .from(productImages)
    .where(eq(productImages.id, id))
    .limit(1);
  return row ?? null;
}

export async function deleteImageRow(
  id: string,
  database: Database = db,
): Promise<void> {
  await database.delete(productImages).where(eq(productImages.id, id));
}

/** Marca una imagen como principal (y las demás del producto como no principal). */
export async function setPrimaryImage(
  productId: string,
  imageId: string,
  database: Database = db,
): Promise<void> {
  await database
    .update(productImages)
    .set({ isPrimary: false })
    .where(eq(productImages.productId, productId));
  await database
    .update(productImages)
    .set({ isPrimary: true })
    .where(eq(productImages.id, imageId));
}

/** Todos los productos (cualquier estado) para el admin, con búsqueda y filtro. */
export async function findAllForAdmin(
  opts: {
    search?: string;
    status?: ProductStatus;
    page: number;
    pageSize: number;
  },
  database: Database = db,
): Promise<{ items: ProductWithRelations[]; total: number }> {
  const conditions: SQL[] = [];
  if (opts.search) conditions.push(ilike(products.name, `%${opts.search}%`));
  if (opts.status) conditions.push(eq(products.status, opts.status));
  const where = conditions.length ? and(...conditions) : undefined;
  const offset = (opts.page - 1) * opts.pageSize;

  const [items, totalRows] = await Promise.all([
    database.query.products.findMany({
      where,
      with: {
        category: true,
        images: { orderBy: (img, { asc }) => [asc(img.sortOrder)] },
        variants: true,
      },
      orderBy: [desc(products.updatedAt)],
      limit: opts.pageSize,
      offset,
    }),
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(where),
  ]);

  return { items, total: totalRows[0]?.count ?? 0 };
}

// --- Categorías (admin) ---

export async function insertCategory(
  values: NewCategory,
  database: Database = db,
): Promise<Category> {
  const [row] = await database.insert(categories).values(values).returning();
  if (!row) throw new Error("No se pudo crear la categoría");
  return row;
}

export async function updateCategoryRow(
  id: string,
  values: Partial<NewCategory>,
  database: Database = db,
): Promise<Category | null> {
  const [row] = await database
    .update(categories)
    .set(values)
    .where(eq(categories.id, id))
    .returning();
  return row ?? null;
}

export async function deleteCategoryRow(
  id: string,
  database: Database = db,
): Promise<void> {
  await database.delete(categories).where(eq(categories.id, id));
}

export async function findCategoryById(
  id: string,
  database: Database = db,
): Promise<Category | null> {
  const [row] = await database
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  return row ?? null;
}

export async function countProductsInCategory(
  categoryId: string,
  database: Database = db,
): Promise<number> {
  const rows = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.categoryId, categoryId));
  return rows[0]?.count ?? 0;
}

export async function listCategoriesWithCount(
  database: Database = db,
): Promise<CategoryWithCount[]> {
  return database
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      icon: categories.icon,
      color: categories.color,
      sortOrder: categories.sortOrder,
      createdAt: categories.createdAt,
      parentId: categories.parentId,
      productCount: sql<number>`count(${products.id})::int`,
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

/** Productos publicados por lista de ids (para favoritos). */
export async function findByIds(
  ids: string[],
  database: Database = db,
): Promise<ProductWithRelations[]> {
  if (ids.length === 0) return [];
  return database.query.products.findMany({
    where: and(eq(products.status, "published"), inArray(products.id, ids)),
    with: {
      category: true,
      images: { orderBy: (img, { asc }) => [asc(img.sortOrder)] },
      variants: true,
    },
  });
}

/** Cantidad de subcategorías de una categoría (regla de borrado, Fase 6). */
export async function countChildCategories(
  parentId: string,
  database: Database = db,
): Promise<number> {
  const [row] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(categories)
    .where(eq(categories.parentId, parentId));
  return row?.count ?? 0;
}

// Productos PUBLICADOS con lo necesario para cargar una venta manual desde la
// tienda (detalle, material, gramos, minutos de impresión y precio).
export async function findProductsForSale() {
  return db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      material: products.material,
      weightGrams: products.weightGrams,
      printTimeMinutes: products.printTimeMinutes,
      colors: products.colors,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(ne(products.status, "archived"))
    .orderBy(asc(products.name));
}
