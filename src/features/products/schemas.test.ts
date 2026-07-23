import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { productInputSchema } from "./schemas";

// Base mínima válida (el resto de los campos tienen default en el schema).
// categoryId con un UUID real: z.uuid() (Zod v4) valida versión/variante.
const base = {
  name: "Perro personalizado",
  slug: "perro-personalizado",
  categoryId: randomUUID(),
  price: 1000,
};

describe("productInputSchema · variants (tamaños, dinero)", () => {
  it("sin variantes → default []", () => {
    const r = productInputSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.variants).toEqual([]);
  });

  it("parsea label + precio (string→number) y vacío → null", () => {
    const r = productInputSchema.safeParse({
      ...base,
      variants: [
        { label: "Chico 12 cm", price: "500" },
        { label: "Grande 20 cm", price: "" },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.variants[0]).toEqual({
        label: "Chico 12 cm",
        price: 500,
        colorGrams: {},
      });
      expect(r.data.variants[1]).toEqual({
        label: "Grande 20 cm",
        price: null,
        colorGrams: {},
      });
    }
  });

  it("rechaza dos tamaños con el mismo nombre (case-insensitive)", () => {
    const r = productInputSchema.safeParse({
      ...base,
      variants: [
        { label: "Chico", price: "500" },
        { label: "chico", price: "600" },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("rechaza precio de tamaño <= 0", () => {
    expect(
      productInputSchema.safeParse({
        ...base,
        variants: [{ label: "Chico", price: "-5" }],
      }).success,
    ).toBe(false);
    expect(
      productInputSchema.safeParse({
        ...base,
        variants: [{ label: "Chico", price: "0" }],
      }).success,
    ).toBe(false);
  });

  it("rechaza tamaño sin nombre", () => {
    const r = productInputSchema.safeParse({
      ...base,
      variants: [{ label: "   ", price: "500" }],
    });
    expect(r.success).toBe(false);
  });
});
