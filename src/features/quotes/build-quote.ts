/**
 * Cotización para mandar por WhatsApp (pedido de Ale, 2026-10-21): el texto
 * con el formato que ya usa Antonella, armado solo a partir del producto o
 * la venta, para no escribirlo de cero cada vez. Puro (sin red): se testea.
 *
 * Formato de referencia (ejemplos de Ale):
 *
 *   📦 COTIZACIÓN — HEFESTO 3D
 *
 *   PRODUCTO : Llavero APL
 *
 *   📐 DIMENSIONES APROXIMADAS
 *   * Ancho: 5cm x 4cm
 *
 *   💰 PRECIO
 *   * Precio (Por unidad): $ 2.500 c/u
 *   * Precio (A partir de 10 unidades): $ 1.200 c/u
 *
 *   COLORES CON SIMILITUD:
 *   * Blanco
 *
 *   💸 SEÑA: 50%
 *   La seña es necesaria para confirmar el encargo y comenzar con el trabajo.
 *
 *   📝 ACLARACIÓN:
 *
 *   📌 Las dimensiones y el precio indicados corresponden a la cotización…
 */

export type QuotePrice = {
  /** "Precio", "Precio (Por unidad)", "Precio (A partir de 10 unidades)". */
  label: string;
  amount: number;
  /** "c/u" en los precios por unidad. */
  suffix?: string;
};

export type QuoteDraft = {
  product: string;
  /** Una línea por medida ("Alto: 9 cm"). Vacío = sin sección. */
  dimensions: string[];
  /** Reemplaza la lista de medidas ("En la imagen adjuntada."). */
  dimensionsNote?: string;
  prices: QuotePrice[];
  colors: string[];
  /** null = sin sección de seña. */
  depositPct: number | null;
  depositText: string;
  /** Aclaraciones: cada una sale con 📌. */
  notes: string[];
  /** Texto libre al final (opcional). */
  extra?: string;
};

export type QuoteDefaults = {
  /** Encabezado: "COTIZACIÓN — HEFESTO 3D". */
  title: string;
  depositPct: number;
  depositText: string;
  /** Aclaraciones por defecto (tildadas al abrir). */
  notes: string[];
};

export const DEFAULT_QUOTE_DEFAULTS: QuoteDefaults = {
  title: "COTIZACIÓN — HEFESTO 3D",
  depositPct: 50,
  depositText:
    "La seña es necesaria para confirmar el encargo y comenzar con el trabajo.",
  notes: [
    "Las dimensiones y el precio indicados corresponden a la cotización realizada y pueden variar si se modifica el diseño, tamaño, cantidad o características de la pieza.",
  ],
};

/** $ 14.500 (es-AR, sin decimales). */
export function formatQuoteMoney(n: number): string {
  return `$ ${Math.round(n).toLocaleString("es-AR")}`;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export function buildQuoteText(
  draft: QuoteDraft,
  defaults: QuoteDefaults,
): string {
  const out: string[] = [];
  out.push(`📦 ${clean(defaults.title) || DEFAULT_QUOTE_DEFAULTS.title}`);
  out.push("");
  out.push(`PRODUCTO : ${clean(draft.product) || "—"}`);

  const dims = draft.dimensions.map(clean).filter(Boolean);
  const dimNote = clean(draft.dimensionsNote ?? "");
  if (dims.length > 0 || dimNote) {
    out.push("");
    out.push("📐 DIMENSIONES APROXIMADAS");
    if (dimNote) out.push(dimNote);
    for (const d of dims) out.push(`* ${d}`);
  }

  const prices = draft.prices.filter((p) => Number.isFinite(p.amount));
  if (prices.length > 0) {
    out.push("");
    out.push("💰 PRECIO");
    for (const p of prices) {
      const label = clean(p.label) || "Precio";
      const suffix = p.suffix ? ` ${clean(p.suffix)}` : "";
      out.push(`* ${label}: ${formatQuoteMoney(p.amount)}${suffix}`);
    }
  }

  const colors = draft.colors.map(clean).filter(Boolean);
  if (colors.length > 0) {
    out.push("");
    out.push("COLORES CON SIMILITUD:");
    for (const c of colors) out.push(`* ${c}`);
  }

  if (draft.depositPct != null && draft.depositPct > 0) {
    out.push("");
    out.push(`💸 SEÑA: ${draft.depositPct}%`);
    const t = clean(draft.depositText);
    if (t) out.push(t);
  }

  const notes = draft.notes.map(clean).filter(Boolean);
  const extra = (draft.extra ?? "").trim();
  if (notes.length > 0 || extra) {
    out.push("");
    out.push("📝 ACLARACIÓN:");
    for (const n of notes) {
      out.push("");
      out.push(`📌 ${n}`);
    }
    if (extra) {
      out.push("");
      out.push(extra);
    }
  }

  return out.join("\n");
}

/** Borrador vacío con los textos por defecto cargados. */
export function emptyDraft(defaults: QuoteDefaults): QuoteDraft {
  return {
    product: "",
    dimensions: [],
    prices: [],
    colors: [],
    depositPct: defaults.depositPct,
    depositText: defaults.depositText,
    notes: [...defaults.notes],
  };
}

/** "10 × 8 × 12 cm" o "Alto 9 cm, ancho 5 cm" → líneas de medidas. */
export function dimensionLines(
  dimensions: string | null | undefined,
): string[] {
  const t = clean(dimensions ?? "");
  if (!t) return [];
  // Varias medidas separadas por coma / punto y coma / salto → una por línea.
  const parts = t
    .split(/\s*[,;\n]\s*/)
    .map(clean)
    .filter(Boolean);
  if (parts.length > 1) return parts;
  // Una sola medida sin etiqueta ("10 × 8 × 12 cm"): se la nombra.
  return /:/.test(t) ? [t] : [`Medidas: ${t}`];
}

/** Precio del producto → líneas de precio (base, por tamaño, por color). */
export function pricesFromProduct(p: {
  price: number;
  salePrice?: number | null;
  variants?: Array<{ label: string; price: number | null }>;
  colorPrices?: Record<string, number>;
}): QuotePrice[] {
  const sized = (p.variants ?? []).filter(
    (v) => v.label.trim() && v.price != null && v.price > 0,
  );
  if (sized.length > 0) {
    return sized.map((v) => ({
      label: `Precio (${v.label.trim()})`,
      amount: v.price as number,
    }));
  }
  const byColor = Object.entries(p.colorPrices ?? {}).filter(([, n]) => n > 0);
  if (byColor.length > 1) {
    return byColor.map(([c, n]) => ({ label: `Precio (${c})`, amount: n }));
  }
  const base = p.salePrice && p.salePrice > 0 ? p.salePrice : p.price;
  return base > 0 ? [{ label: "Precio", amount: base }] : [];
}
