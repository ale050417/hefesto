import { describe, expect, it } from "vitest";
import {
  draftAge,
  draftTitle,
  hasDraftContent,
  isProductDraft,
  splitDrafts,
  type WizardFiles,
  type WizardSnapshot,
} from "./product-drafts";

const EMPTY: WizardSnapshot = {
  step: 0,
  name: "",
  categoryId: "",
  description: "",
  posX: 50,
  posY: 50,
  colorMode: "single",
  colors: [],
  colorGrams: {},
  colorPricesSingle: {},
  dimensions: "",
  productionTime: "",
  price: "",
  extras: [],
  hasSizes: false,
  byColor: false,
  multiCombos: false,
  variants: [],
  est: {
    filamentId: null,
    material: "",
    color: "",
    grams: 0,
    printMinutes: 0,
    layerHeight: "",
    presetId: "",
    price: null,
  },
  status: "published",
  isFeatured: false,
};
const NO_FILES: WizardFiles = {
  image: null,
  original: null,
  extras: [],
  colorImages: {},
};

describe("hasDraftContent", () => {
  it("un asistente recién abierto no crea borrador", () => {
    expect(hasDraftContent(EMPTY, NO_FILES)).toBe(false);
  });
  it("elegir solo la categoría o cambiar de paso tampoco", () => {
    expect(
      hasDraftContent({ ...EMPTY, categoryId: "c1", step: 2 }, NO_FILES),
    ).toBe(false);
  });
  it("con nombre, precio, colores o una foto, sí", () => {
    expect(hasDraftContent({ ...EMPTY, name: "Trofeo" }, NO_FILES)).toBe(true);
    expect(hasDraftContent({ ...EMPTY, price: "2500" }, NO_FILES)).toBe(true);
    expect(hasDraftContent({ ...EMPTY, colors: ["Negro"] }, NO_FILES)).toBe(
      true,
    );
    expect(
      hasDraftContent(EMPTY, {
        ...NO_FILES,
        image: new File(["x"], "foto.webp"),
      }),
    ).toBe(true);
  });
  it("solo espacios no cuenta", () => {
    expect(hasDraftContent({ ...EMPTY, name: "   " }, NO_FILES)).toBe(false);
  });
});

describe("draftTitle", () => {
  it("usa el nombre, o un texto fijo si todavía no tiene", () => {
    expect(draftTitle({ name: " Trofeo taekwondo " })).toBe("Trofeo taekwondo");
    expect(draftTitle({ name: "" })).toBe("Producto sin nombre");
  });
});

describe("splitDrafts", () => {
  it("ordena del más nuevo al más viejo y separa los que pasan el tope", () => {
    const drafts = [1, 5, 3, 4, 2].map((n) => ({ id: `d${n}`, updatedAt: n }));
    const { keep, stale } = splitDrafts(drafts, 3);
    expect(keep.map((d) => d.id)).toEqual(["d5", "d4", "d3"]);
    expect(stale.map((d) => d.id)).toEqual(["d2", "d1"]);
  });
});

describe("draftAge", () => {
  const now = Date.UTC(2026, 10, 25, 15, 0, 0);
  const ago = (ms: number) => draftAge(now - ms, now);
  it("escribe hace cuánto se guardó", () => {
    expect(ago(20_000)).toBe("recién");
    expect(ago(5 * 60_000)).toBe("hace 5 min");
    expect(ago(3 * 3_600_000)).toBe("hace 3 h");
    expect(ago(26 * 3_600_000)).toBe("ayer");
    expect(ago(4 * 86_400_000)).toBe("hace 4 días");
  });
  it("un reloj corrido hacia adelante no da negativos", () => {
    expect(draftAge(now + 60_000, now)).toBe("recién");
  });
});

describe("isProductDraft", () => {
  it("acepta un borrador bien formado", () => {
    expect(
      isProductDraft({ id: "a", updatedAt: 1, data: EMPTY, files: NO_FILES }),
    ).toBe(true);
  });
  it("descarta datos rotos o de otra versión", () => {
    expect(isProductDraft(null)).toBe(false);
    expect(isProductDraft({ id: "a", updatedAt: 1 })).toBe(false);
    expect(
      isProductDraft({ id: "a", updatedAt: 1, data: {}, files: NO_FILES }),
    ).toBe(false);
  });
});
