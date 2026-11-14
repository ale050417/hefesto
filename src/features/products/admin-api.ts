import { z, type ZodError } from "zod";
import {
  categoryPath,
  childrenByParent,
  descendantIds,
  flattenTree,
  sumSubtree,
} from "./category-tree";
import { isNewProduct } from "./new-product";
import { priceRange } from "./pricing";
import { productInputBase } from "./schemas";
import type {
  Category,
  CategoryWithCount,
  NewProduct,
  Product,
  ProductImage,
  ProductWithRelations,
} from "./types";

/**
 * Piezas PURAS de la API del panel móvil para productos y categorías
 * (2026-10-31): filtros del listado, forma del JSON y armado de las ediciones
 * parciales. Sin base de datos ni red → se prueban con tests rápidos
 * (`admin-api.test.ts`). Las rutas (`/api/v1/admin/productos|categorias`) solo
 * autorizan, llaman a los servicios y devuelven esto.
 */

// --- Utilidades ---

/** Slug a partir de un nombre ("Mate Mario!" → "mate-mario"). Igual que el de la web. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Escapa `%`, `_` y `\` para que el texto buscado se tome literal en un ILIKE. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Primer mensaje de error por campo (misma forma que usa la web). */
export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Mensaje único para mostrar en la app: el primer error de campo. */
export function validationMessage(fields: Record<string, string>): string {
  const first = Object.values(fields)[0];
  return first ? first : "Revisá los datos.";
}

/** Objeto plano del body (o `null` si no es un objeto JSON). */
function asRecord(body: unknown): Record<string, unknown> | null {
  return body !== null && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

/** Solo las claves permitidas que vinieron en el body (sin `undefined`). */
function pickDefined(
  body: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (body[k] !== undefined) out[k] = body[k];
  return out;
}

// --- Listado de productos ---

const flag = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

export const adminProductListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(["all", "published", "draft", "archived"]).default("all"),
  /** Id de la categoría: incluye toda su descendencia. */
  category: z.uuid().optional(),
  featured: flag.optional(),
  onSale: flag.optional(),
  noImages: flag.optional(),
  sort: z
    .enum(["updated", "newest", "name", "price_asc", "price_desc"])
    .default("updated"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(40),
});

export type AdminProductListQuery = z.infer<typeof adminProductListQuery>;

/** Query string → filtros validados. Los parámetros vacíos se ignoran. */
export function parseProductListQuery(params: URLSearchParams) {
  const clean: Record<string, string> = {};
  for (const [k, v] of params) if (v.trim() !== "") clean[k] = v;
  return adminProductListQuery.safeParse(clean);
}

/** Una fila del listado: lo justo para la tarjeta (foto, precio, chips). */
export function toAppProductRow(p: ProductWithRelations) {
  const price = Number(p.price);
  const sale = p.salePrice != null ? Number(p.salePrice) : null;
  const isOnSale = sale !== null && sale < price;
  const primary = p.images.find((i) => i.isPrimary) ?? p.images[0] ?? null;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    status: p.status,
    price,
    salePrice: sale,
    isOnSale,
    discountPercent: isOnSale ? Math.round((1 - sale / price) * 100) : null,
    isFeatured: p.isFeatured,
    // "Nuevo" se calcula por fecha (30 días), igual que la web.
    isNew: isNewProduct(p.createdAt),
    material: p.material ?? null,
    categoryId: p.categoryId ?? null,
    categoryName: p.category?.name ?? null,
    imageUrl: primary?.url ?? null,
    imagePosition: primary?.position ?? null,
    imageCount: p.images.length,
    variantCount: p.variants.length,
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
  };
}

// --- Detalle de producto ---

type VariantRow = {
  label: string;
  priceOverride: string | null;
  colorGrams: Record<string, number> | null;
  weightGrams: string | null;
  colorPrices: Record<string, number> | null;
  extrasCost: string | null;
};

const numOrNull = (v: string | null | undefined) =>
  v != null && v !== "" ? Number(v) : null;

/**
 * Ficha completa (solo lectura de variantes, colores e imágenes). Los COSTOS
 * (amortización, ganancia, insumos) van solo si `canSeeCosts`: son datos del
 * módulo Ganancias, no de Productos.
 */
