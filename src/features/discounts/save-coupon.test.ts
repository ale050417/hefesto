import { beforeEach, describe, expect, it, vi } from "vitest";

const addCoupon = vi.fn();
const updateCoupon = vi.fn();
const recordAudit = vi.fn();
const getProductAdmin = vi.fn();
const listCategoriesAdmin = vi.fn();

vi.mock("./queries", () => ({
  addCoupon: (...a: unknown[]) => addCoupon(...a),
  updateCoupon: (...a: unknown[]) => updateCoupon(...a),
}));
vi.mock("@/core/audit", () => ({
  recordAudit: (...a: unknown[]) => recordAudit(...a),
}));
vi.mock("@/features/products/services/catalogService", () => ({
  getProductAdmin: (...a: unknown[]) => getProductAdmin(...a),
  listCategoriesAdmin: (...a: unknown[]) => listCategoriesAdmin(...a),
}));

import { ValidationError } from "@/core/errors";
import { saveCoupon } from "./save-coupon";

const PRODUCT = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  addCoupon.mockResolvedValue({ id: "new-id" });
  updateCoupon.mockResolvedValue({ id: "k1" });
});

describe("saveCoupon (compartido web + app)", () => {
  it("crea: normaliza el código, guarda y audita coupon.created", async () => {
    const saved = await saveCoupon({
      input: { code: " hefesto15 ", type: "percentage", value: "15" },
      actorId: "u1",
    });
    expect(saved).toEqual({ id: "new-id" });
    expect(addCoupon).toHaveBeenCalledOnce();
    expect(addCoupon.mock.calls[0]?.[0]).toMatchObject({
      code: "HEFESTO15",
      type: "percentage",
      value: 15,
    });
    expect(updateCoupon).not.toHaveBeenCalled();
    expect(recordAudit).toHaveBeenCalledWith({
      actorId: "u1",
      action: "coupon.created",
      entityType: "coupon",
      entityId: null,
      metadata: { code: "HEFESTO15" },
    });
  });

  it("edita: actualiza por id y audita coupon.updated con ese id", async () => {
    await saveCoupon({
      input: { code: "viejo", type: "fixed", value: 2000 },
      id: "k1",
      actorId: null,
    });
    expect(updateCoupon).toHaveBeenCalledWith("k1", expect.any(Object));
    expect(addCoupon).not.toHaveBeenCalled();
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        action: "coupon.updated",
        entityId: "k1",
      }),
    );
  });

  it("rechaza datos inválidos con los campos y sin tocar la base", async () => {
    const err = await saveCoupon({
      input: { code: "", type: "fixed", value: 0 },
      actorId: "u1",
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toBe("Revisá los datos.");
    expect((err as ValidationError).fields).toMatchObject({
      code: "Ingresá un código.",
      value: "El valor debe ser mayor a 0.",
    });
    expect(addCoupon).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("un cupón de producto exige que el producto exista", async () => {
    getProductAdmin.mockResolvedValue(null);
    await expect(
      saveCoupon({
        input: {
          code: "MATE10",
          type: "percentage",
          value: 10,
          scope: "product",
          targetId: PRODUCT,
        },
        actorId: "u1",
      }),
    ).rejects.toThrow("El producto o categoría elegido no existe.");
    expect(addCoupon).not.toHaveBeenCalled();

    getProductAdmin.mockResolvedValue({ product: { id: PRODUCT } });
    await saveCoupon({
      input: {
        code: "MATE10",
        type: "percentage",
        value: 10,
        scope: "product",
        targetId: PRODUCT,
        targetLabel: "Mate Mario",
      },
      actorId: "u1",
    });
    expect(addCoupon).toHaveBeenCalledOnce();
  });

  it("un cupón de categoría valida contra la lista de categorías", async () => {
    listCategoriesAdmin.mockResolvedValue([{ id: PRODUCT, name: "Mates" }]);
    await saveCoupon({
      input: {
        code: "MATES",
        type: "fixed",
        value: 500,
        scope: "category",
        targetId: PRODUCT,
      },
      actorId: "u1",
    });
    expect(addCoupon).toHaveBeenCalledOnce();

    listCategoriesAdmin.mockResolvedValue([]);
    await expect(
      saveCoupon({
        input: {
          code: "MATES2",
          type: "fixed",
          value: 500,
          scope: "category",
          targetId: PRODUCT,
        },
        actorId: "u1",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("scope producto sin objetivo falla en el schema (mensaje de la web)", async () => {
    await expect(
      saveCoupon({
        input: { code: "X1", type: "fixed", value: 5, scope: "product" },
        actorId: "u1",
      }),
    ).rejects.toThrow("Revisá los datos.");
  });
});
