import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

// respond.ts arrastra auth/db: acá solo importa el contrato de apiError.
vi.mock("./respond", () => ({
  apiError: (code: string, message: string, details?: unknown) => ({
    code,
    message,
    details,
  }),
}));

import { AppError, NotFoundError, ValidationError } from "@/core/errors";
import {
  appErrorResponse,
  fieldErrors,
  firstIssueMessage,
  invalidBody,
} from "./validate";

const schema = z.object({
  name: z.string().min(2, "Ingresá el nombre."),
  value: z.number().positive("El valor debe ser mayor a 0."),
});

describe("validate (API del panel móvil)", () => {
  const bad = schema.safeParse({ name: "", value: 0 });

  it("firstIssueMessage devuelve el primer mensaje concreto", () => {
    expect(bad.success).toBe(false);
    if (bad.success) return;
    expect(firstIssueMessage(bad.error)).toBe("Ingresá el nombre.");
  });

  it("fieldErrors arma { campo: mensaje } como las Server Actions", () => {
    if (bad.success) return;
    expect(fieldErrors(bad.error)).toEqual({
      name: "Ingresá el nombre.",
      value: "El valor debe ser mayor a 0.",
    });
  });

  it("invalidBody responde 'invalid' con el mensaje y los campos", () => {
    if (bad.success) return;
    expect(invalidBody(bad.error)).toEqual({
      code: "invalid",
      message: "Ingresá el nombre.",
      details: {
        fields: {
          name: "Ingresá el nombre.",
          value: "El valor debe ser mayor a 0.",
        },
      },
    });
  });

  it("appErrorResponse mapea NOT_FOUND y el resto de AppError", () => {
    expect(
      appErrorResponse(new NotFoundError("No encontramos el cliente.")),
    ).toEqual({
      code: "not_found",
      message: "No encontramos el cliente.",
      details: undefined,
    });
    expect(appErrorResponse(new ValidationError("Datos mal."))).toMatchObject({
      code: "invalid",
      message: "Datos mal.",
    });
    expect(
      appErrorResponse(new AppError("CONFLICT", "Ya existe.")),
    ).toMatchObject({ code: "invalid" });
  });

  it("appErrorResponse deja pasar lo inesperado (cae al 503 de withApi)", () => {
    expect(appErrorResponse(new Error("boom"))).toBeNull();
    expect(appErrorResponse("x")).toBeNull();
  });
});
