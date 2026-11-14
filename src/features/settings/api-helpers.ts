import type { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { apiError, requireApiPerm } from "@/core/api/respond";
import type { ApiUser } from "@/core/auth/api-auth";
import { AppError } from "@/core/errors";

/**
 * Piezas comunes de las rutas `/api/v1/admin/configuracion/**` (2026-10-31).
 */

/** Permiso config/editar (el que exigen las Server Actions de Configuración). */
export function requireConfigEdit(request: Request) {
  return requireApiPerm(request, "config", "editar");
}

/**
 * Gestión de equipo y roles: SOLO administradores (rol `admin`), igual que
 * `requireAdminActor` de las Server Actions. Un operador con `config/editar`
 * puede tocar los datos del negocio pero no a las personas.
 */
export async function requireTeamAdmin(
  request: Request,
  deniedMessage: string,
): Promise<{ user: ApiUser } | { response: NextResponse }> {
  const auth = await requireApiPerm(request, "config", "editar");
  if ("response" in auth) return auth;
  if (auth.user.profile?.role !== "admin") {
    return { response: apiError("forbidden", deniedMessage) };
  }
  return auth;
}

/** Lee y valida el JSON del pedido; si falla, devuelve la respuesta 422. */
export async function readBody<T>(
  request: Request,
  schema: ZodType<T>,
  invalidMessage: string,
): Promise<{ data: T } | { response: NextResponse }> {
  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // Si el schema trae un mensaje propio (ej. "Ingresá el nombre del
    // negocio.") se muestra tal cual; si no, el genérico de la ruta.
    const own = parsed.error.issues.find(
      (i) => i.code === "custom" || /[áéíóúñ¿]/i.test(i.message),
    )?.message;
    return { response: apiError("invalid", own ?? invalidMessage) };
  }
  return { data: parsed.data };
}

/**
 * Errores de negocio (`AppError`: "No podés cambiar tu propio rol", "Debe
 * quedar al menos un administrador"…) vuelven con su mensaje en castellano;
 * cualquier otra cosa se relanza para el 503 genérico de `withApi`.
 */
export function businessErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return apiError(
      error.code === "NOT_FOUND" ? "not_found" : "invalid",
      error.message,
    );
  }
  throw error;
}

/** "" → null (así guarda la web los campos de texto vacíos). */
export const emptyToNull = (v: string | null | undefined): string | null =>
  v && v.length > 0 ? v : null;
