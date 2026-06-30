"use server";

import { revalidatePath } from "next/cache";
import { getStaffUser } from "@/core/auth/session";
import { can } from "@/core/auth/permissions";
import { recordAudit } from "@/core/audit";
import { z, type ZodError } from "zod";
import { getAmortization } from "@/features/calculator/service";
import {
  categoryInputSchema,
  productInputSchema,
  type ProductInput,
} from "./schemas";
import {
  addProductImage,
  archiveProduct,
  createCategory,
  createProduct,
  deleteCategory,
  getProductAdmin,
  makeImagePrimary,
  publishProduct,
  removeProductImage,
  updateCategory,
  updateProduct,
} from "./services/catalogService";
import type { ProductImage, ProductStatus } from "./types";
import type { ProductFormValues } from "./components/product-form";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { code: string; message: string; fields?: Record<string, string> };
    };

const UNAUTHORIZED = {
  ok: false as const,
  error: { code: "UNAUTHORIZED", message: "No autorizado" },
};

function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "23505"
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const NO_AMORT = {
  ok: false as const,
  error: {
    code: "VALIDATION",
    message:
      "Cargá la amortización con la calculadora (gramos/horas y material).",
    fields: { price: "Falta calcular la amortización" },
  },
};

/**
 * Calcula amortización (costo) en el servidor y la ganancia (precio − amort) y
 * las inyecta. Devuelve null si no se puede calcular (sin gramos/horas) → la
 * amortización es obligatoria.
 */
async function withCosts(data: ProductInput): Promise<ProductInput | null> {
  const amort = await getAmortization({
    material: data.material ?? null,
    grams: data.weightGrams ?? 0,
    hours: (data.printTimeMinutes ?? 0) / 60,
  });
  if (!(amort > 0)) return null;
  return {
    ...data,
    amortization: round2(amort),
    profit: round2(Math.max(0, data.price - amort)),
  };
}

const SLUG_TAKEN = {
  ok: false as const,
  error: {
    code: "VALIDATION",
    message: "Ya existe un producto con ese slug",
    fields: { slug: "Slug en uso" },
  },
};

/** Datos del producto para abrir el modal de edición desde la lista. */
export async function getProductFormDataAction(id: string): Promise<
  ActionResult<{
    name: string;
    status: ProductStatus;
    defaults: ProductFormValues;
    images: ProductImage[];
  }>
> {
  if (!(await can("productos", "ver"))) return UNAUTHORIZED;
  const data = await getProductAdmin(id);
  if (!data) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "No encontrado" },
    };
  }
  const { product, images } = data;
  const defaults: ProductFormValues = {
    name: product.name,
    slug: product.slug,
    description: product.description ?? "",
    categoryId: product.categoryId ?? "",
    price: product.price,
    salePrice: product.salePrice ?? "",
    material: product.material ?? "",
    printTimeMinutes: product.printTimeMinutes?.toString() ?? "",
    weightGrams: product.weightGrams?.toString() ?? "",
    dimensions: product.dimensions ?? "",
    colorMode: product.colorMode === "multi" ? "multi" : "single",
    colors: product.colors ?? [],
    colorPrices: product.colorPrices ?? {},
    layerHeight: product.layerHeight ?? "",
    infillPercent: product.infillPercent?.toString() ?? "",
    productionTime: product.productionTime ?? "",
    isFeatured: product.isFeatured,
    isNew: product.isNew,
  };
  return {
    ok: true,
    data: { name: product.name, status: product.status, defaults, images },
  };
}

export async function createProductAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const actor = await getStaffUser();
  if (!actor) return UNAUTHORIZED;
  if (!(await can("productos", "crear"))) return UNAUTHORIZED;
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá los datos",
        fields: fieldErrors(parsed.error),
      },
    };
  }
  const data = await withCosts(parsed.data);
  if (!data) return NO_AMORT;
  try {
    const product = await createProduct(data);
    await recordAudit({
      actorId: actor.id,
      action: "product.created",
      entityType: "product",
      entityId: product.id,
      metadata: { name: parsed.data.name, slug: parsed.data.slug },
    });
    revalidatePath("/admin/productos");
    return { ok: true, data: { id: product.id } };
  } catch (e) {
    if (isUniqueViolation(e)) return SLUG_TAKEN;
    return {
      ok: false,
      error: { code: "INTERNAL", message: "No se pudo crear el producto" },
    };
  }
}

export async function updateProductAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const actor = await getStaffUser();
  if (!actor) return UNAUTHORIZED;
  if (!(await can("productos", "editar"))) return UNAUTHORIZED;
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá los datos",
        fields: fieldErrors(parsed.error),
      },
    };
  }
  const data = await withCosts(parsed.data);
  if (!data) return NO_AMORT;
  try {
    const product = await updateProduct(id, data);
    await recordAudit({
      actorId: actor.id,
      action: "product.updated",
      entityType: "product",
      entityId: product.id,
      metadata: { name: parsed.data.name, slug: parsed.data.slug },
    });
    revalidatePath("/admin/productos");
    revalidatePath(`/producto/${product.slug}`);
    return { ok: true, data: { id: product.id } };
  } catch (e) {
    if (isUniqueViolation(e)) return SLUG_TAKEN;
    return {
      ok: false,
      error: { code: "INTERNAL", message: "No se pudo actualizar el producto" },
    };
  }
}

export async function publishProductAction(id: string): Promise<ActionResult> {
  const actor = await getStaffUser();
  if (!actor) return UNAUTHORIZED;
  if (!(await can("productos", "editar"))) return UNAUTHORIZED;
  try {
    await publishProduct(id);
    await recordAudit({
      actorId: actor.id,
      action: "product.published",
      entityType: "product",
      entityId: id,
    });
    revalidatePath("/admin/productos");
    return { ok: true, data: undefined };
  } catch (e) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: e instanceof Error ? e.message : "No se pudo publicar",
      },
    };
  }
}

