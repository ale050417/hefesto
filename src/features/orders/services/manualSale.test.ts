import { describe, expect, it } from "vitest";
import { manualSaleSchema } from "../schemas";

const base = {
  saleDate: "2025-11-02",
  customerName: "Juan Pérez",
  detail: "3 llaveros",
  total: 12500,
  paymentMethod: "cash" as const,
  status: "delivered" as const,
};

describe("manualSaleSchema", () => {
  it("acepta una venta válida", () => {
    const r = manualSaleSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.total).toBe(12500);
      expect(r.data.customerName).toBe("Juan Pérez");
    }
  });

  it("coerce el total desde string", () => {
    const r = manualSaleSchema.safeParse({ ...base, total: "9900" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.total).toBe(9900);
  });

  it("rechaza total 0 o negativo", () => {
    expect(manualSaleSchema.safeParse({ ...base, total: 0 }).success).toBe(
      false,
    );
    expect(manualSaleSchema.safeParse({ ...base, total: -100 }).success).toBe(
      false,
    );
  });

  it("rechaza cliente vacío", () => {
    expect(
      manualSaleSchema.safeParse({ ...base, customerName: "   " }).success,
    ).toBe(false);
  });

  it("convierte detalle vacío en undefined", () => {
    const r = manualSaleSchema.safeParse({ ...base, detail: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.detail).toBeUndefined();
  });

  it("rechaza un estado inválido", () => {
    expect(
      manualSaleSchema.safeParse({ ...base, status: "lo_que_sea" }).success,
    ).toBe(false);
  });
});
