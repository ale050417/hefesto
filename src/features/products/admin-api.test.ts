import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  buildCategoryCreateCandidate,
  buildCategoryPatchCandidate,
  buildProductCreateCandidate,
  buildProductPatchRow,
  categorySummary,
  checkPatchPrices,
  definedPatch,
  escapeLike,
  fieldErrors,
  parseProductListQuery,
  productPatchSchema,
  resolvePatchCosts,
  slugify,
  toAppCategoryRows,
  toAppProductDetail,
  toAppProductRow,
  validationMessage,
} from "./admin-api";
import { categoryInputSchema, productInputSchema } from "./schemas";
import type {
  Category,
  CategoryWithCount,
  Product,
  ProductImage,
  ProductWithRelations,
} from "./types";

const NOW = new Date("2026-10-31T12:00:00Z");

function product(over: Partial<Product> = {}): Product {
  return {
    id: randomUUID(),
    name: "Mate Mario",
    slug: "mate-mario",
    description: "Un mate",
    categoryId: randomUUID(),
    price: "30000.00",
    salePrice: null,
    amortization: "8000.00",
    profit: "22000.00",
    extrasCost: "500.00",
    material: "PLA",
    printTimeMinutes: 300,
    weightGrams: 120,
    dimensions: "12 cm",
    colorMode: "single",
    colors: ["Rojo", "Negro"],
    colorPrices: {},
    layerHeight: "0.2 mm",
    infillPercent: 15,
    productionTime: "3 días",
    status: "published",
    isFeatured: false,
    isNew: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  } as Product;
}

function image(over: Partial<ProductImage> = {}): ProductImage {
  return {
    id: randomUUID(),
    productId: "p",
    url: "https://cdn/x.webp",
    alt: null,
    sortOrder: 0,
    isPrimary: false,
    position: "50% 50%",
    scale: "1.00",
    color: null,
    ...over,
  };
}

describe("slugify / escapeLike", () => {
  it("saca tildes, símbolos y guiones sobrantes", () => {
    expect(slugify("  Mate Mario!! ")).toBe("mate-mario");
    expect(slugify("Cartel Piñata ÁÉÍ")).toBe("cartel-pinata-aei");
    expect(slugify("¡¡¡")).toBe("");
  });

  it("escapeLike toma % _ y \\ literales", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});

describe("parseProductListQuery", () => {
  const parse = (qs: string) => parseProductListQuery(new URLSearchParams(qs));

  it("sin parámetros → defaults", () => {
    const r = parse("");
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({
        status: "all",
        sort: "updated",
        page: 1,
        pageSize: 40,
      });
    }
  });

  it("acepta filtros, flags y paginación (strings → tipos)", () => {
    const cat = randomUUID();
    const r = parse(
      `q=%20mate%20&status=draft&category=${cat}&featured=true&onSale=1&noImages=true&sort=price_desc&page=2&pageSize=50`,
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toMatchObject({
        q: "mate",
        status: "draft",
        category: cat,
        featured: true,
        onSale: true,
        noImages: true,
        sort: "price_desc",
        page: 2,
        pageSize: 50,
      });
    }
  });

  it("los parámetros vacíos se ignoran (no rompen la validación)", () => {
    const r = parse("q=&category=&status=");
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.q).toBeUndefined();
      expect(r.data.category).toBeUndefined();
      expect(r.data.status).toBe("all");
    }
  });

  it("rechaza estado, categoría o tamaño de página inválidos", () => {
    expect(parse("status=otro").success).toBe(false);
    expect(parse("category=abc").success).toBe(false);
    expect(parse("pageSize=500").success).toBe(false);
    expect(parse("page=0").success).toBe(false);
    expect(parse("sort=barato").success).toBe(false);
  });
});

