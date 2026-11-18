import type { NextResponse } from "next/server";
import type { ApiUser } from "@/core/auth/api-auth";
import { apiError } from "./respond";

/**
 * Subida de UNA foto desde la app (multipart, campo `file`). Mismas reglas
 * de formato que el panel web (JPG / PNG / WebP). Tope de 4 MB: el hosting
 * corta los pedidos de más de ~4,5 MB, así que un tope mayor nunca se cumplía
 * y el error llegaba sin explicación.
 */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 4 * 1024 * 1024;

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
    return {
      response: apiError(
        "invalid",
        "La foto pesa más de 4 MB. Probá con una más liviana.",
      ),
    };
  }
  return { bytes: Buffer.from(await file.arrayBuffer()), form };
}

/** Quién hace la operación, con el nombre que queda guardado como snapshot. */
export function apiActor(user: ApiUser): { id: string; name: string | null } {
  return { id: user.id, name: user.profile?.fullName ?? user.email ?? null };
}
