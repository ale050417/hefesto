"use server";

import { revalidatePath } from "next/cache";
import { z, type ZodError } from "zod";
import { productInputSchema } from "./schemas";
import {
  addProductImage,
  archiveProduct,
  createProduct,
  makeImagePrimary,
  publishProduct,
  removeProductImage,
  updateProduct,
} from "./services/catalogService";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { code: string; message: string; fields?: Record<string, string> };
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
  try {
    await publishProduct(id);
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
  try {
    await archiveProduct(id);
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
