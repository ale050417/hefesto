import { describe, expect, it, vi } from "vitest";

vi.mock("@/core/api/respond", () => ({
  apiError: (code: string, message: string) => ({ code, message }),
}));
// admin-flow importa servicios con base de datos: acá no se usan.
vi.mock("./services/catalogService", () => ({}));
vi.mock("@/features/calculator/service", () => ({}));
vi.mock("@/core/audit", () => ({ recordAudit: vi.fn() }));

import { AppError, NotFoundError, ValidationError } from "@/core/errors";
import { respondBusinessError } from "./admin-api-http";

describe("respondBusinessError (errores de negocio → contrato de la API)", () => {
  it("NOT_FOUND → not_found con su mensaje", () => {
    expect(
      respondBusinessError(new NotFoundError("Producto no encontrado")),
    ).toEqual({
      code: "not_found",
      message: "Producto no encontrado",
    });
  });

  it("validación de negocio → invalid con el motivo en castellano", () => {
    const msg =
      "No se puede borrar: la categoría tiene 3 producto(s). Reasignalos primero.";
    expect(respondBusinessError(new ValidationError(msg))).toEqual({
      code: "invalid",
      message: msg,
    });
    expect(respondBusinessError(new AppError("CONFLICT", "x"))).toMatchObject({
      code: "invalid",
    });
  });

  it("clave duplicada → invalid con el mensaje indicado", () => {
    expect(
      respondBusinessError({ code: "23505" }, "Ya existe una categoría."),
    ).toEqual({ code: "invalid", message: "Ya existe una categoría." });
  });

  it("lo inesperado se relanza (withApi lo loguea y responde el 503 genérico)", () => {
    const boom = new Error("conexión caída con la base");
    expect(() => respondBusinessError(boom)).toThrow(boom);
    // clave duplicada sin mensaje configurado también es inesperada
    expect(() => respondBusinessError({ code: "23505" })).toThrow();
  });
});
