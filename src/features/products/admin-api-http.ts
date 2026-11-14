import type { NextResponse } from "next/server";
import { apiError } from "@/core/api/respond";
import { AppError } from "@/core/errors";
import { isUniqueViolation } from "./admin-flow";

/**
 * Traduce los errores de NEGOCIO de las escrituras del catálogo al contrato de
 * la API móvil, igual que el endpoint de estado de ventas:
 *  - `AppError` NOT_FOUND → 404 `not_found`; cualquier otro AppError → 422 `invalid`
 *    (con su mensaje en castellano);
 *  - clave duplicada de Postgres (slug / nombre repetidos) → 422 con
 *    `uniqueMessage`;
 *  - lo inesperado se relanza: `withApi` lo registra y responde el 503 genérico.
 */
export function respondBusinessError(
  error: unknown,
  uniqueMessage?: string,
): NextResponse {
  if (error instanceof AppError) {
    return apiError(
      error.code === "NOT_FOUND" ? "not_found" : "invalid",
      error.message,
    );
  }
  if (uniqueMessage && isUniqueViolation(error)) {
    return apiError("invalid", uniqueMessage);
  }
  throw error;
}
