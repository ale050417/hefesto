import { z } from "zod";
import { saleUnitPrice } from "@/features/products/pricing";
import type { ProductForSale } from "@/features/products/services/catalogService";
import { orderStatusSchema } from "./schemas";

/**
 * Carga de ventas manuales desde la app (2026-10-31, pedido de Ale).
 *
 * En la web el formulario "Cargar venta" arma en el NAVEGADOR el precio, los
 * gramos por carrete, los minutos y el insumo de cada producto elegido
 * (`buildLine` / `optionsFor` de manual-order-form.tsx) y manda todo a la
 * Server Action. La app no tiene esa lógica y duplicarla en Dart sería un
 * segundo lugar donde mantener plata y stock, así que ACÁ vive el mismo cálculo,
 * en el servidor, PURO y testeado:
 *
 *  - `saleCatalogItem` le dice a la app qué se puede vender de cada producto y
 *    a qué precio (para dibujar el selector);
 *  - `buildManualSaleInput` toma lo que eligió la app (producto + tamaño +
 *    color + cantidad) y lo traduce a la MISMA entrada que valida
 *    `manualSaleSchema`, resolviendo gramos/carrete/minutos desde el catálogo.
 *
 * La app nunca manda gramos ni carretes: el stock sale del catálogo.
 */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Lo mínimo de un carrete para emparejar color de catálogo ↔ carrete. */
export type SaleFilamentRef = { id: string; material: string; color: string };

/** Id del carrete que coincide con material + color (sin mayúsculas ni espacios). */
export function matchFilamentId(
  filaments: SaleFilamentRef[],
  material: string,
  color: string,
): string | null {
  const m = material.trim().toLowerCase();
  const c = color.trim().toLowerCase();
  return (
    filaments.find(
      (x) =>
        x.material.trim().toLowerCase() === m &&
        x.color.trim().toLowerCase() === c,
    )?.id ?? null
  );
}

/** Una combinación vendible (tamaño + color) ya resuelta contra el catálogo. */
export type BuiltSaleLine = {
  /** Precio unitario de la tienda para esa elección (`saleUnitPrice`). */
  unitPrice: number;
  /** Gramos de UNA unidad. */
  weight: number;
  /** Gramos por carrete de UNA unidad (solo los que tienen carrete y gramos). */
  colorLines: Array<{ filamentId: string; grams: number }>;
  /** Insumo POR UNIDAD (el del tamaño si lo define, si no el del producto). */
  extrasCost: number;
  /** Minutos de impresión de UNA unidad. */
  printMinutes: number;
  /** ¿Se puede descontar stock? (hay al menos un carrete con gramos). */
  hasStock: boolean;
};

/**
 * Precio, gramos por carrete e insumo de UNA combinación del producto. Es el
 * `buildLine` de la web portado tal cual: el precio sale de `saleUnitPrice`
 * (el mismo helper que cobra la tienda) y los gramos del tamaño/combo elegido.
 */
