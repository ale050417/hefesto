import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { categoriesData, productsData } from "./seed-data";

/**
 * Carga datos de ejemplo del catálogo. Idempotente: borra y reinserta.
 * Recibe la base por parámetro (testeable; ver Cap. 6 inyección ligera).
 */
export async function seedDatabase(db: PostgresJsDatabase<typeof schema>) {
  // Limpiar en orden seguro por las FKs.
  await db.delete(schema.productTags);
  await db.delete(schema.productImages);
  await db.delete(schema.productVariants);
  await db.delete(schema.products);
  await db.delete(schema.tags);
  await db.delete(schema.categories);

  // Categorías.
  const cats = await db
    .insert(schema.categories)
    .values(categoriesData)
    .returning();
  const catId = new Map(cats.map((c) => [c.slug, c.id]));

  // Tags (nombres únicos de todos los productos).
  const tagNames = [...new Set(productsData.flatMap((p) => p.tags ?? []))];
  const tagRows = tagNames.length
    ? await db
        .insert(schema.tags)
        .values(tagNames.map((name) => ({ name })))
        .returning()
    : [];
  const tagId = new Map(tagRows.map((t) => [t.name, t.id]));

  // Productos + imágenes + variantes + tags.
  let productCount = 0;
  for (const p of productsData) {
    const inserted = await db
      .insert(schema.products)
      .values({
        name: p.name,
        slug: p.slug,
        description: p.description,
        categoryId: catId.get(p.categorySlug) ?? null,
        price: p.price,
        salePrice: p.salePrice ?? null,
        material: p.material ?? null,
        printTimeMinutes: p.printTimeMinutes ?? null,
        weightGrams: p.weightGrams ?? null,
        dimensions: p.dimensions ?? null,
        status: p.status,
        isFeatured: p.isFeatured ?? false,
        isNew: p.isNew ?? false,
      })
      .returning();
    const prod = inserted[0];
    if (!prod) throw new Error(`No se pudo insertar el producto ${p.slug}`);
    productCount++;

    if (p.images.length > 0) {
      await db.insert(schema.productImages).values(
        p.images.map((image, i) => ({
          productId: prod.id,
          url: image.url,
          alt: image.alt,
          sortOrder: i,
          isPrimary: image.isPrimary ?? i === 0,
        })),
      );
    }

    if (p.variants && p.variants.length > 0) {
      await db.insert(schema.productVariants).values(
        p.variants.map((v) => ({
          productId: prod.id,
          label: v.label,
          priceOverride: v.priceOverride ?? null,
        })),
      );
    }

    if (p.tags && p.tags.length > 0) {
      const links = p.tags
        .map((name) => tagId.get(name))
        .filter((id): id is string => Boolean(id))
        .map((id) => ({ productId: prod.id, tagId: id }));
      if (links.length > 0) {
        await db.insert(schema.productTags).values(links);
      }
    }
  }

  return {
    categories: cats.length,
    products: productCount,
    tags: tagRows.length,
  };
}
