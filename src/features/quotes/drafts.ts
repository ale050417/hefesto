import {
  dimensionLines,
  emptyDraft,
  pricesFromProduct,
  type QuoteDefaults,
  type QuoteDraft,
  type QuotePrice,
} from "./build-quote";

/** Lo que el formulario / wizard de producto sabe y sirve para cotizar. */
export type ProductLike = {
  name: string;
  dimensions?: string | null;
  price: number | string;
  salePrice?: number | string | null;
  colors?: string[];
  colorPrices?: Record<string, number>;
  variants?: Array<{ label: string; price: number | string | null }>;
};

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === "string" ? Number(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function draftFromProduct(
  p: ProductLike,
  defaults: QuoteDefaults,
): QuoteDraft {
  return {
    ...emptyDraft(defaults),
    product: p.name.trim(),
    dimensions: dimensionLines(p.dimensions),
    prices: pricesFromProduct({
      price: num(p.price),
      salePrice: p.salePrice == null ? null : num(p.salePrice),
      variants: (p.variants ?? []).map((v) => ({
        label: v.label,
        price: v.price == null || v.price === "" ? null : num(v.price),
      })),
      colorPrices: p.colorPrices,
    }),
    colors: [...(p.colors ?? [])],
  };
}

/** Una venta (online o manual) tal como la ve la tabla de Pedidos. */
export type SaleLike = {
  label: string;
  total: number;
  colors: string[];
  items?: Array<{
    productName?: string | null;
    variantLabel: string | null;
    color: string | null;
    quantity: number;
    unitPrice: number;
  }>;
};

export function draftFromSale(
  o: SaleLike,
  defaults: QuoteDefaults,
): QuoteDraft {
  const items = (o.items ?? []).filter((i) => i.unitPrice > 0);
  const names = [
    ...new Set(items.map((i) => (i.productName ?? "").trim()).filter(Boolean)),
  ];
  const product = names.length > 0 ? names.join(" + ") : o.label.trim();
  let prices: QuotePrice[];
  if (items.length === 0) {
    prices = o.total > 0 ? [{ label: "Precio", amount: o.total }] : [];
  } else if (items.length === 1) {
    const it = items[0]!;
    prices = [
      it.quantity > 1
        ? { label: "Precio (Por unidad)", amount: it.unitPrice, suffix: "c/u" }
        : { label: "Precio", amount: it.unitPrice },
    ];
  } else {
    prices = items.map((it) => {
      const what =
        names.length > 1 && it.productName
          ? it.productName
          : (it.variantLabel ?? it.color ?? "Por unidad");
      return {
        label: `Precio (${what.trim()})`,
        amount: it.unitPrice,
        suffix: it.quantity > 1 ? "c/u" : undefined,
      };
    });
  }
  const colors = [
    ...new Set([
      ...o.colors,
      ...items.map((i) => (i.color ?? "").trim()).filter(Boolean),
    ]),
  ];
  return {
    ...emptyDraft(defaults),
    product,
    prices,
    colors,
  };
}
