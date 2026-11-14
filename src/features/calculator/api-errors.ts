import { apiError } from "@/core/api/respond";
import { AppError } from "@/core/errors";

/**
 * Traduce un error al guardar/borrar un tipo de producto (API de la app,
 * 2026-10-31). Errores de negocio → 422 con su mensaje; el nombre repetido
 * (columna `unique`, código 23505 de Postgres) es el más común y se explica;
 * lo inesperado se relanza para que `withApi` lo loguee y responda genérico.
 */
export function presetErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return apiError(
      error.code === "NOT_FOUND" ? "not_found" : "invalid",
      error.message,
    );
  }
  const e = error as { code?: unknown; cause?: { code?: unknown } } | null;
  if (e?.code === "23505" || e?.cause?.code === "23505") {
    return apiError("invalid", "Ya hay un tipo con ese nombre.");
  }
  throw error;
}
