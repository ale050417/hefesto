import { describe, expect, it } from "vitest";
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/core/errors";
import { businessError, fieldErrors, invalidInput } from "./api-helpers";
import {
  catalogItemSchema,
  failureSchema,
  filamentDetailsSchema,
  filamentSchema,
} from "./schemas";

describe("invalidInput", () => {
  it("responde 422 con el primer mensaje y el detalle por campo", async () => {
    const parsed = filamentSchema.safeParse({
      material: "",
      color: "Rojo",
      brand: "Grilon3",
      diameter: "1.75",
      stockGrams: -5,
      spoolGrams: 1000,
      costPerKg: 20000,
      alertThresholdGrams: 200,
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const res = invalidInput(parsed.error);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("invalid");
    expect(body.error.message).toBe("Ingresá el material.");
    expect(body.error.details.fields).toMatchObject({
      material: "Ingresá el material.",
      stockGrams: "El stock no puede ser negativo.",
    });
  });
});

describe("fieldErrors", () => {
  it("se queda con el primer error de cada campo (rutas anidadas con punto)", () => {
    const parsed = failureSchema.safeParse({
      pieceName: "Lámpara",
      material: "PLA",
      color: "Rojo",
      gramsLost: 10,
      reason: "Otro",
      colorLines: [{ filamentId: "no-es-uuid", grams: 5 }],
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(Object.keys(fieldErrors(parsed.error))[0]).toBe(
      "colorLines.0.filamentId",
    );
  });
});

describe("businessError", () => {
  it("NOT_FOUND → 404, UNAUTHORIZED → 403, el resto → 422, con su mensaje", async () => {
    const nf = businessError(new NotFoundError("No encontramos la falla."))!;
    expect(nf.status).toBe(404);
    expect((await nf.json()).error.message).toBe("No encontramos la falla.");

    expect(businessError(new UnauthorizedError("No."))!.status).toBe(403);

    const v = businessError(new ValidationError("Datos mal."))!;
    expect(v.status).toBe(422);
  });

  it("un error inesperado devuelve null (lo maneja withApi)", () => {
    expect(businessError(new Error("boom"))).toBeNull();
  });
});

describe("schemas de la API", () => {
  it("filamentDetailsSchema ignora el stock", () => {
    const parsed = filamentDetailsSchema.parse({
      material: "PLA",
      color: "Rojo",
      brand: "Grilon3",
      diameter: "1.75",
      stockGrams: 99999,
      spoolGrams: 1000,
      costPerKg: 20000,
      alertThresholdGrams: 200,
    });
    expect("stockGrams" in parsed).toBe(false);
  });

  it("catalogItemSchema valida el tipo y el hex", () => {
    expect(
      catalogItemSchema.safeParse({
        kind: "color",
        name: "Menta",
        hex: "#A1B2C3",
      }).success,
    ).toBe(true);
    expect(
      catalogItemSchema.safeParse({ kind: "color", name: "Menta", hex: "rojo" })
        .success,
    ).toBe(false);
    expect(
      catalogItemSchema.safeParse({ kind: "otro", name: "x" }).success,
    ).toBe(false);
    expect(
      catalogItemSchema.safeParse({ kind: "brand", name: "  " }).success,
    ).toBe(false);
  });
});
