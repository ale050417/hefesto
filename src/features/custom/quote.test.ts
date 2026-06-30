import { describe, expect, it } from "vitest";
import { canQuote } from "./transitions";
import { customRequestSchema, messageSchema, quoteSchema } from "./schemas";

describe("canQuote (estados cotizables)", () => {
  it("permite cotizar/recotizar en pending y quoted", () => {
    expect(canQuote("pending")).toBe(true);
    expect(canQuote("quoted")).toBe(true);
  });
  it("no permite cotizar en estados avanzados o terminales", () => {
    expect(canQuote("approved")).toBe(false);
    expect(canQuote("in_production")).toBe(false);
    expect(canQuote("done")).toBe(false);
    expect(canQuote("rejected")).toBe(false);
  });
});

describe("quoteSchema (monto de la cotización = dinero)", () => {
  it("acepta un monto positivo (coerciona string)", () => {
    const r = quoteSchema.safeParse({ amount: "15000" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amount).toBe(15000);
  });
  it("rechaza 0, negativos y no-números", () => {
    expect(quoteSchema.safeParse({ amount: "0" }).success).toBe(false);
    expect(quoteSchema.safeParse({ amount: "-5" }).success).toBe(false);
    expect(quoteSchema.safeParse({ amount: "abc" }).success).toBe(false);
  });
});

describe("customRequestSchema.budget (presupuesto del cliente)", () => {
  const base = {
    title: "Soporte",
    description: "Quiero un soporte para auriculares de 12cm.",
  };
  it("trata '' como ausente (opcional)", () => {
    const r = customRequestSchema.safeParse({ ...base, budget: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.budget).toBeUndefined();
  });
  it("coerciona un número positivo", () => {
    const r = customRequestSchema.safeParse({ ...base, budget: "15000" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.budget).toBe(15000);
  });
  it("rechaza presupuesto negativo", () => {
    const r = customRequestSchema.safeParse({ ...base, budget: "-100" });
    expect(r.success).toBe(false);
  });
});

describe("messageSchema (texto y/o foto)", () => {
  it("acepta solo texto", () => {
    expect(messageSchema.safeParse({ body: "Hola" }).success).toBe(true);
  });
  it("acepta solo foto (sin texto)", () => {
    const r = messageSchema.safeParse({
      imageUrl: "https://x.test/a.webp",
    });
    expect(r.success).toBe(true);
  });
  it("acepta texto + foto", () => {
    const r = messageSchema.safeParse({
      body: "Mirá esto",
      imageUrl: "https://x.test/a.webp",
    });
    expect(r.success).toBe(true);
  });
  it("rechaza mensaje vacío sin foto", () => {
    expect(messageSchema.safeParse({ body: "" }).success).toBe(false);
    expect(messageSchema.safeParse({}).success).toBe(false);
  });
});
