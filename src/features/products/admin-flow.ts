import { recordAudit } from "@/core/audit";
import { getAmortization } from "@/features/calculator/service";
import type { CategoryInput, ProductInput } from "./schemas";
import {
  archiveProduct,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  patchProductFields,
  publishProduct,
  updateCategory,
  updateProduct,
} from "./services/catalogService";
import type { NewProduct } from "./types";

/**
 * Escrituras del catálogo CON sus efectos (2026-10-31, pedido de Ale: app
 * móvil). Antes vivían inline en las Server Actions de `actions.ts`; se
 * extrajeron para que la web (Server Action) y la API de la app
 * (`/api/v1/admin/productos|categorias`) hagan EXACTAMENTE lo mismo: lógica de
 * negocio + auditoría.
 *
 * Lo que NO está acá a propósito:
 *  - la AUTORIZACIÓN (permiso productos/ver|crear|editar|eliminar): cada caller
 *    la valida antes de llamar;
 *  - la invalidación de caché: una Server Action usa `updateTag` (solo válido
 *    ahí) y una ruta de la API usa `revalidateTag(..., "max")`
 *    (ver `admin-revalidate.ts`).
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** ¿Es el error de "clave duplicada" de Postgres (23505)? Mira también `cause`. */
export function isUniqueViolation(e: unknown): boolean {
  const code = (x: unknown) =>
    typeof x === "object" && x !== null && "code" in x
      ? (x as { code?: unknown }).code
      : undefined;
  if (code(e) === "23505") return true;
  const cause =
    typeof e === "object" && e !== null && "cause" in e
      ? (e as { cause?: unknown }).cause
      : undefined;
  return code(cause) === "23505";
}

/**
 * Costo de producir (amortización) y ganancia (precio − amortización), con la
 * calculadora del servidor. `null` si no se puede calcular (sin gramos/horas o
 * sin un filamento de ese material): la amortización es obligatoria.
 */
export async function computeProductCosts(input: {
  material?: string | null;
  weightGrams?: number | null;
  printTimeMinutes?: number | null;
  price: number;
}): Promise<{ amortization: number; profit: number } | null> {
  const amort = await getAmortization({
    material: input.material ?? null,
    grams: input.weightGrams ?? 0,
    hours: (input.printTimeMinutes ?? 0) / 60,
  });
  if (!(amort > 0)) return null;
  return {
    amortization: round2(amort),
    profit: round2(Math.max(0, input.price - amort)),
  };
}

/** Inyecta amortización y ganancia al producto; `null` si no se pueden calcular. */
export async function withCosts(
  data: ProductInput,
): Promise<ProductInput | null> {
  const costs = await computeProductCosts({
    material: data.material,
    weightGrams: data.weightGrams,
    printTimeMinutes: data.printTimeMinutes,
    price: data.price,
  });
  return costs ? { ...data, ...costs } : null;
}

// --- Productos ---

export async function createProductFlow(actorId: string, data: ProductInput) {
  const product = await createProduct(data);
  await recordAudit({
    actorId,
    action: "product.created",
    entityType: "product",
    entityId: product.id,
    metadata: { name: data.name, slug: data.slug },
  });
  return product;
}

export async function updateProductFlow(
  actorId: string,
  id: string,
  data: ProductInput,
) {
  const product = await updateProduct(id, data);
  await recordAudit({
    actorId,
    action: "product.updated",
    entityType: "product",
    entityId: product.id,
    metadata: { name: data.name, slug: data.slug },
  });
  return product;
}

/**
 * Edición rápida de la app: cambia SOLO los campos que se mandan (no toca
 * tamaños, colores ni fotos) y deja en auditoría qué campos fueron.
 */
export async function patchProductFlow(
  actorId: string,
  id: string,
  fields: Partial<NewProduct>,
) {
  const product = await patchProductFields(id, fields);
  await recordAudit({
    actorId,
    action: "product.updated",
    entityType: "product",
    entityId: product.id,
    metadata: {
      name: product.name,
      slug: product.slug,
      fields: Object.keys(fields),
      source: "app",
    },
  });
  return product;
}

export async function publishProductFlow(actorId: string, id: string) {
  const product = await publishProduct(id);
  await recordAudit({
    actorId,
    action: "product.published",
    entityType: "product",
    entityId: id,
  });
  return product;
}

export async function archiveProductFlow(actorId: string, id: string) {
  const product = await archiveProduct(id);
  await recordAudit({
    actorId,
    action: "product.archived",
    entityType: "product",
    entityId: id,
  });
  return product;
}

/** Borra el producto DEFINITIVAMENTE (el historial de pedidos se conserva). */
export async function deleteProductFlow(actorId: string, id: string) {
  await deleteProduct(id);
  await recordAudit({
    actorId,
    action: "product.deleted",
    entityType: "product",
    entityId: id,
  });
}

// --- Categorías ---

export async function createCategoryFlow(actorId: string, data: CategoryInput) {
  const category = await createCategory(data);
  await recordAudit({
    actorId,
    action: "category.created",
    entityType: "category",
    entityId: category.id,
    metadata: { name: data.name },
  });
  return category;
}

export async function updateCategoryFlow(
  actorId: string,
  id: string,
  data: CategoryInput,
) {
  const category = await updateCategory(id, data);
  await recordAudit({
    actorId,
    action: "category.updated",
    entityType: "category",
    entityId: category.id,
    metadata: { name: data.name },
  });
  return category;
}

/** Reglas: sin productos y sin subcategorías (las valida `deleteCategory`). */
export async function deleteCategoryFlow(actorId: string, id: string) {
  await deleteCategory(id);
  await recordAudit({
    actorId,
    action: "category.deleted",
    entityType: "category",
    entityId: id,
  });
}
