"use server";

import { revalidatePath } from "next/cache";
import { isStaff } from "@/core/auth/session";
import { type ActionResult, toActionError } from "@/core/errors";
import { optimizeImage, uploadObject } from "@/core/storage";
import { setBrandImage } from "./service";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

function validationError(message: string): ActionResult<{ url: string }> {
  return { ok: false, error: { code: "VALIDATION", message } };
}

export async function uploadBrandImageAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  if (!(await isStaff())) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "No autorizado" },
    };
  }
  const kind = formData.get("kind");
  const file = formData.get("file");
  if (kind !== "logo" && kind !== "hero") {
    return validationError("Tipo de imagen inválido");
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
    const maxSize = kind === "logo" ? 400 : 1600;
    const webp = await optimizeImage(bytes, maxSize);
    const url = await uploadObject(
      "products",
      `brand/${kind}-${Date.now()}.webp`,
      webp,
      "image/webp",
    );
    await setBrandImage(kind, url);
    revalidatePath("/", "layout");
    revalidatePath("/admin/apariencia");
    return { ok: true, data: { url } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
