import { describe, expect, it } from "vitest";
import type { ProductForSale } from "@/features/products/services/catalogService";
import {
  buildManualSaleInput,
  buildSaleLine,
  defaultSaleDetail,
  manualSaleApiSchema,
  matchFilamentId,
  normalizeSearch,
  saleCatalogItem,
  saleCombos,
  type ManualSaleApiInput,
  type SaleFilamentRef,
} from "./sale-catalog";
import { applyManualSaleLines } from "./services/manualSaleService";
import { manualSaleSchema } from "./schemas";

const F_ROJO = "11111111-1111-4111-8111-111111111111";
const F_BLANCO = "22222222-2222-4222-8222-222222222222";
const F_NEGRO = "33333333-3333-4333-8333-333333333333";
const P_MATE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const P_LLAVERO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const P_DUMPLING = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const filaments: SaleFilamentRef[] = [
  { id: F_ROJO, material: "PLA", color: "Rojo" },
  { id: F_BLANCO, material: "PLA", color: "Blanco" },
  { id: F_NEGRO, material: "PETG", color: "Negro" },
];

function product(over: Partial<ProductForSale>): ProductForSale {
  return {
    id: P_MATE,
    name: "Mate Mario",
    price: 30000,
    material: "PLA",
    weightGrams: 120,
    printMinutes: 300,
    extrasCost: 0,
    colors: ["Rojo", "Blanco"],
    colorMode: "single",
    colorPrices: {},
    variants: [],
    categoryName: "Mates",
    ...over,
  };
}

const mate = product({});

describe("matchFilamentId", () => {
  it("empareja material + color sin importar mayúsculas ni espacios", () => {
    expect(matchFilamentId(filaments, " pla ", "ROJO ")).toBe(F_ROJO);
  });
  it("devuelve null si no hay carrete de ese color", () => {
    expect(matchFilamentId(filaments, "PLA", "Verde")).toBeNull();
    expect(matchFilamentId(filaments, "PETG", "Rojo")).toBeNull();
  });
});

describe("buildSaleLine (espejo de buildLine de la web)", () => {
  it("color único: el peso va TODO al carrete del color vendido", () => {
    const b = buildSaleLine(mate, filaments, null, "Rojo");
    expect(b.unitPrice).toBe(30000);
    expect(b.weight).toBe(120);
    expect(b.colorLines).toEqual([{ filamentId: F_ROJO, grams: 120 }]);
    expect(b.hasStock).toBe(true);
    expect(b.printMinutes).toBe(300);
  });

  it("usa el precio propio del color (el mismo que cobra la tienda)", () => {
    const p = product({ colorPrices: { Rojo: 32000 } });
    expect(buildSaleLine(p, filaments, null, "Rojo").unitPrice).toBe(32000);
    // El otro color cae al precio base.
    expect(buildSaleLine(p, filaments, null, "Blanco").unitPrice).toBe(30000);
  });

  it("usa el tamaño elegido: precio y peso del tamaño, insumo del tamaño", () => {
    const p = product({
      extrasCost: 100,
      variants: [
        {
          label: "Grande",
          price: 45000,
          colorGrams: {},
          weightGrams: 250,
          colorPrices: {},
          extrasCost: 500,
        },
        {
          label: "Chico",
          price: null,
          colorGrams: {},
          weightGrams: null,
          colorPrices: {},
          extrasCost: null,
        },
      ],
    });
    const grande = buildSaleLine(p, filaments, "Grande", "Blanco");
    expect(grande.unitPrice).toBe(45000);
    expect(grande.weight).toBe(250);
    expect(grande.colorLines).toEqual([{ filamentId: F_BLANCO, grams: 250 }]);
    expect(grande.extrasCost).toBe(500);
    // Un tamaño sin datos propios cae a los del producto.
    const chico = buildSaleLine(p, filaments, "Chico", "Blanco");
    expect(chico.unitPrice).toBe(30000);
    expect(chico.weight).toBe(120);
    expect(chico.extrasCost).toBe(100);
  });

  it("color único sin color elegido (o sin carrete) no descuenta stock", () => {
    const sinColor = buildSaleLine(mate, filaments, null, null);
    expect(sinColor.colorLines).toEqual([]);
    expect(sinColor.hasStock).toBe(false);
    const sinCarrete = buildSaleLine(mate, filaments, null, "Verde");
    expect(sinCarrete.hasStock).toBe(false);
  });

  it("multicolor: los gramos por color salen de la combinación elegida", () => {
    const dumpling = product({
      id: P_DUMPLING,
      name: "Dumpling",
      colorMode: "multi",
      colors: [],
      colorPrices: { Rojo: 20, Blanco: 10 }, // GRAMOS por color (no precios)
      weightGrams: 30,
      variants: [
        {
          label: "Rojo + Negro",
          price: 8000,
          colorGrams: { Rojo: 15, Blanco: 5 },
          weightGrams: null,
          colorPrices: {},
          extrasCost: null,
        },
      ],
    });
    const combo = buildSaleLine(dumpling, filaments, "Rojo + Negro", null);
    expect(combo.unitPrice).toBe(8000);
    expect(combo.weight).toBe(20);
    expect(combo.colorLines).toEqual([
      { filamentId: F_ROJO, grams: 15 },
      { filamentId: F_BLANCO, grams: 5 },
    ]);
    // Sin variante, usa los gramos del producto y NO los toma como precio.
    const base = buildSaleLine(dumpling, filaments, null, null);
    expect(base.unitPrice).toBe(30000);
    expect(base.weight).toBe(30);
  });

  it("multicolor sin gramos por color: cae al peso del producto, sin carrete", () => {
    const m = product({
      colorMode: "multi",
      colors: [],
      colorPrices: {},
      weightGrams: 40,
    });
    const b = buildSaleLine(m, filaments, null, null);
    expect(b.weight).toBe(40);
    expect(b.colorLines).toEqual([]);
    expect(b.hasStock).toBe(false);
  });
});