export function buildSaleLine(
  p: ProductForSale,
  filaments: SaleFilamentRef[],
  variantLabel: string | null,
  color: string | null,
): BuiltSaleLine {
  const variant = p.variants.find((v) => v.label === variantLabel) ?? null;
  const isMulti = p.colorMode === "multi";
  const unitPrice = saleUnitPrice({
    basePrice: p.price,
    colorMode: p.colorMode,
    productColorPrices: p.colorPrices,
    variant,
    color,
  });
  const extrasCost = variant?.extrasCost ?? p.extrasCost ?? 0;

  let lines: Array<{ filamentId: string; grams: number }> = [];
  let weight = 0;
  if (isMulti) {
    // Gramos por color: los del tamaño/combo elegido; si no tiene, los del
    // producto (en multi la columna colorPrices guarda GRAMOS por color).
    const vg = variant?.colorGrams ?? {};
    const source = Object.values(vg).some((g) => g > 0) ? vg : p.colorPrices;
    const entries = Object.entries(source).filter(([, g]) => g > 0);
    lines = entries.map(([c, g]) => ({
      filamentId: matchFilamentId(filaments, p.material ?? "", c) ?? "",
      grams: g,
    }));
    weight = entries.reduce((a, [, g]) => a + g, 0);
    if (lines.length === 0 && (p.weightGrams ?? 0) > 0) {
      weight = p.weightGrams ?? 0;
      lines = [{ filamentId: "", grams: weight }];
    }
  } else {
    // Color único: el peso del tamaño elegido (o del producto) va TODO al
    // color vendido.
    weight =
      variant?.weightGrams && variant.weightGrams > 0
        ? variant.weightGrams
        : (p.weightGrams ?? 0);
    lines = [
      {
        filamentId: color
          ? (matchFilamentId(filaments, p.material ?? "", color) ?? "")
          : "",
        grams: weight > 0 ? weight : 0,
      },
    ];
  }
  const colorLines = lines.filter((l) => l.filamentId && l.grams > 0);
  return {
    unitPrice,
    weight,
    colorLines,
    extrasCost,
    printMinutes: p.printMinutes ?? 0,
    hasStock: colorLines.length > 0,
  };
}

/** Las combinaciones (tamaño × color) de un producto, como en `optionsFor` de la web. */
export function saleCombos(
  p: ProductForSale,
): Array<{ variantLabel: string | null; color: string | null }> {
  const isMulti = p.colorMode === "multi";
  const variants = p.variants.map((v) => v.label);
  // Multicolor: cada tamaño/combinación ya trae sus colores adentro.
  // Color único: cada tamaño se cruza con cada color (o solo los colores si el
  // producto no tiene tamaños).
  if (isMulti) {
    return variants.length > 0
      ? variants.map((label) => ({ variantLabel: label, color: null }))
      : [{ variantLabel: null, color: null }];
  }
  if (variants.length > 0) {
    return p.colors.length > 0
      ? variants.flatMap((label) =>
          p.colors.map((c) => ({ variantLabel: label, color: c })),
        )
      : variants.map((label) => ({ variantLabel: label, color: null }));
  }
  return p.colors.length > 0
    ? p.colors.map((c) => ({ variantLabel: null, color: c }))
    : [{ variantLabel: null, color: null }];
}

/** Producto del catálogo tal como lo consume el selector de la app. */
export type SaleCatalogItem = {
  id: string;
  name: string;
  categoryName: string | null;
  /** Precio base del producto (el de la tienda sin elegir tamaño ni color). */
  price: number;
  colorMode: "single" | "multi";
  /** Colores elegibles (solo color único), con su hex real si está en el catálogo. */
  colors: Array<{ name: string; hex: string | null }>;
  /** Tamaños / combinaciones elegibles (vacío = no hay para elegir). */
  variants: string[];
  /** Todas las combinaciones vendibles con su precio. */
  options: Array<{
    variantLabel: string | null;
    color: string | null;
    unitPrice: number;
    weightGrams: number;
    /** Insumo del catálogo por unidad (va al costo, no se cobra aparte). */
    extrasCost: number;
    /** false = sin carrete/gramos cargados: no descuenta stock ni da costo. */
    hasStock: boolean;
  }>;
};

export function saleCatalogItem(
  p: ProductForSale,
  filaments: SaleFilamentRef[],
  hexByColor: Map<string, string>,
): SaleCatalogItem {
  return {
    id: p.id,
    name: p.name,
    categoryName: p.categoryName,
    price: p.price,
    colorMode: p.colorMode,
    colors:
      p.colorMode === "single"
        ? p.colors.map((name) => ({
            name,
            hex: hexByColor.get(name.trim().toLowerCase()) ?? null,
          }))
        : [],
    variants: p.variants.map((v) => v.label),
    options: saleCombos(p).map((combo) => {
      const b = buildSaleLine(p, filaments, combo.variantLabel, combo.color);
      return {
        variantLabel: combo.variantLabel,
        color: combo.color,
        unitPrice: b.unitPrice,
        weightGrams: b.weight,
        extrasCost: b.extrasCost,
        hasStock: b.hasStock,
      };
    }),
  };
}