export function toAppProductDetail(args: {
  product: Product;
  images: ProductImage[];
  variants: VariantRow[];
  categories: Pick<CategoryWithCount, "id" | "name" | "parentId">[];
  canSeeCosts: boolean;
}) {
  const { product: p, images, variants, categories, canSeeCosts } = args;
  const price = Number(p.price);
  const sale = p.salePrice != null ? Number(p.salePrice) : null;
  const isOnSale = sale !== null && sale < price;
  const colorMode = p.colorMode === "multi" ? "multi" : "single";
  const range = priceRange({
    price,
    salePrice: sale,
    colorMode,
    colors: p.colors ?? [],
    colorPrices: p.colorPrices ?? {},
    variants: variants.map((v) => ({
      price: numOrNull(v.priceOverride),
      colorPrices: v.colorPrices ?? {},
    })),
  });
  const category = categories.find((c) => c.id === p.categoryId) ?? null;

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description ?? null,
    status: p.status,
    isFeatured: p.isFeatured,
    isNew: isNewProduct(p.createdAt),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    categoryId: p.categoryId ?? null,
    categoryName: category?.name ?? null,
    categoryPath: category ? categoryPath(categories, category.id) : null,
    price,
    salePrice: sale,
    isOnSale,
    discountPercent: isOnSale ? Math.round((1 - sale / price) * 100) : null,
    // Rango REAL que paga un cliente (tamaños × colores), como la tienda.
    priceMin: range.min,
    priceMax: range.max,
    priceFrom: range.from,
    material: p.material ?? null,
    printTimeMinutes: p.printTimeMinutes ?? null,
    weightGrams: p.weightGrams ?? null,
    dimensions: p.dimensions ?? null,
    layerHeight: p.layerHeight ?? null,
    infillPercent: p.infillPercent ?? null,
    productionTime: p.productionTime ?? null,
    colorMode,
    colors: p.colors ?? [],
    // Color único = PRECIO exacto por color; multicolor = GRAMOS por color.
    colorPrices: p.colorPrices ?? {},
    variants: variants.map((v) => ({
      label: v.label,
      price: numOrNull(v.priceOverride),
      colorGrams: v.colorGrams ?? {},
      weightGrams: numOrNull(v.weightGrams),
      colorPrices: v.colorPrices ?? {},
      ...(canSeeCosts ? { extrasCost: numOrNull(v.extrasCost) } : {}),
    })),
    images: images.map((i) => ({
      id: i.id,
      url: i.url,
      alt: i.alt ?? null,
      isPrimary: i.isPrimary,
      sortOrder: i.sortOrder,
      color: i.color ?? null,
      position: i.position,
      scale: Number(i.scale),
    })),
    costs: canSeeCosts
      ? {
          amortization: numOrNull(p.amortization),
          profit: numOrNull(p.profit),
          extrasCost: numOrNull(p.extrasCost) ?? 0,
        }
      : null,
  };
}

// --- Alta de producto ---

/** Campos que la app puede mandar al crear (el resto se arma en la web). */
const CREATE_KEYS = [
  "name",
  "categoryId",
  "price",
  "salePrice",
  "description",
  "material",
  "printTimeMinutes",
  "weightGrams",
  "dimensions",
  "productionTime",
  "extrasCost",
  "isFeatured",
] as const;

/**
 * Body de la app → candidato para `productInputSchema` (el MISMO schema que la
 * web). El slug sale del nombre (el servidor le agrega -2, -3… si ya existe) y
 * el producto nace como BORRADOR: publicar exige fotos, que se suben desde la web.
 */
export function buildProductCreateCandidate(body: unknown): unknown {
  const rec = asRecord(body);
  if (!rec) return null;
  const picked = pickDefined(rec, CREATE_KEYS);
  const name = typeof picked.name === "string" ? picked.name.trim() : "";
  return { ...picked, name, slug: slugify(name), status: "draft" };
}

// --- Edición parcial de producto ---

/**
 * Campos editables desde la app. Salen de la MISMA definición que el alta de la
 * web (`productInputBase`), así que las reglas (largos, precio > 0…) no se
 * duplican. Tamaños, colores y fotos NO se editan desde el celular.
 */