describe("toAppProductRow", () => {
  const withRel = (
    p: Product,
    images: ProductImage[] = [],
    variants: number = 0,
  ): ProductWithRelations =>
    ({
      ...p,
      category: { name: "Mates" },
      images,
      variants: Array.from({ length: variants }, () => ({})),
    }) as unknown as ProductWithRelations;

  it("precio, oferta y porcentaje salen como número", () => {
    const row = toAppProductRow(
      withRel(product({ price: "30000.00", salePrice: "24000.00" })),
    );
    expect(row.price).toBe(30000);
    expect(row.salePrice).toBe(24000);
    expect(row.isOnSale).toBe(true);
    expect(row.discountPercent).toBe(20);
  });

  it("sin oferta → isOnSale false y sin porcentaje", () => {
    const row = toAppProductRow(withRel(product()));
    expect(row.isOnSale).toBe(false);
    expect(row.discountPercent).toBeNull();
    expect(row.categoryName).toBe("Mates");
  });

  it("usa la foto principal; si no hay, la primera; si no hay fotos, null", () => {
    const a = image({ url: "a", isPrimary: false });
    const b = image({ url: "b", isPrimary: true });
    expect(toAppProductRow(withRel(product(), [a, b])).imageUrl).toBe("b");
    expect(toAppProductRow(withRel(product(), [a])).imageUrl).toBe("a");
    const none = toAppProductRow(withRel(product()));
    expect(none.imageUrl).toBeNull();
    expect(none.imageCount).toBe(0);
  });

  it("cuenta tamaños y marca 'nuevo' por fecha (30 días)", () => {
    expect(toAppProductRow(withRel(product(), [], 3)).variantCount).toBe(3);
    expect(
      toAppProductRow(withRel(product({ createdAt: new Date() }))).isNew,
    ).toBe(true);
    expect(
      toAppProductRow(withRel(product({ createdAt: new Date("2025-01-01") })))
        .isNew,
    ).toBe(false);
  });
});

describe("toAppProductDetail", () => {
  const cats = [
    { id: "root", name: "Figuras", parentId: null },
    { id: "kid", name: "Funko Pop", parentId: "root" },
  ];
  const variants = [
    {
      label: "Chico",
      priceOverride: "20000.00",
      colorGrams: null,
      weightGrams: "80.00",
      colorPrices: null,
      extrasCost: "300.00",
    },
    {
      label: "Grande",
      priceOverride: "35000.00",
      colorGrams: { Rojo: 40 },
      weightGrams: null,
      colorPrices: { Rojo: 38000 },
      extrasCost: null,
    },
  ];

  it("arma la ficha con ruta de categoría, rango real de precios y costos", () => {
    const d = toAppProductDetail({
      product: product({ categoryId: "kid" }),
      images: [image({ isPrimary: true, scale: "1.50" })],
      variants,
      categories: cats,
      canSeeCosts: true,
    });
    expect(d.categoryPath).toBe("Figuras › Funko Pop");
    expect(d.priceMin).toBe(20000);
    expect(d.priceMax).toBe(38000);
    expect(d.priceFrom).toBe(true);
    expect(d.variants[0]).toMatchObject({
      label: "Chico",
      price: 20000,
      weightGrams: 80,
      extrasCost: 300,
    });
    expect(d.variants[1]?.colorPrices).toEqual({ Rojo: 38000 });
    expect(d.images[0]?.scale).toBe(1.5);
    expect(d.costs).toEqual({
      amortization: 8000,
      profit: 22000,
      extrasCost: 500,
    });
  });

  it("sin permiso de ganancias NO se filtran costos ni insumos por tamaño", () => {
    const d = toAppProductDetail({
      product: product({ categoryId: "kid" }),
      images: [],
      variants,
      categories: cats,
      canSeeCosts: false,
    });
    expect(d.costs).toBeNull();
    expect(d.variants[0]).not.toHaveProperty("extrasCost");
    const json = JSON.stringify(d);
    expect(json).not.toContain("amortization");
    expect(json).not.toContain("profit");
  });

  it("producto sin tamaños ni oferta: rango = precio, sin 'desde'", () => {
    const d = toAppProductDetail({
      product: product({ categoryId: "root", salePrice: "25000.00" }),
      images: [],
      variants: [],
      categories: cats,
      canSeeCosts: false,
    });
    expect(d.priceMin).toBe(25000);
    expect(d.priceFrom).toBe(false);
    expect(d.isOnSale).toBe(true);
    expect(d.categoryName).toBe("Figuras");
  });
});