/** Sin tildes y en minúsculas: "Dragón" ≈ "dragon" al buscar. */
export function normalizeSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

// ---------------------------------------------------------------------------
// Entrada de la API: lo que manda la app al cargar una venta
// ---------------------------------------------------------------------------

const saleLineApiSchema = z.object({
  /** Producto del catálogo; sin él, la línea es de texto libre. */
  productId: z.uuid().nullish(),
  /** Nombre de la línea de texto libre (con producto de catálogo se ignora). */
  productName: z.string().trim().max(160).nullish(),
  variantLabel: z.string().trim().max(120).nullish(),
  color: z.string().trim().max(80).nullish(),
  quantity: z.number().int().min(1).max(9999),
  /** Precio unitario. Con producto de catálogo, si falta se usa el de la tienda. */
  unitPrice: z.number().min(0).max(100_000_000).nullish(),
  /**
   * Costo por unidad de las líneas SIN carrete/gramos (texto libre o producto
   * sin carrete cargado). Con stock calculable se ignora: ahí el costo sale del
   * filamento. 0 es válido (venta sin costo), pero hay que decirlo: no se
   * asume en silencio.
   */
  unitCost: z.number().min(0).max(100_000_000).nullish(),
});

const saleExtraApiSchema = z.object({
  name: z.string().trim().max(80).optional(),
  cost: z.number().min(0).max(100_000_000),
  qty: z.number().int().min(1).max(999),
});

export const manualSaleApiSchema = z.object({
  saleDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí la fecha.")
    .refine(
      (v) => !Number.isNaN(Date.parse(`${v}T12:00:00Z`)),
      "Fecha inválida.",
    ),
  customerName: z
    .string()
    .trim()
    .min(1, "Ingresá el nombre del cliente.")
    .max(120),
  detail: z.string().trim().max(300).nullish(),
  category: z.string().trim().max(80).nullish(),
  paymentMethod: z.enum(["transfer", "mercadopago", "cash"]),
  status: orderStatusSchema,
  items: z
    .array(saleLineApiSchema)
    .min(1, "Agregá al menos un producto.")
    .max(100, "Demasiados productos en una sola venta."),
  /** Insumos cargados a mano: se COBRAN (suman al total) y suman al costo. */
  extras: z.array(saleExtraApiSchema).max(20).optional(),
});

export type ManualSaleApiInput = z.infer<typeof manualSaleApiSchema>;

/** Detalle automático cuando no se escribió uno (lo que muestra el tablero). */
export function defaultSaleDetail(
  names: Array<{
    name: string;
    variantLabel?: string | null;
    color?: string | null;
  }>,
): string {
  if (names.length === 1) {
    const [l] = names;
    return [l!.name, l!.variantLabel, l!.color]
      .filter((x): x is string => !!x)
      .join(" · ")
      .slice(0, 300);
  }
  return [...new Set(names.map((n) => n.name))].join(" + ").slice(0, 300);
}

export type BuildSaleResult =
  | {
      ok: true;
      /** Candidato para `manualSaleSchema.safeParse` (la validación de la web). */
      candidate: Record<string, unknown>;
      /**
       * Costo explícito de las líneas sin stock calculable. `undefined` cuando
       * todas tienen carrete: el costo sale 100% del filamento, como en la web.
       */
      manualCost: number | undefined;
    }
  | { ok: false; message: string };

/**
 * Traduce lo que eligió la app a la entrada de la venta manual de la web.
 * Resuelve cada producto contra el catálogo y devuelve un mensaje en
 * castellano si algo no cierra (producto borrado, falta el costo, etc.).
 */