export const productPatchSchema = productInputBase
  .pick({
    name: true,
    slug: true,
    description: true,
    categoryId: true,
    price: true,
    salePrice: true,
    material: true,
    printTimeMinutes: true,
    weightGrams: true,
    dimensions: true,
    layerHeight: true,
    infillPercent: true,
    productionTime: true,
    extrasCost: true,
  })
  .partial()
  .extend({ isFeatured: z.boolean().optional() });

export type ProductPatch = z.infer<typeof productPatchSchema>;

/** Solo las claves que de verdad vinieron en el parche. */
export function definedPatch(patch: ProductPatch): ProductPatch {
  return Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as ProductPatch;
}

/** Parche validado → columnas de `products` (los numéricos van como string). */
export function buildProductPatchRow(patch: ProductPatch): Partial<NewProduct> {
  const p = definedPatch(patch);
  const out: Partial<NewProduct> = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.slug !== undefined) out.slug = p.slug;
  if (p.description !== undefined) out.description = p.description ?? null;
  if (p.categoryId !== undefined) out.categoryId = p.categoryId;
  if (p.price !== undefined) out.price = String(p.price);
  if (p.salePrice !== undefined) {
    out.salePrice = p.salePrice != null ? String(p.salePrice) : null;
  }
  if (p.material !== undefined) out.material = p.material ?? null;
  if (p.printTimeMinutes !== undefined) {
    out.printTimeMinutes = p.printTimeMinutes ?? null;
  }
  if (p.weightGrams !== undefined) out.weightGrams = p.weightGrams ?? null;
  if (p.dimensions !== undefined) out.dimensions = p.dimensions ?? null;
  if (p.layerHeight !== undefined) out.layerHeight = p.layerHeight ?? null;
  if (p.infillPercent !== undefined)
    out.infillPercent = p.infillPercent ?? null;
  if (p.productionTime !== undefined) {
    out.productionTime = p.productionTime ?? null;
  }
  // Insumos: vacío = 0 (la columna es NOT NULL con default 0).
  if (p.extrasCost !== undefined) {
    out.extrasCost = p.extrasCost != null ? String(p.extrasCost) : "0";
  }
  if (p.isFeatured !== undefined) out.isFeatured = p.isFeatured;
  return out;
}

/**
 * Regla de la oferta sobre el resultado FINAL (parche + lo guardado): el precio
 * de oferta tiene que ser menor al precio. Devuelve el mensaje o `null`.
 */
export function checkPatchPrices(
  existing: Pick<Product, "price" | "salePrice">,
  patch: ProductPatch,
): string | null {
  const price = patch.price ?? Number(existing.price);
  const sale =
    patch.salePrice !== undefined
      ? patch.salePrice
      : existing.salePrice != null
        ? Number(existing.salePrice)
        : null;
  if (sale != null && sale >= price) {
    return "El precio de oferta debe ser menor al precio. Bajá o sacá la oferta.";
  }
  return null;
}

type CostsFn = (input: {
  material: string | null;
  weightGrams: number | null;
  printTimeMinutes: number | null;
  price: number;
}) => Promise<{ amortization: number; profit: number } | null>;

/**
 * Qué pasa con amortización y ganancia cuando se edita un producto:
 *  - no se tocó el precio ni la ficha técnica → nada cambia;
 *  - se tocó algo → se recalculan con la calculadora, como la web;
 *  - si NO se pueden calcular y solo cambió el PRECIO, se conserva la
 *    amortización guardada y se recalcula la ganancia (editar un precio no
 *    puede quedar bloqueado por un producto viejo sin material cargado);
 *  - si se tocó material/gramos/tiempo y no se puede calcular → rechazo.
 */
