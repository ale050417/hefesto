import { z } from "zod";
import { orderStatusSchema } from "./schemas";

/**
 * Importación masiva de ventas manuales desde Excel/CSV (admin).
 * Módulo PURO (sin server ni DB): mapeo de columnas, normalización de valores
 * argentinos (fechas dd/mm/aaaa, números "1.234,56") y validación por fila.
 * Lo usa la UI (preview en vivo) y la Server Action (revalidación en server).
 * Toca dinero → tests en import-sales.test.ts (Cap. 15).
 */

export type ImportFieldKey =
  | "saleDate"
  | "customerName"
  | "detail"
  | "quantity"
  | "total"
  | "paymentMethod"
  | "status"
  | "material"
  | "grams"
  | "printMinutes"
  | "unitCost";

export type ImportField = {
  key: ImportFieldKey;
  label: string;
  required: boolean;
  aliases: string[];
};

export const IMPORT_FIELDS: ImportField[] = [
  {
    key: "saleDate",
    label: "Fecha",
    required: true,
    aliases: ["fecha", "dia", "date", "fecha venta"],
  },
  {
    key: "customerName",
    label: "Cliente",
    required: true,
    aliases: ["cliente", "nombre", "comprador", "customer"],
  },
  {
    key: "total",
    label: "Total cobrado",
    required: true,
    aliases: ["total", "importe", "monto", "precio total", "precio"],
  },
  {
    key: "quantity",
    label: "Cantidad",
    required: false,
    aliases: ["cantidad", "unidades", "cant", "qty"],
  },
  {
    key: "detail",
    label: "Detalle / producto",
    required: false,
    aliases: ["detalle", "producto", "descripcion", "concepto", "item"],
  },
  {
    key: "paymentMethod",
    label: "Método de pago",
    required: false,
    aliases: ["pago", "metodo", "metodo de pago", "forma de pago"],
  },
  {
    key: "status",
    label: "Estado",
    required: false,
    aliases: ["estado", "status"],
  },
  {
    key: "material",
    label: "Material",
    required: false,
    aliases: ["material", "filamento"],
  },
  {
    key: "grams",
    label: "Gramos (por pieza)",
    required: false,
    aliases: ["gramos", "peso", "grs", "g"],
  },
  {
    key: "printMinutes",
    label: "Minutos de impresión",
    required: false,
    aliases: ["minutos", "tiempo", "min", "minutos impresion"],
  },
  {
    key: "unitCost",
    label: "Costo unitario",
    required: false,
    aliases: ["costo", "costo unitario", "amortizacion", "amortización"],
  },
];

