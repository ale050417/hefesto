"use server";

import { revalidatePath } from "next/cache";
import { getStaffUser, isStaff } from "@/core/auth/session";
import { recordAudit } from "@/core/audit";
import { z, type ZodError } from "zod";
import { categoryInputSchema, productInputSchema } from "./schemas";
import {
  addProductImage,
  archiveProduct,
  createCategory,
  createProduct,
  deleteCategory,
  makeImagePrimary,
  publishProduct,
  removeProductImage,
  updateCategory,
  updateProduct,
} from "./services/catalogService";

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

const SLUG_TAKEN = {
  ok: false as const,
  error: {
    code: "VALIDATION",
    message: "Ya existe un producto con ese slug",
    fields: { slug: "Slug en uso" },
  },
};

export async function createProductAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const actor = await getStaffUser();
  if (!actor) return UNAUTHORIZED;
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
  try {
    const product = await createProduct(parsed.data);
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
  try {
    const product = await updateProduct(id, parsed.data);
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
  if (!(await isStaff())) return UNAUTHORIZED;
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
  if (!(await isStaff())) return UNAUTHORIZED;
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
  if (!(await isStaff())) return UNAUTHORIZED;
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
