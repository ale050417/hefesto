import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  ne,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/core/db";
import {
  categories,
  manualSales,
  orderItems,
  orders,
  productImages,
  productVariants,
  products,
} from "@/core/db/schema";
import type { OrderStatus } from "@/features/orders/types";
import { newSince } from "./new-product";
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
  // "Solo novedades" = publicado en los últimos 30 días (antes miraba la
  // casilla is_new, que había que tildar a mano y nadie destildaba nunca).
  if (filter.isNew) conditions.push(gte(products.createdAt, newSince()));
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

// Estados donde la venta ya está cobrada (mismo criterio que Reportes/Ganancias:
// features/reports/repository.ts SALES_STATUSES, features/orders/services/
// manualSaleService.ts REVENUE_STATUSES). Copiado acá en vez de importado para
// no crear una dependencia products → orders/reports (products es más de abajo:
// orders ya importa cosas de products para la venta manual).
const SOLD_STATUSES: OrderStatus[] = [
  "confirmed",
  "in_production",
  "ready",
  "shipped",
  "delivered",
];

/**
 * Suma dos o más listas de {productId, qty} en un mapa único por producto.
 * Puro y testeable: separado de la query para poder probarlo sin base.
 */
export function mergeSalesCounts(
  ...lists: Array<Array<{ productId: string | null; qty: number }>>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const list of lists) {
    for (const { productId, qty } of list) {
      if (!productId || qty <= 0) continue;
      map.set(productId, (map.get(productId) ?? 0) + qty);
    }
  }
  return map;
}

/**
 * Cuántas unidades se vendieron de cada producto, sumando pedidos ONLINE
 * confirmados y ventas MANUALES confirmadas que tengan el producto cargado
 * (Ale, 2026-08-09: "más vendidos" tiene que contar las dos vías, no solo un
 * checkbox manual). Las ventas manuales de texto libre (sin `product_id`) no
 * se pueden sumar acá: no hay forma de saber a qué producto correspondían.
 */