/** Normaliza un encabezado para comparar: minúsculas, sin acentos ni extras. */
function normHeader(h: unknown): string {
  return String(h ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Adivina el mapeo campo → índice de columna a partir de los encabezados. */
export function guessMapping(
  headers: unknown[],
): Record<ImportFieldKey, number> {
  const normed = headers.map(normHeader);
  const out = {} as Record<ImportFieldKey, number>;
  for (const field of IMPORT_FIELDS) {
    let idx = -1;
    for (const alias of field.aliases) {
      const exact = normed.indexOf(alias);
      if (exact !== -1) {
        idx = exact;
        break;
      }
    }
    if (idx === -1) {
      // Segunda pasada: el encabezado CONTIENE el alias (ej. "total $").
      for (const alias of field.aliases) {
        const partial = normed.findIndex(
          (h) => h.length > 0 && h.includes(alias),
        );
        if (partial !== -1) {
          idx = partial;
          break;
        }
      }
    }
    out[field.key] = idx;
  }
  return out;
}

/**
 * Fecha → "YYYY-MM-DD". Acepta: Date (xlsx con cellDates), número serial de
 * Excel, "dd/mm/aaaa", "dd-mm-aaaa", "aaaa-mm-dd". Null si no se entiende.
 */
export function normalizeDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number" && Number.isFinite(v) && v > 20000 && v < 80000) {
    // Serial de Excel (días desde 1900; 25569 = 1970-01-01).
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
  if (m) {
    const year = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    const month = Number(m[2]);
    const day = Number(m[1]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

/** Número en formato AR/planilla: "$ 1.234,56" → 1234.56. Null si no parsea. */
export function normalizeNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[$\s]/g, "");
  if (!s) return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // "1.234,56": puntos = miles, coma = decimal.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const PAYMENT_ALIASES: Record<string, "transfer" | "mercadopago" | "cash"> = {
  transferencia: "transfer",
  transf: "transfer",
  transfer: "transfer",
  banco: "transfer",
  mercadopago: "mercadopago",
  "mercado pago": "mercadopago",
  mp: "mercadopago",
  efectivo: "cash",
  cash: "cash",
  contado: "cash",
};

/** Método de pago con alias en español. Vacío → efectivo. */
export function normalizePayment(
  v: unknown,
): "transfer" | "mercadopago" | "cash" | null {
  if (String(v ?? "").trim() === "") return "cash"; // vacío = efectivo
  const s = normHeader(v);
  return PAYMENT_ALIASES[s] ?? null;
}

const STATUS_ALIASES: Record<string, z.infer<typeof orderStatusSchema>> = {
  "pendiente de pago": "pending_payment",
  pendiente: "pending_payment",
  confirmado: "confirmed",
  confirmada: "confirmed",
  "en produccion": "in_production",
  produccion: "in_production",
  listo: "ready",
  lista: "ready",
  enviado: "shipped",
  enviada: "shipped",
  entregado: "delivered",
  entregada: "delivered",
  cancelado: "cancelled",
  cancelada: "cancelled",
  reembolsado: "refunded",
  reembolsada: "refunded",
};

/** Estado con alias en español. Vacío → entregado (venta histórica típica). */
export function normalizeStatus(
  v: unknown,
): z.infer<typeof orderStatusSchema> | null {
  if (String(v ?? "").trim() === "") return "delivered"; // vacío = entregado
  const direct = orderStatusSchema.safeParse(String(v).trim());
  if (direct.success) return direct.data;
  return STATUS_ALIASES[normHeader(v)] ?? null;
}

/** Fila ya normalizada, lista para validar/importar. */
export const importRowSchema = z.object({
  saleDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (usá dd/mm/aaaa)."),
  customerName: z
    .string()
    .trim()
    .min(1, "Falta el nombre del cliente.")
    .max(120, "Cliente: máximo 120 caracteres."),
  detail: z.string().trim().max(300).optional(),
  quantity: z
    .number()
    .int("La cantidad debe ser un entero.")
    .min(1, "La cantidad mínima es 1.")
    .max(9999),
  total: z.number().positive("El total debe ser mayor a 0."),
  paymentMethod: z.enum(["transfer", "mercadopago", "cash"]),
  status: orderStatusSchema,
  material: z.string().trim().max(60).optional(),
  grams: z.number().min(0).optional(),
  printMinutes: z.number().min(0).optional(),
  unitCost: z.number().min(0).optional(),
});

export type ImportRow = z.infer<typeof importRowSchema>;

export type RowResult =
  | { ok: true; data: ImportRow }
  | { ok: false; errors: string[] };

/**
 * Convierte una fila cruda de la planilla (array de celdas) en una fila
 * normalizada + validada. `mapping` = campo → índice de columna (-1 = no está).
 */
export function parseImportRow(
  cells: unknown[],
  mapping: Record<ImportFieldKey, number>,
): RowResult {
  const cell = (k: ImportFieldKey) =>
    mapping[k] >= 0 ? cells[mapping[k]] : undefined;
  const errors: string[] = [];

  const saleDate = normalizeDate(cell("saleDate"));
  if (!saleDate) errors.push("Fecha inválida o vacía (usá dd/mm/aaaa).");

  const total = normalizeNumber(cell("total"));
  if (total == null) errors.push("Total inválido o vacío.");

  const rawQty = cell("quantity");
  const quantity =
    rawQty == null || rawQty === "" ? 1 : normalizeNumber(rawQty);
  if (quantity == null) errors.push("Cantidad inválida.");

  const paymentMethod = normalizePayment(cell("paymentMethod"));
  if (!paymentMethod)
    errors.push(
      `Método de pago desconocido: "${String(cell("paymentMethod"))}" (usá efectivo, transferencia o mercadopago).`,
    );

  const status = normalizeStatus(cell("status"));
  if (!status) errors.push(`Estado desconocido: "${String(cell("status"))}".`);

  const grams = normalizeNumber(cell("grams")) ?? undefined;
  const printMinutes = normalizeNumber(cell("printMinutes")) ?? undefined;
  const unitCost = normalizeNumber(cell("unitCost")) ?? undefined;
  const material = cell("material")
    ? String(cell("material")).trim()
    : undefined;

  // Regla de dominio: el costo NUNCA es 0 silencioso. O hay datos para
  // calcularlo (gramos + material) o viene el costo unitario en la planilla.
  const canCompute = (grams ?? 0) > 0 && !!material;
  const hasExplicitCost = (unitCost ?? 0) > 0;
  if (!canCompute && !hasExplicitCost) {
    errors.push(
      "Falta el costo: completá gramos + material, o la columna costo unitario.",
    );
  }

  if (errors.length > 0) return { ok: false, errors };

  const candidate = {
    saleDate: saleDate!,
    customerName: String(cell("customerName") ?? "").trim(),
    detail: cell("detail") ? String(cell("detail")).trim() : undefined,
    quantity: Math.floor(quantity!),
    total: total!,
    paymentMethod: paymentMethod!,
    status: status!,
    material,
    grams,
    printMinutes,
    unitCost,
  };
  const parsed = importRowSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => i.message),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Filas de ejemplo para la plantilla descargable (.xlsx / .csv). */
export function buildTemplateRows(): (string | number)[][] {
  return [
    [
      "Fecha",
      "Cliente",
      "Detalle",
      "Cantidad",
      "Total",
      "Pago",
      "Estado",
      "Material",
      "Gramos",
      "Minutos",
      "Costo unitario",
    ],
    [
      "15/06/2026",
      "Juan Pérez",
      "Maceta hexagonal",
      2,
      18000,
      "efectivo",
      "entregado",
      "PLA",
      120,
      180,
      "",
    ],
    [
      "20/06/2026",
      "María López",
      "Lámpara luna",
      1,
      25000,
      "mercadopago",
      "entregado",
      "",
      "",
      "",
      6500,
    ],
  ];
}

/** Tope de filas por importación (protege al server y al pooler). */
export const IMPORT_MAX_ROWS = 500;
