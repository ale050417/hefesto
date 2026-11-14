import type { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { apiError } from "@/core/api/respond";
import { AppError } from "@/core/errors";

/**
 * Helpers de las rutas `/api/v1/admin/{filaments,fallas}` (app móvil,
 * 2026-10-31): traducen errores de validación y de negocio al contrato de
 * errores de la API (`{ error: { code, message } }`).
 */

/** Errores de zod por campo (misma forma que `fieldErrors` de las actions). */
export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * 422 con el PRIMER mensaje de validación como texto (la app lo muestra tal
 * cual) y el detalle por campo en `details.fields`.
 */
export function invalidInput(error: ZodError): NextResponse {
  const fields = fieldErrors(error);
  const first = Object.values(fields)[0] ?? "Revisá los datos.";
  return apiError("invalid", first, { fields });
}

/**
 * Error de negocio (`AppError`) → respuesta de la API con su mensaje en
 * castellano. Devuelve null si NO es un error de negocio (el caller lo relanza
 * y `withApi` lo convierte en 503 genérico, sin filtrar detalles).
 */
export function businessError(error: unknown): NextResponse | null {
  if (!(error instanceof AppError)) return null;
  if (error.code === "NOT_FOUND") return apiError("not_found", error.message);
  if (error.code === "UNAUTHORIZED")
    return apiError("forbidden", error.message);
  return apiError("invalid", error.message);
}