export async function sumSalesByProduct(
  database: Database = db,
): Promise<Map<string, number>> {
  const [online, manual] = await Promise.all([
    database
      .select({
        productId: orderItems.productId,
        qty: sql<number>`sum(${orderItems.quantity})::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          inArray(orders.status, SOLD_STATUSES),
          isNotNull(orderItems.productId),
        ),
      )
      .groupBy(orderItems.productId),
    database
      .select({
        productId: manualSales.productId,
        qty: sql<number>`sum(${manualSales.quantity})::int`,
      })
      .from(manualSales)
      .where(
        and(
          inArray(manualSales.status, SOLD_STATUSES),
          isNotNull(manualSales.productId),
        ),
      )
      .groupBy(manualSales.productId),
  ]);
  return mergeSalesCounts(online, manual);
}

/**
 * "Más vendidos" real para la Home: ranking por unidades vendidas (online +
 * mostrador), no un checkbox manual. Si hay menos de `limit` productos con
 * ventas (tienda nueva, o recién arrancando con esto), completa con los
 * publicados más nuevos para no dejar la sección corta o vacía.
 */
export async function findTopSelling(
  limit = 8,
  database: Database = db,
): Promise<ProductWithRelations[]> {
  const counts = await sumSalesByProduct(database);
  const rankedIds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, limit);

  const ranked: ProductWithRelations[] =
    rankedIds.length > 0
      ? await database.query.products.findMany({
          where: and(
            eq(products.status, "published"),
            inArray(products.id, rankedIds),
          ),
          with: {
            category: true,
            images: { orderBy: (img, { asc }) => [asc(img.sortOrder)] },
            variants: true,
          },
        })
      : [];
  // `findMany` no respeta el orden de `inArray`: se reordena según el ranking real.
  const byId = new Map(ranked.map((p) => [p.id, p]));
  const orderedRanked = rankedIds
    .map((id) => byId.get(id))
    .filter((p): p is ProductWithRelations => !!p);

  if (orderedRanked.length >= limit) return orderedRanked;

  const usedIds = orderedRanked.map((p) => p.id);
  const fillerConditions: SQL[] = [eq(products.status, "published")];
  if (usedIds.length > 0) {
    fillerConditions.push(notInArray(products.id, usedIds));
  }
  const fillers: ProductWithRelations[] =
    await database.query.products.findMany({
      where: and(...fillerConditions),
      with: {
        category: true,
        images: { orderBy: (img, { asc }) => [asc(img.sortOrder)] },
        variants: true,
      },
      orderBy: [desc(products.createdAt)],
      limit: limit - orderedRanked.length,
    });

  return [...orderedRanked, ...fillers];
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
export async function productSlugExists(
  slug: string,
  database: Database = db,
): Promise<boolean> {
  const [row] = await database
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);
  return !!row;
}

export async function insertProduct(
  values: NewProduct,
  database: Database = db,
): Promise<Product> {
  const [row] = await database.insert(products).values(values).returning();
  if (!row) throw new Error("No se pudo crear el producto");
  return row;
}

/**
 * Reemplaza TODAS las variantes (tamaños) de un producto por el set dado.
 * Es seguro borrar y reinsertar: order_items guarda `variant_label` como texto
 * (snapshot), no una FK a esta tabla → los pedidos viejos no se rompen.
 */
export async function replaceProductVariants(
  productId: string,
  variants: {
    label: string;
    priceOverride: string | null;
    colorGrams: Record<string, number> | null;
    weightGrams: string | null;
    colorPrices: Record<string, number> | null;
  }[],
  database: Database = db,
): Promise<void> {
  await database
    .delete(productVariants)
    .where(eq(productVariants.productId, productId));
  if (variants.length > 0) {
    await database.insert(productVariants).values(
      variants.map((v) => ({
        productId,
        label: v.label,
        priceOverride: v.priceOverride,
        colorGrams: v.colorGrams,
        weightGrams: v.weightGrams,
        colorPrices: v.colorPrices,
      })),
    );
  }
}

/** Variantes (tamaños) de un producto, para precargar el form de edición. */
export async function listVariantsByProduct(
  productId: string,
  database: Database = db,
): Promise<
  {
    id: string;
    label: string;
    priceOverride: string | null;
    colorGrams: Record<string, number> | null;
    weightGrams: string | null;
    colorPrices: Record<string, number> | null;
  }[]
> {
  return database
    .select({
      id: productVariants.id,
      label: productVariants.label,
      priceOverride: productVariants.priceOverride,
      colorGrams: productVariants.colorGrams,
      weightGrams: productVariants.weightGrams,
      colorPrices: productVariants.colorPrices,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, productId));
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

/**
 * Borra un producto DEFINITIVAMENTE. Devuelve el id borrado (o null si no
 * existía). Seguro para el historial: la FK `order_items.product_id` es
 * ON DELETE SET NULL (el pedido conserva su snapshot de nombre/precio), y todo
 * lo propio del producto (imágenes, variantes, reseñas, tags, favoritos) cae por
 * ON DELETE CASCADE. Ver `order-items.ts` y el schema de products.
 */
export async function deleteProductRow(
  id: string,
  database: Database = db,
): Promise<string | null> {
  const [row] = await database
    .delete(products)
    .where(eq(products.id, id))
    .returning({ id: products.id });
  return row?.id ?? null;
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

/**
 * Asigna (o saca, con `null`) el COLOR de una imagen ya cargada.
 *
 * Sin esto, una foto subida desde el gestor de edición quedaba con `color`
 * nulo para siempre y la galería de la tienda no tenía a qué saltar al elegir
 * el color: el alta por wizard lo guardaba, la edición no (bug 2026-08-09).
 */
export async function setImageColorRow(
  imageId: string,
  color: string | null,
  database: Database = db,
): Promise<ProductImage | null> {
  const [row] = await database
    .update(productImages)
    .set({ color })
    .where(eq(productImages.id, imageId))
    .returning();
  return row ?? null;
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

/**
 * Categorías con cuántos productos tienen.
 *
 * `publishedOnly` cambia QUÉ se cuenta y es importante:
 * - la TIENDA tiene que contar solo publicados (una categoría cuyos productos
 *   están todos en borrador figuraba con "1 producto" y al entrar no había
 *   nada);
 * - el ADMIN cuenta TODOS (incluidos borradores y archivados), porque el conteo
 *   ahí sirve para saber si la categoría está en uso antes de borrarla.
 */
export async function listCategoriesWithCount(
  database: Database | undefined = db,
  opts: { publishedOnly?: boolean } = {},
): Promise<CategoryWithCount[]> {
  database ??= db;
  const join = opts.publishedOnly
    ? and(
        eq(products.categoryId, categories.id),
        eq(products.status, "published"),
      )
    : eq(products.categoryId, categories.id);
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
      imageUrl: categories.imageUrl,
      productCount: sql<number>`count(${products.id})::int`,
    })
    .from(categories)
    .leftJoin(products, join)
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
      colorMode: products.colorMode,
      colorPrices: products.colorPrices,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(ne(products.status, "archived"))
    .orderBy(asc(products.name));
}

/** Variantes (tamaños/combinaciones) de TODOS los productos, en UNA query,
 * para que la venta manual deje elegir CUÁL se vendió (2026-07-24). */
export async function findVariantsForSale() {
  return db
    .select({
      productId: productVariants.productId,
      label: productVariants.label,
      priceOverride: productVariants.priceOverride,
      colorGrams: productVariants.colorGrams,
      weightGrams: productVariants.weightGrams,
      colorPrices: productVariants.colorPrices,
    })
    .from(productVariants);
}
