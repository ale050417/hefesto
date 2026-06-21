import { describe, expect, it, vi } from "vitest";
import type { ProductDetailView } from "@/features/products/types";
import type { CreateOrderInput } from "../repository";
import type { Order } from "../types";
import {
  createOrder,
  OrderError,
  type CreateOrderParams,
  type OrderServiceDeps,
} from "./orderService";

// --- Fábricas de prueba ---------------------------------------------------

function makeProduct(over: Partial<ProductDetailView> = {}): ProductDetailView {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Dragón articulado",
    slug: "dragon",
    price: 1000,
    salePrice: null,
    effectivePrice: 1000,
    isOnSale: false,
    discountPercent: null,
    hasVariants: false,
    isNew: false,
    isFeatured: false,
    material: "PLA",
    category: { name: "Figuras", slug: "figuras" },
    primaryImage: null,
    description: null,
    printTimeMinutes: null,
    weightGrams: null,
    dimensions: null,
    images: [],
    variants: [],
    ...over,
  };
}

// Construye deps con un mapa slug -> producto y captura lo que se persiste.
function makeDeps(products: Record<string, ProductDetailView | null>) {
  const persist = vi.fn(
    async (input: CreateOrderInput): Promise<Order> =>
      ({
        id: "order-1",
        ...input.order,
        createdAt: new Date(),
        updatedAt: new Date(),
      }) as unknown as Order,
  );
  const deps: OrderServiceDeps = {
    getProduct: async (slug) => products[slug] ?? null,
    getCoupon: async () => null,
    persist,
    generateOrderNumber: () => "HEF-TEST-0001",
  };
  return { deps, persist };
}

function params(over: Partial<CreateOrderParams> = {}): CreateOrderParams {
  return {
    customerId: "cust-1",
    paymentMethod: "mercadopago",
    shippingAddress: {
      fullName: "Ada Lovelace",
      phone: "1122334455",
      street: "Calle 123",
      city: "CABA",
      province: "Buenos Aires",
      postalCode: "1000",
    },
    items: [{ productId: "p1", slug: "dragon", variantId: null, quantity: 1 }],
    ...over,
  };
}

// --- Tests ----------------------------------------------------------------