export function buildManualSaleInput(
  body: ManualSaleApiInput,
  ctx: { products: Map<string, ProductForSale>; filaments: SaleFilamentRef[] },
): BuildSaleResult {
  const items: Array<Record<string, unknown>> = [];
  const names: Array<{
    name: string;
    variantLabel: string | null;
    color: string | null;
  }> = [];
  let manualCost = 0;
  let needsManualCost = false;
  let catalogExtras = 0;
  let piecesTotal = 0;
  let units = 0;

  for (const line of body.items) {
    let name: string;
    let unitPrice: number;
    let hasStock = false;
    let printMinutes = 0;
    let colorLines: Array<{ filamentId: string; grams: number }> = [];
    const variantLabel = line.variantLabel || null;
    const color = line.color || null;

    if (line.productId) {
      const product = ctx.products.get(line.productId);
      if (!product) {
        return {
          ok: false,
          message: `El producto «${line.productName ?? "sin nombre"}» ya no está en el catálogo. Sacalo de la venta o cargalo como texto libre.`,
        };
      }
      if (
        variantLabel &&
        !product.variants.some((v) => v.label === variantLabel)
      ) {
        return {
          ok: false,
          message: `«${product.name}» ya no tiene la opción «${variantLabel}». Volvé a elegirla.`,
        };
      }
      const built = buildSaleLine(product, ctx.filaments, variantLabel, color);
      name = product.name;
      unitPrice = line.unitPrice ?? built.unitPrice;
      hasStock = built.hasStock;
      if (hasStock) {
        printMinutes = built.printMinutes;
        colorLines = built.colorLines;
      }
      // El insumo del catálogo va SOLO al costo: el precio de la tienda ya lo
      // incluye y cobrarlo de nuevo sería duplicarlo.
      catalogExtras += built.extrasCost * line.quantity;
    } else {
      name = (line.productName ?? "").trim();
      if (!name)
        return { ok: false, message: "Poné el nombre de cada producto." };
      if (line.unitPrice == null) {
        return { ok: false, message: `Poné el precio de «${name}».` };
      }
      unitPrice = line.unitPrice;
    }

    if (!hasStock) {
      // Sin carrete/gramos no hay cómo calcular el costo: se pide explícito
      // (regla de la web: "nunca 0 silencioso").
      if (line.unitCost == null) {
        return {
          ok: false,
          message: `Cargá el costo de «${name}» (no tiene carrete ni gramos para calcularlo). Si no tuvo costo, poné 0.`,
        };
      }
      needsManualCost = true;
      manualCost += line.unitCost * line.quantity;
    }

    piecesTotal += round2(unitPrice * line.quantity);
    units += line.quantity;
    names.push({ name, variantLabel, color });
    items.push({
      productId: line.productId ?? undefined,
      productName: name,
      printMinutes,
      variantLabel,
      color,
      quantity: line.quantity,
      unitPrice,
      colorLines: colorLines.length > 0 ? colorLines : undefined,
    });
  }

  // Insumos cargados a mano: se cobran (el total los suma) y suman al costo.
  const chargedExtras = round2(
    (body.extras ?? []).reduce((a, e) => a + e.cost * e.qty, 0),
  );

  return {
    ok: true,
    manualCost: needsManualCost ? round2(manualCost) : undefined,
    candidate: {
      saleDate: body.saleDate,
      customerName: body.customerName,
      detail: body.detail || defaultSaleDetail(names),
      category: body.category || undefined,
      quantity: units,
      // El servidor lo recalcula desde las líneas (applyManualSaleLines); acá va
      // solo para pasar la validación.
      total: round2(piecesTotal + chargedExtras),
      extrasCost: round2(chargedExtras + catalogExtras),
      chargedExtras,
      paymentMethod: body.paymentMethod,
      status: body.status,
      items,
    },
  };
}
