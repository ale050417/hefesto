import { describe, expect, it } from "vitest";
import { DEFAULT_QUOTE_DEFAULTS } from "@/features/quotes/build-quote";
import { buildInquiryMessage } from "./message";

describe("buildInquiryMessage", () => {
  it("una unidad: precio simple, sin total ni c/u", () => {
    const text = buildInquiryMessage(
      { title: "Llavero APL", quantity: 1, unitPrice: 2500 },
      DEFAULT_QUOTE_DEFAULTS,
    );
    expect(text).toContain("PRODUCTO : Llavero APL");
    expect(text).toContain("* Precio: $ 2.500");
    expect(text).not.toContain("Total");
    expect(text).toContain("💸 SEÑA: 50%");
  });

  it("varias unidades: precio por unidad, total y precio por cantidad", () => {
    const text = buildInquiryMessage(
      {
        title: "Llavero APL",
        quantity: 4,
        unitPrice: 2500,
        bulkPrice: 1200,
        bulkFrom: 10,
        dimensions: "5 x 4 cm",
        colors: "Blanco; Negro",
        deliveryTime: "3 a 5 días hábiles",
        note: "Incluye argolla.",
      },
      DEFAULT_QUOTE_DEFAULTS,
    );
    expect(text).toContain("PRODUCTO : Llavero APL (x4)");
    expect(text).toContain("* Precio (Por unidad): $ 2.500 c/u");
    expect(text).toContain("* Total (4 unidades): $ 10.000");
    expect(text).toContain("* Precio (A partir de 10 unidades): $ 1.200 c/u");
    expect(text).toContain("* Medidas: 5 x 4 cm");
    expect(text).toContain("* Blanco\n* Negro");
    expect(text).toContain("⏱ DEMORA ESTIMADA: 3 a 5 días hábiles");
    expect(text).toContain("Incluye argolla.");
  });
});