export async function resolvePatchCosts(args: {
  existing: Pick<
    Product,
    "price" | "material" | "weightGrams" | "printTimeMinutes" | "amortization"
  >;
  patch: ProductPatch;
  compute: CostsFn;
}): Promise<{ ok: true; fields: Partial<NewProduct> } | { ok: false }> {
  const { existing, patch, compute } = args;
  const touchesSpecs =
    patch.material !== undefined ||
    patch.weightGrams !== undefined ||
    patch.printTimeMinutes !== undefined;
  if (!touchesSpecs && patch.price === undefined)
    return { ok: true, fields: {} };

  const price = patch.price ?? Number(existing.price);
  const costs = await compute({
    material:
      patch.material !== undefined
        ? patch.material
        : (existing.material ?? null),
    weightGrams:
      patch.weightGrams !== undefined
        ? patch.weightGrams
        : (existing.weightGrams ?? null),
    printTimeMinutes:
      patch.printTimeMinutes !== undefined
        ? patch.printTimeMinutes
        : (existing.printTimeMinutes ?? null),
    price,
  });
  if (costs) {
    return {
      ok: true,
      fields: {
        amortization: String(costs.amortization),
        profit: String(costs.profit),
      },
    };
  }
  const stored =
    existing.amortization != null ? Number(existing.amortization) : 0;
  if (!touchesSpecs && stored > 0) {
    return {
      ok: true,
      fields: { profit: String(round2(Math.max(0, price - stored))) },
    };
  }
  return { ok: false };
}

// --- Categorías ---

/** Campos de una categoría que la app puede mandar. */
const CATEGORY_KEYS = [
  "name",
  "slug",
  "icon",
  "color",
  "parentId",
  "sortOrder",
] as const;

/** Alta: el slug sale del nombre si no vino (como el formulario de la web). */
export function buildCategoryCreateCandidate(body: unknown): unknown {
  const rec = asRecord(body);
  if (!rec) return null;
  const picked = pickDefined(rec, CATEGORY_KEYS);
  const name = typeof picked.name === "string" ? picked.name.trim() : "";
  const slug =
    typeof picked.slug === "string" && picked.slug.trim() !== ""
      ? picked.slug.trim()
      : slugify(name);
  return { ...picked, name, slug };
}

/**
 * Edición parcial: lo guardado + lo que vino en el body. Un campo que no se
 * manda no se toca; el slug se conserva al renombrar (no romper URLs), igual
 * que el formulario de la web.
 */
export function buildCategoryPatchCandidate(
  existing: Pick<
    Category,
    "name" | "slug" | "icon" | "color" | "parentId" | "sortOrder"
  >,
  body: unknown,
): { candidate: unknown; changed: string[] } | null {
  const rec = asRecord(body);
  if (!rec) return null;
  const picked = pickDefined(rec, CATEGORY_KEYS);
  if (typeof picked.name === "string") picked.name = picked.name.trim();
  return {
    candidate: {
      name: existing.name,
      slug: existing.slug,
      icon: existing.icon,
      color: existing.color,
      parentId: existing.parentId,
      sortOrder: existing.sortOrder,
      ...picked,
    },
    changed: Object.keys(picked),
  };
}

/**
 * Categorías en ORDEN DE ÁRBOL (cada una seguida de sus descendientes) con la
 * profundidad ya calculada y los conteos que usa la pantalla. El conteo del
 * padre suma los productos de TODA su descendencia, como en la web.
 */
export function toAppCategoryRows(cats: CategoryWithCount[]) {
  const byParent = childrenByParent(cats);
  return flattenTree(cats).map(({ node, depth }) => ({
    id: node.id,
    name: node.name,
    slug: node.slug,
    icon: node.icon ?? null,
    color: node.color ?? null,
    imageUrl: node.imageUrl ?? null,
    sortOrder: node.sortOrder,
    parentId: node.parentId ?? null,
    depth,
    path: categoryPath(cats, node.id),
    /** Productos de esta categoría (todos los estados). */
    productCount: node.productCount,
    /** Productos de ella y de todas sus subcategorías. */
    totalProductCount: sumSubtree(cats, node.id, (c) => c.productCount),
    childCount: byParent.get(node.id)?.length ?? 0,
    descendantCount: descendantIds(cats, node.id).length,
  }));
}

export function categorySummary(cats: CategoryWithCount[]) {
  const roots = cats.filter(
    (c) => !c.parentId || !cats.some((x) => x.id === c.parentId),
  ).length;
  return {
    total: cats.length,
    roots,
    subcategories: cats.length - roots,
    productsCategorized: cats.reduce((acc, c) => acc + c.productCount, 0),
  };
}
