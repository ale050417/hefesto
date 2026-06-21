"use server";

import { z } from "zod";

import { revalidatePath } from "next/cache";
import { isStaff } from "@/core/auth/session";
import { type ActionResult, toActionError } from "@/core/errors";
import { optimizeImage, uploadObject } from "@/core/storage";
import { saveBusinessInfo, setBrandImage } from "./service";

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

const businessInfoSchema = z.object({
  storeName: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  contactEmail: z.string().trim().max(160).optional().or(z.literal("")),
  addressText: z.string().trim().max(200).optional().or(z.literal("")),
  instagram: z.string().trim().max(160).optional().or(z.literal("")),
  facebook: z.string().trim().max(160).optional().or(z.literal("")),
});

export async function saveBusinessInfoAction(
  input: unknown,
): Promise<ActionResult> {
  if (!(await isStaff())) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "No autorizado" },
    };
  }
  const parsed = businessInfoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá los datos." },
    };
  }
  const norm = (v?: string) => (v && v.length > 0 ? v : null);
  try {
    await saveBusinessInfo({
      storeName: norm(parsed.data.storeName),
      description: norm(parsed.data.description),
      whatsapp: norm(parsed.data.whatsapp),
      contactEmail: norm(parsed.data.contactEmail),
      addressText: norm(parsed.data.addressText),
      instagram: norm(parsed.data.instagram),
      facebook: norm(parsed.data.facebook),
    });
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