describe("createOrder", () => {
  it("recalcula el total desde la base (ignora cualquier precio del cliente)", async () => {
    const { deps, persist } = makeDeps({
      dragon: makeProduct({ price: 1000, effectivePrice: 1000 }),
    });

    await createOrder(
      params({
        items: [
          { productId: "p1", slug: "dragon", variantId: null, quantity: 2 },
        ],
      }),
      deps,
    );

    const input = persist.mock.calls[0]![0];
    expect(input.order.subtotal).toBe("2000.00");
    expect(input.order.total).toBe("2000.00");
    expect(input.items[0]!.unitPrice).toBe("1000.00");
    expect(input.items[0]!.lineTotal).toBe("2000.00");
  });

  it("usa el precio de oferta (effectivePrice) cuando el producto está en oferta", async () => {
    const { deps, persist } = makeDeps({
      dragon: makeProduct({
        price: 1000,
        salePrice: 800,
        effectivePrice: 800,
        isOnSale: true,
      }),
    });

    await createOrder(params(), deps);

    expect(persist.mock.calls[0]![0].items[0]!.unitPrice).toBe("800.00");
  });

  it("usa el precio de la variante cuando existe (reemplaza al precio base)", async () => {
    const product = makeProduct({
      hasVariants: true,
      effectivePrice: 1000,
      variants: [{ id: "v-grande", label: "Grande", price: 1500 }],
    });
    const { deps, persist } = makeDeps({ dragon: product });

    await createOrder(
      params({
        items: [
          {
            productId: "p1",
            slug: "dragon",
            variantId: "v-grande",
            quantity: 1,
          },
        ],
      }),
      deps,
    );

    const item = persist.mock.calls[0]![0].items[0]!;
    expect(item.unitPrice).toBe("1500.00");
    expect(item.variantLabel).toBe("Grande");
  });

  it("cae al precio base si la variante no tiene precio propio (price null)", async () => {
    const product = makeProduct({
      hasVariants: true,
      effectivePrice: 1000,
      variants: [{ id: "v-chica", label: "Chica", price: null }],
    });
    const { deps, persist } = makeDeps({ dragon: product });

    await createOrder(
      params({
        items: [
          {
            productId: "p1",
            slug: "dragon",
            variantId: "v-chica",
            quantity: 1,
          },
        ],
      }),
      deps,
    );

    expect(persist.mock.calls[0]![0].items[0]!.unitPrice).toBe("1000.00");
  });

  it("suma varias líneas correctamente", async () => {
    const { deps, persist } = makeDeps({
      dragon: makeProduct({ effectivePrice: 1000 }),
      anillo: makeProduct({
        id: "p2",
        name: "Anillo",
        slug: "anillo",
        effectivePrice: 250,
      }),
    });

    await createOrder(
      params({
        items: [
          { productId: "p1", slug: "dragon", variantId: null, quantity: 2 }, // 2000
          { productId: "p2", slug: "anillo", variantId: null, quantity: 3 }, // 750
        ],
      }),
      deps,
    );

    expect(persist.mock.calls[0]![0].order.subtotal).toBe("2750.00");
  });

  it("nace en pending_payment y con el número generado", async () => {
    const { deps, persist } = makeDeps({ dragon: makeProduct() });

    await createOrder(params(), deps);

    const order = persist.mock.calls[0]![0].order;
    expect(order.status).toBe("pending_payment");
    expect(order.orderNumber).toBe("HEF-TEST-0001");
    expect(order.discountAmount).toBe("0.00");
  });

  it("rechaza el carrito vacío", async () => {
    const { deps } = makeDeps({});
    await expect(createOrder(params({ items: [] }), deps)).rejects.toThrowError(
      OrderError,
    );
  });

  it("rechaza cantidad inválida", async () => {
    const { deps } = makeDeps({ dragon: makeProduct() });
    await expect(
      createOrder(
        params({
          items: [
            { productId: "p1", slug: "dragon", variantId: null, quantity: 0 },
          ],
        }),
        deps,
      ),
    ).rejects.toMatchObject({ code: "INVALID_QUANTITY" });
  });

  it("rechaza un producto que ya no está disponible", async () => {
    const { deps } = makeDeps({ dragon: null });
    await expect(createOrder(params(), deps)).rejects.toMatchObject({
      code: "PRODUCT_UNAVAILABLE",
    });
  });

  it("exige elegir tamaño si el producto tiene variantes", async () => {
    const product = makeProduct({
      hasVariants: true,
      variants: [{ id: "v1", label: "Grande", price: 1500 }],
    });
    const { deps } = makeDeps({ dragon: product });
    await expect(
      createOrder(
        params({
          items: [
            { productId: "p1", slug: "dragon", variantId: null, quantity: 1 },
          ],
        }),
        deps,
      ),
    ).rejects.toMatchObject({ code: "VARIANT_REQUIRED" });
  });

  it("rechaza una variante que no pertenece al producto", async () => {
    const product = makeProduct({
      hasVariants: true,
      variants: [{ id: "v1", label: "Grande", price: 1500 }],
    });
    const { deps } = makeDeps({ dragon: product });
    await expect(
      createOrder(
        params({
          items: [
            {
              productId: "p1",
              slug: "dragon",
              variantId: "v-falsa",
              quantity: 1,
            },
          ],
        }),
        deps,
      ),
    ).rejects.toMatchObject({ code: "VARIANT_NOT_FOUND" });
  });

  it("no persiste nada cuando una línea falla", async () => {
    const { deps, persist } = makeDeps({ dragon: null });
    await expect(createOrder(params(), deps)).rejects.toThrow();
    expect(persist).not.toHaveBeenCalled();
  });

  it("aplica un cupón válido (descuento y total)", async () => {
    const { deps, persist } = makeDeps({
      dragon: makeProduct({ effectivePrice: 1000 }),
    });
    deps.getCoupon = async () =>
      ({
        id: "c1",
        type: "percentage",
        value: "10",
        minPurchase: "0",
        maxUses: null,
        usedCount: 0,
        startsAt: null,
        expiresAt: null,
        isActive: true,
      }) as unknown as Awaited<ReturnType<typeof deps.getCoupon>>;

    await createOrder(
      params({
        couponCode: "DESC10",
        items: [
          { productId: "p1", slug: "dragon", variantId: null, quantity: 2 },
        ],
      }),
      deps,
    );

    const input = persist.mock.calls[0]![0];
    expect(input.order.subtotal).toBe("2000.00");
    expect(input.order.discountAmount).toBe("200.00");
    expect(input.order.total).toBe("1800.00");
    expect(input.redeemCoupon).toEqual({ couponId: "c1" });
  });

  it("rechaza un cupón inexistente", async () => {
    const { deps } = makeDeps({ dragon: makeProduct() });
    deps.getCoupon = async () => null;
    await expect(
      createOrder(params({ couponCode: "NOPE" }), deps),
    ).rejects.toMatchObject({ code: "INVALID_COUPON" });
  });
});
