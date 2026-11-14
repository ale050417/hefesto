import type { ZodError } from "zod";
import { apiError } from "@/core/api/respond";
import { AppError } from "@/core/errors";

/**
 * Traducción de errores para los endpoints de ventas de la app
 * (`/api/v1/admin/...`, 2026-10-31).
 */

/** Errores de campo de Zod: { "customerName": "Ingresá el nombre…" }. */
export function zodFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

// Los mensajes que escribimos en los schemas están en castellano; los que trae
// Zod por defecto ("Invalid input: expected number…") están en inglés y no
// sirven en pantalla.
const ZOD_DEFAULT = /^(Invalid|Too (small|big)|Expected|Required|Unrecognized)/;

/** Respuesta 422 de validación con el primer mensaje legible + el detalle por campo. */
export function validationResponse(error: ZodError, fallback: string) {
  const fields = zodFieldErrors(error);
  const readable = Object.values(fields).find((m) => !ZOD_DEFAULT.test(m));
  return apiError("invalid", readable ?? fallback, fields);
}

/**
 * Errores de negocio (`AppError`) → 404 / 422 con su mensaje en castellano
 * (mismo criterio que el endpoint de estado). Lo inesperado se relanza: lo
 * atrapa `withApi` y responde el 503 genérico sin detalles internos.
 */
export function businessErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return apiError(
      error.code === "NOT_FOUND" ? "not_found" : "invalid",
      error.message,
      error.fields,
    );
  }
  throw error;
}