describe("alta de producto", () => {
  const categoryId = randomUUID();

  it("arma el candidato con slug del nombre y estado borrador", () => {
    const c = buildProductCreateCandidate({
      name: "  Cartel Piñata ",
      categoryId,
      price: "12000",
      status: "published", // la app no puede publicar al crear
      colors: ["Rojo"], // ni mandar campos que no edita
    }) as Record<string, unknown>;
    expect(c).toMatchObject({
      name: "Cartel Piñata",
      slug: "cartel-pinata",
      status: "draft",
    });
    expect(c).not.toHaveProperty("colors");
  });

  it("el candidato pasa el MISMO schema que la web", () => {
    const r = productInputSchema.safeParse(
      buildProductCreateCandidate({
        name: "Mate",
        categoryId,
        price: "12000",
        description: "",
        weightGrams: "100",
        printTimeMinutes: "240",
        material: "PLA",
      }),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.status).toBe("draft");
      expect(r.data.description).toBeNull();
      expect(r.data.weightGrams).toBe(100);
      expect(r.data.variants).toEqual([]);
    }
  });

  it("nombre vacío, precio 0 y oferta mayor al precio se rechazan con mensaje", () => {
    const bad = productInputSchema.safeParse(
      buildProductCreateCandidate({ name: "  ", categoryId, price: 0 }),
    );
    expect(bad.success).toBe(false);
    if (!bad.success) {
      const f = fieldErrors(bad.error);
      expect(f.name).toBeTruthy();
      expect(f.price).toBe("El precio debe ser mayor a 0");
      expect(validationMessage(f)).toBe(Object.values(f)[0]);
    }
    const sale = productInputSchema.safeParse(
      buildProductCreateCandidate({
        name: "A",
        categoryId,
        price: 100,
        salePrice: 150,
      }),
    );
    expect(sale.success).toBe(false);
    if (!sale.success) {
      expect(fieldErrors(sale.error).salePrice).toBe(
        "El precio de oferta debe ser menor al precio",
      );
    }
  });

  it("un body que no es objeto no arma candidato", () => {
    expect(buildProductCreateCandidate(null)).toBeNull();
    expect(buildProductCreateCandidate([1, 2])).toBeNull();
  });
});