export async function archiveProductAction(id: string): Promise<ActionResult> {
  const actor = await getStaffUser();
  if (!actor) return UNAUTHORIZED;
  if (!(await can("productos", "eliminar"))) return UNAUTHORIZED;
  try {
    await archiveProduct(id);
    await recordAudit({
      actorId: actor.id,
      action: "product.archived",
      entityType: "product",
      entityId: id,
    });
    revalidatePath("/admin/productos");
    return { ok: true, data: undefined };
  } catch (e) {
    return {
      ok: false,
      error: {
        code: "INTERNAL",
        message: e instanceof Error ? e.message : "No se pudo archivar",
      },
    };
  }
}

// --- Imágenes ---

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;
const uuidSchema = z.uuid();

function validationError(message: string) {
  return { ok: false as const, error: { code: "VALIDATION", message } };
}

export async function uploadProductImageAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; url: string }>> {
  if (!(await can("productos", "editar"))) return UNAUTHORIZED;
  const productId = formData.get("productId");
  const file = formData.get("file");
  if (
    typeof productId !== "string" ||
    !uuidSchema.safeParse(productId).success
  ) {
    return validationError("Producto inválido");
  }
  if (!(file instanceof File)) return validationError("Falta el archivo");
  if (!ALLOWED_TYPES.includes(file.type)) {
    return validationError("Formato no permitido (JPG, PNG o WebP)");
  }
  if (file.size > MAX_BYTES) {
    return validationError("El archivo supera los 8 MB");
  }
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const image = await addProductImage(productId, bytes);
    revalidatePath(`/admin/productos/${productId}/editar`);
    return { ok: true, data: { id: image.id, url: image.url } };
  } catch {
    return {
      ok: false,
      error: { code: "INTERNAL", message: "No se pudo subir la imagen" },
    };
  }
}

export async function deleteProductImageAction(
  imageId: string,
): Promise<ActionResult> {
  if (!(await can("productos", "editar"))) return UNAUTHORIZED;
  if (!uuidSchema.safeParse(imageId).success) {
    return validationError("Imagen inválida");
  }
  try {
    const productId = await removeProductImage(imageId);
    revalidatePath(`/admin/productos/${productId}/editar`);
    return { ok: true, data: undefined };
  } catch (e) {
    return {
      ok: false,
      error: {
        code: "INTERNAL",
        message: e instanceof Error ? e.message : "No se pudo borrar la imagen",
      },
    };
  }
}

export async function setPrimaryImageAction(
  productId: string,
  imageId: string,
): Promise<ActionResult> {
  if (!(await can("productos", "editar"))) return UNAUTHORIZED;
  if (
    !uuidSchema.safeParse(productId).success ||
    !uuidSchema.safeParse(imageId).success
  ) {
    return validationError("Datos inválidos");
  }
  try {
    await makeImagePrimary(productId, imageId);
    revalidatePath(`/admin/productos/${productId}/editar`);
    return { ok: true, data: undefined };
  } catch {
    return {
      ok: false,
      error: { code: "INTERNAL", message: "No se pudo marcar como principal" },
    };
  }
}

// --- Categorías ---

const CATEGORY_TAKEN = {
  ok: false as const,
  error: {
    code: "VALIDATION",
    message: "Ya existe una categoría con ese nombre o slug",
    fields: { slug: "Nombre o slug en uso" },
  },
};

export async function createCategoryAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const actor = await getStaffUser();
  if (!actor) return UNAUTHORIZED;
  if (!(await can("productos", "crear"))) return UNAUTHORIZED;
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá los datos",
        fields: fieldErrors(parsed.error),
      },
    };
  }
  try {
    const category = await createCategory(parsed.data);
    await recordAudit({
      actorId: actor.id,
      action: "category.created",
      entityType: "category",
      entityId: category.id,
      metadata: { name: parsed.data.name },
    });
    revalidatePath("/admin/categorias");
    return { ok: true, data: { id: category.id } };
  } catch (e) {
    if (isUniqueViolation(e)) return CATEGORY_TAKEN;
    return {
      ok: false,
      error: { code: "INTERNAL", message: "No se pudo crear la categoría" },
    };
  }
}

export async function updateCategoryAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const actor = await getStaffUser();
  if (!actor) return UNAUTHORIZED;
  if (!(await can("productos", "editar"))) return UNAUTHORIZED;
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá los datos",
        fields: fieldErrors(parsed.error),
      },
    };
  }
  try {
    const category = await updateCategory(id, parsed.data);
    await recordAudit({
      actorId: actor.id,
      action: "category.updated",
      entityType: "category",
      entityId: category.id,
      metadata: { name: parsed.data.name },
    });
    revalidatePath("/admin/categorias");
    return { ok: true, data: { id: category.id } };
  } catch (e) {
    if (isUniqueViolation(e)) return CATEGORY_TAKEN;
    return {
      ok: false,
      error: {
        code: "INTERNAL",
        message: "No se pudo actualizar la categoría",
      },
    };
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const actor = await getStaffUser();
  if (!actor) return UNAUTHORIZED;
  if (!(await can("productos", "eliminar"))) return UNAUTHORIZED;
  if (!uuidSchema.safeParse(id).success) {
    return validationError("Categoría inválida");
  }
  try {
    await deleteCategory(id);
    await recordAudit({
      actorId: actor.id,
      action: "category.deleted",
      entityType: "category",
      entityId: id,
    });
    revalidatePath("/admin/categorias");
    return { ok: true, data: undefined };
  } catch (e) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message:
          e instanceof Error ? e.message : "No se pudo borrar la categoría",
      },
    };
  }
}
