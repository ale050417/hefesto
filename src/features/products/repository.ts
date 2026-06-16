import { and, asc, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/core/db";
import { categories, products } from "@/core/db/schema";
import type { ProductFilter } from "./schemas";
import type { Category, ProductWithRelations } from "./types";

// Inyección ligera (Cap. 6): por defecto usa la conexión real; en tests se
// puede pasar otra base. El repository es la ÚNICA puerta a la base (Cap. 5).
type Database = typeof db;

/** Categorías ordenadas para los filtros y la navegación. */
export async function findCategories(
  database: Database = db,
): Promise<Category[]> {
  return database.query.categories.findMany({
    orderBy: (c, { asc }) => [asc(c.sortOrder), asc(c.name)],
  });
}

/** Productos publicados, con filtros, orden y paginación. */
export async function findPublished(
  filter: ProductFilter,
  database: Database = db,
): Promise<{ items: ProductWithRelations[]; total: number }> {
  const conditions: SQL[] = [eq(products.status, "published")];

  if (filter.category) {
    conditions.push(
      inArray(
        products.categoryId,
        database
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.slug, filter.category)),
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