describe("saleCombos / saleCatalogItem", () => {
  it("color único con tamaños: tamaño × color", () => {
    const p = product({
      variants: [
        {
          label: "S",
          price: null,
          colorGrams: {},
          weightGrams: null,
          colorPrices: {},
          extrasCost: null,
        },
        {
          label: "L",
          price: null,
          colorGrams: {},
          weightGrams: null,
          colorPrices: {},
          extrasCost: null,
        },
      ],
    });
    expect(saleCombos(p)).toHaveLength(4);
  });

  it("sin tamaños ni colores: una sola combinación (el producto)", () => {
    expect(saleCombos(product({ colors: [] }))).toEqual([
      { variantLabel: null, color: null },
    ]);
  });

  it("multicolor: una combinación por tamaño/combo, sin color", () => {
    const p = product({
      colorMode: "multi",
      variants: [
        {
          label: "A",
          price: null,
          colorGrams: {},
          weightGrams: null,
          colorPrices: {},
          extrasCost: null,
        },
      ],
    });
    expect(saleCombos(p)).toEqual([{ variantLabel: "A", color: null }]);
  });

  it("el item del catálogo trae el hex del color y el precio de cada opción", () => {
    const item = saleCatalogItem(
      product({ colorPrices: { Rojo: 32000 } }),
      filaments,
      new Map([["rojo", "#CC2200"]]),
    );
    expect(item.colors).toEqual([
      { name: "Rojo", hex: "#CC2200" },
      { name: "Blanco", hex: null },
    ]);
    expect(item.options).toHaveLength(2);
    expect(item.options.find((o) => o.color === "Rojo")?.unitPrice).toBe(32000);
    expect(item.options.every((o) => o.hasStock)).toBe(true);
    expect(item.categoryName).toBe("Mates");
  });
});

describe("defaultSaleDetail", () => {
  it("un solo producto: nombre · tamaño · color", () => {
    expect(
      defaultSaleDetail([
        { name: "Mate", variantLabel: "Grande", color: "Rojo" },
      ]),
    ).toBe("Mate · Grande · Rojo");
  });
  it("varios productos: nombres sin repetir unidos con +", () => {
    expect(
      defaultSaleDetail([
        { name: "Porta" },
        { name: "Llavero" },
        { name: "Porta" },
      ]),
    ).toBe("Porta + Llavero");
  });
});

describe("normalizeSearch", () => {
  it("ignora tildes y mayúsculas", () => {
    expect(normalizeSearch("  Dragón ")).toBe("dragon");
  });
});

const baseBody: ManualSaleApiInput = {
  saleDate: "2026-10-31",
  customerName: "Juan Pérez",
  paymentMethod: "cash",
  status: "pending_payment",
  items: [],
};

function ctx(...ps: ProductForSale[]) {
  return { products: new Map(ps.map((p) => [p.id, p])), filaments };
}

