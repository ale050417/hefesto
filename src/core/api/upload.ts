import type { NextResponse } from "next/server";
import type { ApiUser } from "@/core/auth/api-auth";
import { apiError } from "./respond";

/**
 * Subida de UNA foto desde la app (multipart, campo `file`). Mismas reglas
 * que las Server Actions del panel web: JPG / PNG / WebP y hasta 8 MB.
 */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

export async function readImageUpload(
  request: Request,
): Promise<{ bytes: Buffer; form: FormData } | { response: NextResponse }> {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) {
    return { response: apiError("invalid", "Falta la foto.") };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      response: apiError("invalid", "Formato no permitido (JPG, PNG o WebP)"),
    };
  }
  if (file.size > MAX_BYTES) {
    return { response: apiError("invalid", "El archivo supera los 8 MB") };
  }
  return { bytes: Buffer.from(await file.arrayBuffer()), form };
}

/** Quién hace la operación, con el nombre que queda guardado como snapshot. */
export function apiActor(user: ApiUser): { id: string; name: string | null } {
  return { id: user.id, name: user.profile?.fullName ?? user.email ?? null };
}
