import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  recordAudit: vi.fn(),
  getAmortization: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  patchProductFields: vi.fn(),
  publishProduct: vi.fn(),
  archiveProduct: vi.fn(),
  deleteProduct: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

vi.mock("@/core/audit", () => ({ recordAudit: m.recordAudit }));
vi.mock("@/features/calculator/service", () => ({
  getAmortization: m.getAmortization,
}));
vi.mock("./services/catalogService", () => ({
  createProduct: m.createProduct,
  updateProduct: m.updateProduct,
  patchProductFields: m.patchProductFields,
  publishProduct: m.publishProduct,
  archiveProduct: m.archiveProduct,
  deleteProduct: m.deleteProduct,
  createCategory: m.createCategory,
  updateCategory: m.updateCategory,
  deleteCategory: m.deleteCategory,
}));

import {
  archiveProductFlow,
  computeProductCosts,
  createCategoryFlow,
  createProductFlow,
  deleteCategoryFlow,
  deleteProductFlow,
  isUniqueViolation,
  patchProductFlow,
  publishProductFlow,
  updateCategoryFlow,
  updateProductFlow,
  withCosts,
} from "./admin-flow";
import type { CategoryInput, ProductInput } from "./schemas";

const ACTOR = "actor-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("computeProductCosts / withCosts", () => {
  it("amortización redondeada y ganancia = precio − amortización", async () => {
    m.getAmortization.mockResolvedValue(1234.5678);
    const r = await computeProductCosts({
      material: "PLA",
      weightGrams: 100,
      printTimeMinutes: 120,
      price: 5000,
    });
    expect(m.getAmortization).toHaveBeenCalledWith({
      material: "PLA",
      grams: 100,
      hours: 2,
    });
    expect(r).toEqual({ amortization: 1234.57, profit: 3765.43 });
  });

  it("la ganancia no baja de 0", async () => {
    m.getAmortization.mockResolvedValue(9000);
    const r = await computeProductCosts({ price: 5000 });
    expect(r?.profit).toBe(0);
  });

  it("sin amortización calculable → null (el caller rechaza)", async () => {
    m.getAmortization.mockResolvedValue(0);
    expect(await computeProductCosts({ price: 5000 })).toBeNull();
    expect(
      await withCosts({ price: 5000, name: "x" } as unknown as ProductInput),
    ).toBeNull();
  });

  it("withCosts inyecta los costos sin perder el resto de los datos", async () => {
    m.getAmortization.mockResolvedValue(1000);
    const out = await withCosts({
      name: "Mate",
      price: 4000,
      material: "PLA",
      weightGrams: 50,
      printTimeMinutes: 60,
    } as unknown as ProductInput);
    expect(out).toMatchObject({
      name: "Mate",
      amortization: 1000,
      profit: 3000,
    });
  });
});

describe("flujos de producto (negocio + auditoría)", () => {
  const data = { name: "Mate", slug: "mate", price: 100 } as ProductInput;

  it("createProductFlow crea y deja 'product.created' en auditoría", async () => {
    m.createProduct.mockResolvedValue({ id: "p1", slug: "mate" });
    const p = await createProductFlow(ACTOR, data);
    expect(p.id).toBe("p1");
    expect(m.recordAudit).toHaveBeenCalledWith({
      actorId: ACTOR,
      action: "product.created",
      entityType: "product",
      entityId: "p1",
      metadata: { name: "Mate", slug: "mate" },
    });
  });

  it("updateProductFlow audita 'product.updated'", async () => {
    m.updateProduct.mockResolvedValue({ id: "p1", slug: "mate" });
    await updateProductFlow(ACTOR, "p1", data);
    expect(m.updateProduct).toHaveBeenCalledWith("p1", data);
    expect(m.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "product.updated", entityId: "p1" }),
    );
  });

  it("patchProductFlow toca solo los campos pedidos y audita cuáles (origen app)", async () => {
    m.patchProductFields.mockResolvedValue({
      id: "p1",
      name: "Mate",
      slug: "mate",
    });
    await patchProductFlow(ACTOR, "p1", { isFeatured: true, price: "10" });
    expect(m.patchProductFields).toHaveBeenCalledWith("p1", {
      isFeatured: true,
      price: "10",
    });
    expect(m.updateProduct).not.toHaveBeenCalled();
    expect(m.recordAudit).toHaveBeenCalledWith({
      actorId: ACTOR,
      action: "product.updated",
      entityType: "product",
      entityId: "p1",
      metadata: {
        name: "Mate",
        slug: "mate",
        fields: ["isFeatured", "price"],
        source: "app",
      },
    });
  });

  it.each([
    ["publish", publishProductFlow, m.publishProduct, "product.published"],
    ["archive", archiveProductFlow, m.archiveProduct, "product.archived"],
  ] as const)("%s audita %s", async (_n, flow, service, action) => {
    service.mockResolvedValue({ id: "p1" });
    await flow(ACTOR, "p1");
    expect(service).toHaveBeenCalledWith("p1");
    expect(m.recordAudit).toHaveBeenCalledWith({
      actorId: ACTOR,
      action,
      entityType: "product",
      entityId: "p1",
    });
  });

  it("deleteProductFlow borra y audita 'product.deleted'", async () => {
    m.deleteProduct.mockResolvedValue("p1");
    await deleteProductFlow(ACTOR, "p1");
    expect(m.deleteProduct).toHaveBeenCalledWith("p1");
    expect(m.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "product.deleted", entityId: "p1" }),
    );
  });

  it("si el servicio falla NO se audita (la operación no ocurrió)", async () => {
    m.publishProduct.mockRejectedValue(new Error("sin imágenes"));
    await expect(publishProductFlow(ACTOR, "p1")).rejects.toThrow(
      "sin imágenes",
    );
    expect(m.recordAudit).not.toHaveBeenCalled();
  });
});

describe("flujos de categoría (negocio + auditoría)", () => {
  const input = { name: "Llaveros", slug: "llaveros" } as CategoryInput;

  it("create / update / delete auditan con sus acciones", async () => {
    m.createCategory.mockResolvedValue({ id: "c1" });
    m.updateCategory.mockResolvedValue({ id: "c1" });
    await createCategoryFlow(ACTOR, input);
    await updateCategoryFlow(ACTOR, "c1", input);
    await deleteCategoryFlow(ACTOR, "c1");
    const actions = m.recordAudit.mock.calls.map((c) => c[0].action);
    expect(actions).toEqual([
      "category.created",
      "category.updated",
      "category.deleted",
    ]);
    expect(m.updateCategory).toHaveBeenCalledWith("c1", input);
    expect(m.deleteCategory).toHaveBeenCalledWith("c1");
  });

  it("borrar con productos/subcategorías (el servicio rechaza) no audita", async () => {
    m.deleteCategory.mockRejectedValue(new Error("tiene 2 producto(s)"));
    await expect(deleteCategoryFlow(ACTOR, "c1")).rejects.toThrow(/producto/);
    expect(m.recordAudit).not.toHaveBeenCalled();
  });
});

describe("isUniqueViolation", () => {
  it("detecta 23505 directo o dentro de `cause` (Drizzle envuelve el error)", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(new Error("x"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