describe("manualSaleApiSchema", () => {
  it("acepta una venta mínima y rechaza sin productos", () => {
    const line = {
      productName: "Cartel",
      quantity: 1,
      unitPrice: 5000,
      unitCost: 1000,
    };
    expect(
      manualSaleApiSchema.safeParse({ ...baseBody, items: [line] }).success,
    ).toBe(true);
    expect(
      manualSaleApiSchema.safeParse({ ...baseBody, items: [] }).success,
    ).toBe(false);
  });

  it("rechaza fecha inválida, cliente vacío y cantidad 0", () => {
    const line = { productName: "x", quantity: 1, unitPrice: 1, unitCost: 0 };
    const bad = (over: object) =>
      manualSaleApiSchema.safeParse({ ...baseBody, items: [line], ...over })
        .success;
    expect(bad({ saleDate: "31/10/2026" })).toBe(false);
    expect(bad({ saleDate: "2026-13-45" })).toBe(false);
    expect(bad({ customerName: "  " })).toBe(false);
    expect(
      manualSaleApiSchema.safeParse({
        ...baseBody,
        items: [{ ...line, quantity: 0 }],
      }).success,
    ).toBe(false);
  });
});

describe("buildManualSaleInput", () => {
  it("producto del catálogo: precio y carrete salen del catálogo, no de la app", () => {
    const r = buildManualSaleInput(
      {
        ...baseBody,
        items: [{ productId: P_MATE, color: "Rojo", quantity: 2 }],
      },
      ctx(mate),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.manualCost).toBeUndefined(); // el costo sale 100% del filamento
    const parsed = manualSaleSchema.safeParse(r.candidate);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.total).toBe(60000);
    expect(parsed.data.quantity).toBe(2);
    expect(parsed.data.detail).toBe("Mate Mario · Rojo");
    expect(parsed.data.items?.[0]).toMatchObject({
      productId: P_MATE,
      printMinutes: 300,
      colorLines: [{ filamentId: F_ROJO, grams: 120 }],
    });
    // El servidor recalcula con las mismas funciones que la web.
    const applied = applyManualSaleLines(parsed.data);
    expect(applied.total).toBe(60000);
    expect(applied.grams).toBe(240); // 120 g × 2 unidades
    expect(applied.productId).toBe(P_MATE);
  });

  it("respeta el precio que el dueño cambió en el mostrador", () => {
    const r = buildManualSaleInput(
      {
        ...baseBody,
        items: [
          { productId: P_MATE, color: "Rojo", quantity: 1, unitPrice: 25000 },
        ],
      },
      ctx(mate),
    );
    expect(r.ok && r.candidate.total).toBe(25000);
  });

  it("varios productos distintos en la misma venta", () => {
    const llavero = product({
      id: P_LLAVERO,
      name: "Llavero",
      price: 2500,
      weightGrams: 8,
      printMinutes: 20,
      extrasCost: 100,
      colors: ["Negro"],
      material: "PETG",
    });
    const r = buildManualSaleInput(
      {
        ...baseBody,
        items: [
          { productId: P_MATE, color: "Blanco", quantity: 1 },
          { productId: P_LLAVERO, color: "Negro", quantity: 4 },
        ],
      },
      ctx(mate, llavero),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidate).toMatchObject({
      total: 40000, // 30000 + 4 × 2500
      quantity: 5,
      // insumo del catálogo: 4 llaveros × $100, va SOLO al costo
      extrasCost: 400,
      chargedExtras: 0,
      detail: "Mate Mario + Llavero",
    });
  });

  it("insumos cargados a mano: se cobran (suman al total) y suman al costo", () => {
    const r = buildManualSaleInput(
      {
        ...baseBody,
        items: [{ productId: P_MATE, color: "Rojo", quantity: 1 }],
        extras: [{ name: "Argollas", cost: 150, qty: 2 }],
      },
      ctx(mate),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidate).toMatchObject({
      total: 30300,
      chargedExtras: 300,
      extrasCost: 300,
    });
    const parsed = manualSaleSchema.parse(r.candidate);
    // applyManualSaleLines conserva los insumos cobrados al recalcular el total.
    expect(applyManualSaleLines(parsed).total).toBe(30300);
  });

  it("texto libre: pide el costo explícito (nunca 0 en silencio)", () => {
    const sinCosto = buildManualSaleInput(
      {
        ...baseBody,
        items: [{ productName: "Reparación", quantity: 1, unitPrice: 3000 }],
      },
      ctx(),
    );
    expect(sinCosto.ok).toBe(false);
    if (!sinCosto.ok) expect(sinCosto.message).toContain("Reparación");

    const conCosto = buildManualSaleInput(
      {
        ...baseBody,
        items: [
          {
            productName: "Reparación",
            quantity: 2,
            unitPrice: 3000,
            unitCost: 500,
          },
        ],
      },
      ctx(),
    );
    expect(conCosto.ok).toBe(true);
    if (!conCosto.ok) return;
    expect(conCosto.manualCost).toBe(1000);
    const parsed = manualSaleSchema.parse(conCosto.candidate);
    expect(parsed.items?.[0]).toMatchObject({
      productName: "Reparación",
      printMinutes: 0,
    });
    expect(parsed.items?.[0]?.colorLines).toBeUndefined();
    expect(parsed.total).toBe(6000);
  });

  it("costo 0 explícito es válido (se dijo a propósito)", () => {
    const r = buildManualSaleInput(
      {
        ...baseBody,
        items: [
          { productName: "Regalo", quantity: 1, unitPrice: 100, unitCost: 0 },
        ],
      },
      ctx(),
    );
    expect(r.ok && r.manualCost).toBe(0);
  });

  it("texto libre sin nombre o sin precio se rechaza con mensaje claro", () => {
    expect(
      buildManualSaleInput(
        {
          ...baseBody,
          items: [{ productName: " ", quantity: 1, unitPrice: 1, unitCost: 0 }],
        },
        ctx(),
      ),
    ).toMatchObject({ ok: false });
    const sinPrecio = buildManualSaleInput(
      { ...baseBody, items: [{ productName: "X", quantity: 1, unitCost: 0 }] },
      ctx(),
    );
    expect(sinPrecio).toMatchObject({ ok: false });
    if (!sinPrecio.ok) expect(sinPrecio.message).toContain("precio");
  });

  it("producto de catálogo sin carrete: pide costo y no cuenta horas de máquina", () => {
    const sinCarrete = buildManualSaleInput(
      {
        ...baseBody,
        items: [{ productId: P_MATE, color: "Verde", quantity: 1 }],
      },
      ctx(mate),
    );
    expect(sinCarrete.ok).toBe(false);

    const conCosto = buildManualSaleInput(
      {
        ...baseBody,
        items: [
          { productId: P_MATE, color: "Verde", quantity: 1, unitCost: 9000 },
        ],
      },
      ctx(mate),
    );
    expect(conCosto.ok).toBe(true);
    if (!conCosto.ok) return;
    expect(conCosto.manualCost).toBe(9000);
    const parsed = manualSaleSchema.parse(conCosto.candidate);
    expect(parsed.items?.[0]?.printMinutes).toBe(0);
  });

  it("mezcla: el costo explícito es solo el de las líneas sin carrete", () => {
    const r = buildManualSaleInput(
      {
        ...baseBody,
        items: [
          { productId: P_MATE, color: "Rojo", quantity: 1, unitCost: 99999 }, // se ignora
          {
            productName: "Servicio",
            quantity: 3,
            unitPrice: 1000,
            unitCost: 200,
          },
        ],
      },
      ctx(mate),
    );
    expect(r.ok && r.manualCost).toBe(600);
  });

  it("producto borrado del catálogo o variante inexistente: error claro", () => {
    const borrado = buildManualSaleInput(
      {
        ...baseBody,
        items: [{ productId: P_LLAVERO, productName: "Llavero", quantity: 1 }],
      },
      ctx(mate),
    );
    expect(borrado).toMatchObject({ ok: false });
    if (!borrado.ok) expect(borrado.message).toContain("Llavero");

    const variante = buildManualSaleInput(
      {
        ...baseBody,
        items: [{ productId: P_MATE, variantLabel: "Gigante", quantity: 1 }],
      },
      ctx(mate),
    );
    expect(variante).toMatchObject({ ok: false });
  });

  it("detalle escrito a mano gana sobre el automático; categoría vacía se omite", () => {
    const r = buildManualSaleInput(
      {
        ...baseBody,
        detail: "Pedido de la feria",
        category: "",
        items: [{ productId: P_MATE, color: "Rojo", quantity: 1 }],
      },
      ctx(mate),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidate.detail).toBe("Pedido de la feria");
    expect(r.candidate.category).toBeUndefined();
  });
});
