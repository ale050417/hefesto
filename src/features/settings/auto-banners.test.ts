import { describe, expect, it } from "vitest";
import { isDue, parseBannerCopy, pickCandidates } from "./auto-banners";
import type { ProductView } from "@/features/products/types";

function product(over: Partial<ProductView> & { id: string }): ProductView {
  return {
    name: `Producto ${over.id}`,
    slug: `producto-${over.id}`,
    price: 1000,
    salePrice: null,
    effectivePrice: 1000,
    isOnSale: false,
    discountPercent: null,
    hasVariants: false,
    displayPrice: 1000,
    priceFrom: false,
    saleApplies: false,
    needsChoice: false,
    lineColor: null,
    isNew: true,
    isFeatured: false,
    material: null,
    categoryId: null,
    category: { name: "Figuras", slug: "figuras" },
    primaryImage: {
      url: `https://img/${over.id}.webp`,
      alt: "",
      position: "50% 40%",
      scale: 1,
    },
    ...over,
  } as ProductView;
}

describe("pickCandidates", () => {
  it("nuevos primero, después más vendidos, sin repetir ni sin foto", () => {
    const out = pickCandidates({
      latest: [product({ id: "a" }), product({ id: "b", primaryImage: null })],
      featured: [product({ id: "a" }), product({ id: "c", isNew: false })],
    });
    expect(out.map((c) => c.id)).toEqual(["a", "c"]);
    expect(out[0]?.topSeller).toBe(false);
    expect(out[1]?.topSeller).toBe(true);
    expect(out[0]?.position).toBe("50% 40%");
  });
});

describe("parseBannerCopy", () => {
  const cands = pickCandidates({
    latest: [product({ id: "a" }), product({ id: "b" })],
    featured: [],
  });
  it("lee el JSON aunque venga en un bloque de código y descarta ids ajenos", () => {
    const raw =
      '```json\n[{"productId":"a","title":"Gato lector","subtitle":"Nuevo en la tienda","cta":"Lo quiero"},{"productId":"zzz","title":"x"},{"productId":"b","title":"Llavero APL","subtitle":"","cta":""}]\n```';
    expect(parseBannerCopy(raw, cands)).toEqual([
      {
        productId: "a",
        title: "Gato lector",
        subtitle: "Nuevo en la tienda",
        cta: "Lo quiero",
      },
      {
        productId: "b",
        title: "Llavero APL",
        subtitle: "",
        cta: "Ver producto",
      },
    ]);
  });
  it("devuelve vacío si no hay JSON", () => {
    expect(parseBannerCopy("no puedo", cands)).toEqual([]);
  });
});

describe("isDue", () => {
  it("corre sin corrida previa, y recién a los ~10 días", () => {
    const now = new Date("2026-10-21T12:00:00Z");
    expect(isDue(null, now)).toBe(true);
    expect(isDue("2026-10-15T12:00:00Z", now)).toBe(false);
    expect(isDue("2026-10-11T13:00:00Z", now)).toBe(true);
  });
});