describe("productPatchSchema (edición parcial)", () => {
  it("solo trae las claves que vinieron: no inventa defaults (isFeatured, colores…)", () => {
    const r = productPatchSchema.safeParse({ name: "Nuevo nombre" });
    expect(r.success).toBe(true);
    if (r.success)
      expect(definedPatch(r.data)).toEqual({ name: "Nuevo nombre" });
  });

  it("body vacío → parche vacío", () => {
    const r = productPatchSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(definedPatch(r.data)).toEqual({});
  });

  it("'' en opcionales los limpia (null); números llegan como número", () => {
    const r = productPatchSchema.safeParse({
      description: "",
      dimensions: "",
      salePrice: "",
      price: "15000",
      weightGrams: "90",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(definedPatch(r.data)).toEqual({
        description: null,
        dimensions: null,
        salePrice: null,
        price: 15000,
        weightGrams: 90,
      });
    }
  });

  it("aplica las mismas reglas que el alta (precio > 0, nombre no vacío, categoría uuid)", () => {
    expect(productPatchSchema.safeParse({ price: 0 }).success).toBe(false);
    expect(productPatchSchema.safeParse({ name: "" }).success).toBe(false);
    expect(productPatchSchema.safeParse({ categoryId: "x" }).success).toBe(
      false,
    );
    expect(
      productPatchSchema.safeParse({ description: "x".repeat(2001) }).success,
    ).toBe(false);
  });

  it("isFeatured solo si vino; no acepta colores ni tamaños (no se editan acá)", () => {
    const r = productPatchSchema.safeParse({
      isFeatured: true,
      colors: ["Rojo"],
      variants: [{ label: "x", price: 1 }],
      status: "published",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(definedPatch(r.data)).toEqual({ isFeatured: true });
  });

  it("buildProductPatchRow convierte a columnas (dinero como string, insumos null → '0')", () => {
    const r = productPatchSchema.parse({
      name: "X",
      price: 1500.5,
      salePrice: 1000,
      description: "",
      extrasCost: "",
      isFeatured: false,
      printTimeMinutes: 90,
    });
    expect(buildProductPatchRow(r)).toEqual({
      name: "X",
      price: "1500.5",
      salePrice: "1000",
      description: null,
      extrasCost: "0",
      isFeatured: false,
      printTimeMinutes: 90,
    });
  });
});

describe("checkPatchPrices (oferta menor al precio, sobre el resultado final)", () => {
  const existing = { price: "30000.00", salePrice: "24000.00" };

  it("sin cambios de precio → ok", () => {
    expect(checkPatchPrices(existing, { name: "x" })).toBeNull();
  });

  it("bajar el precio por debajo de la oferta guardada se rechaza", () => {
    expect(checkPatchPrices(existing, { price: 20000 })).toMatch(
      /precio de oferta/,
    );
  });

  it("subir la oferta por encima del precio se rechaza; sacarla (null) siempre vale", () => {
    expect(checkPatchPrices(existing, { salePrice: 30000 })).toMatch(
      /precio de oferta/,
    );
    expect(
      checkPatchPrices(existing, { price: 20000, salePrice: null }),
    ).toBeNull();
  });

  it("producto sin oferta acepta cualquier precio", () => {
    expect(
      checkPatchPrices({ price: "100.00", salePrice: null }, { price: 1 }),
    ).toBeNull();
  });
});

describe("resolvePatchCosts (amortización y ganancia al editar)", () => {
  const existing = {
    price: "30000.00",
    material: "PLA",
    weightGrams: 120,
    printTimeMinutes: 300,
    amortization: "8000.00",
  };

  it("si no se toca precio ni ficha técnica, no calcula nada", async () => {
    const compute = vi.fn();
    const r = await resolvePatchCosts({
      existing,
      patch: { name: "x" },
      compute,
    });
    expect(r).toEqual({ ok: true, fields: {} });
    expect(compute).not.toHaveBeenCalled();
  });

  it("al cambiar el precio recalcula con lo guardado + lo nuevo", async () => {
    const compute = vi
      .fn()
      .mockResolvedValue({ amortization: 8500, profit: 11500 });
    const r = await resolvePatchCosts({
      existing,
      patch: { price: 20000 },
      compute,
    });
    expect(compute).toHaveBeenCalledWith({
      material: "PLA",
      weightGrams: 120,
      printTimeMinutes: 300,
      price: 20000,
    });
    expect(r).toEqual({
      ok: true,
      fields: { amortization: "8500", profit: "11500" },
    });
  });

  it("cambiar el material usa el nuevo (y lo guardado para lo demás)", async () => {
    const compute = vi.fn().mockResolvedValue({ amortization: 1, profit: 2 });
    await resolvePatchCosts({
      existing,
      patch: { material: "PETG", weightGrams: null },
      compute,
    });
    expect(compute).toHaveBeenCalledWith({
      material: "PETG",
      weightGrams: null,
      printTimeMinutes: 300,
      price: 30000,
    });
  });

  it("solo precio y no se puede calcular → conserva la amortización y recalcula la ganancia", async () => {
    const r = await resolvePatchCosts({
      existing,
      patch: { price: 10000 },
      compute: async () => null,
    });
    expect(r).toEqual({ ok: true, fields: { profit: "2000" } });
  });

  it("la ganancia nunca queda negativa", async () => {
    const r = await resolvePatchCosts({
      existing,
      patch: { price: 5000 },
      compute: async () => null,
    });
    expect(r).toEqual({ ok: true, fields: { profit: "0" } });
  });

  it("se tocó la ficha técnica y no se puede calcular → rechazo", async () => {
    const r = await resolvePatchCosts({
      existing,
      patch: { material: "ABS" },
      compute: async () => null,
    });
    expect(r).toEqual({ ok: false });
  });

  it("producto sin amortización guardada y sin poder calcular → rechazo", async () => {
    const r = await resolvePatchCosts({
      existing: { ...existing, amortization: null },
      patch: { price: 10000 },
      compute: async () => null,
    });
    expect(r).toEqual({ ok: false });
  });
});

describe("categorías", () => {
  const cat = (
    id: string,
    name: string,
    parentId: string | null,
    productCount: number,
    sortOrder = 0,
  ): CategoryWithCount =>
    ({
      id,
      name,
      slug: slugify(name),
      icon: null,
      color: "#C9A84C",
      imageUrl: null,
      sortOrder,
      parentId,
      createdAt: NOW,
      productCount,
    }) as CategoryWithCount;

  // Figuras › Funko Pop › Superhéroes; Llaveros (raíz).
  const all = [
    cat("f", "Figuras", null, 2),
    cat("l", "Llaveros", null, 5),
    cat("fp", "Funko Pop", "f", 3),
    cat("sh", "Superhéroes", "fp", 4),
  ];

  it("toAppCategoryRows: orden de árbol, profundidad, ruta y conteos del subárbol", () => {
    const rows = toAppCategoryRows(all);
    expect(rows.map((r) => [r.name, r.depth])).toEqual([
      ["Figuras", 0],
      ["Funko Pop", 1],
      ["Superhéroes", 2],
      ["Llaveros", 0],
    ]);
    const figuras = rows[0]!;
    expect(figuras.productCount).toBe(2);
    expect(figuras.totalProductCount).toBe(9);
    expect(figuras.childCount).toBe(1);
    expect(figuras.descendantCount).toBe(2);
    expect(rows[2]!.path).toBe("Figuras › Funko Pop › Superhéroes");
  });

  it("categorySummary cuenta raíces, subcategorías y productos", () => {
    expect(categorySummary(all)).toEqual({
      total: 4,
      roots: 2,
      subcategories: 2,
      productsCategorized: 14,
    });
  });

  it("alta: el slug sale del nombre si no viene; valida con el schema de la web", () => {
    const cand = buildCategoryCreateCandidate({
      name: " Piñatas Locas ",
      parentId: "",
      icon: "gift",
      color: "#5A9CD9",
    });
    const r = categoryInputSchema.safeParse(cand);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toMatchObject({
        name: "Piñatas Locas",
        slug: "pinatas-locas",
        parentId: null,
        icon: "gift",
        color: "#5A9CD9",
        sortOrder: 0,
      });
    }
  });

  it("alta: color mal formado y nombre vacío se rechazan", () => {
    const bad = categoryInputSchema.safeParse(
      buildCategoryCreateCandidate({ name: "X", color: "rojo" }),
    );
    expect(bad.success).toBe(false);
    if (!bad.success) expect(fieldErrors(bad.error).color).toMatch(/#RRGGBB/);
    const empty = categoryInputSchema.safeParse(
      buildCategoryCreateCandidate({ name: "  " }),
    );
    expect(empty.success).toBe(false);
  });

  const parent = randomUUID();
  const existing: Category = {
    id: "fp",
    name: "Funko Pop",
    slug: "funko-pop",
    icon: "star",
    color: "#C9A84C",
    imageUrl: null,
    sortOrder: 3,
    parentId: parent,
    createdAt: NOW,
  };

  it("edición: lo que no se manda se conserva (incluido el slug al renombrar)", () => {
    const m = buildCategoryPatchCandidate(existing, { name: "Funkos" })!;
    expect(m.changed).toEqual(["name"]);
    const r = categoryInputSchema.parse(m.candidate);
    expect(r).toMatchObject({
      name: "Funkos",
      slug: "funko-pop",
      icon: "star",
      color: "#C9A84C",
      parentId: parent,
      sortOrder: 3,
    });
  });

  it("edición: parentId null la pasa a raíz; '' también", () => {
    for (const parentId of [null, ""]) {
      const m = buildCategoryPatchCandidate(existing, { parentId })!;
      expect(categoryInputSchema.parse(m.candidate).parentId).toBeNull();
    }
  });

  it("edición: body vacío no cambia nada; body inválido → null", () => {
    expect(buildCategoryPatchCandidate(existing, {})!.changed).toEqual([]);
    expect(buildCategoryPatchCandidate(existing, "x")).toBeNull();
  });
});
