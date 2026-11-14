import type { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { AppError } from "@/core/errors";
import { apiError } from "./respond";

/**
 * Helpers de validación para los endpoints del panel móvil (`/api/v1/admin/*`).
 */

/**
 * Primer mensaje de un error de zod (ya viene en castellano desde los
 * schemas). La app lo muestra tal cual en el formulario, así que conviene el
 * mensaje concreto ("Ingresá un código.") y no un genérico "Revisá los datos."
 */
export function firstIssueMessage(error: ZodError): string {
  return error.issues[0]?.message || "Revisá los datos.";
}

/** `{ campo: mensaje }` (igual que `fieldErrors` de las Server Actions). */
export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Respuesta 422 de un body que no pasó el schema. */
export function invalidBody(error: ZodError): NextResponse {
  return apiError("invalid", firstIssueMessage(error), {
    fields: fieldErrors(error),
  });
}

/**
 * Errores de negocio (`AppError`) → respuesta con su mensaje en castellano
 * (404 `not_found` / 422 `invalid`). Devuelve null si NO es un AppError, para
 * que el caller relance y caiga al 503 genérico de `withApi`.
 */
export function appErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof AppError) {
    return apiError(
      error.code === "NOT_FOUND" ? "not_found" : "invalid",
      error.message,
    );
  }
  return null;
}
