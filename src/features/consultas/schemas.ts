import { z } from "zod";

/** Máximo de fotos de referencia por consulta. */
export const MAX_INQUIRY_IMAGES = 6;

export const INQUIRY_STATUSES = [
  "pending",
  "answered",
  "confirmed",
  "cancelled",
] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  pending: "Sin cotizar",
  // Con la cotización se crea el pedido en "pendiente de pago" (2026-11-25).
  answered: "Cotizada · espera seña",
  confirmed: "Confirmada",
  cancelled: "No se hizo",
};

export const PAYMENT_METHODS = ["transfer", "mercadopago", "cash"] as const;
export const PAYMENT_METHOD_LABEL: Record<
  (typeof PAYMENT_METHODS)[number],
  string
> = {
  transfer: "Transferencia",
  mercadopago: "MercadoPago",
  cash: "Efectivo",
};

/** Adjuntos que no son fotos (audios, PDF, video corto). */
export const MAX_INQUIRY_FILES = 8;
/** Vercel corta los pedidos de más de 4,5 MB: el tope real es este. */
export const MAX_INQUIRY_FILE_BYTES = 4 * 1024 * 1024;
export function isAllowedInquiryFile(type: string): boolean {
  return (
    type.startsWith("audio/") ||
    type.startsWith("video/") ||
    type === "application/pdf"
  );
}

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null));

const optMoney = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.number().positive("El precio tiene que ser mayor a 0.").nullable(),
);

/** Número opcional ≥ 0 (gramos, minutos). */
const optAmount = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.number().min(0).max(1_000_000).nullable(),
);

/** Lo que carga atención al cliente. */
export const inquiryCreateSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(1, "Poné el nombre del cliente.")
    .max(120, "Máximo 120 caracteres."),
  customerPhone: optText(40),
  title: z
    .string()
    .trim()
    .min(3, "Poné qué pide el cliente.")
    .max(160, "Máximo 160 caracteres."),
  description: z
    .string()
    .trim()
    .max(4000, "Máximo 4000 caracteres.")
    .default(""),
  quantity: z.coerce
    .number()
    .int("La cantidad debe ser un número entero.")
    .min(1, "La cantidad mínima es 1.")
    .max(9999)
    .default(1),
});
export type InquiryCreateInput = z.infer<typeof inquiryCreateSchema>;

/** Lo que responde el operador. */
export const inquiryAnswerSchema = z
  .object({
    unitPrice: z.coerce
      .number("Poné el precio por unidad.")
      .positive("Poné el precio por unidad."),
    /**
     * Costo del pedido. Lo normal es que venga de la CALCULADORA (filamento +
     * gramos + minutos por unidad): el operador no ve el costo ni el margen.
     * `unitCost` queda para quien lo carga a mano (la app, o el dueño).
     */
    unitCost: optMoney,
    filamentId: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.uuid().nullable(),
    ),
    material: optText(60),
    grams: optAmount,
    printMinutes: optAmount,
    bulkPrice: optMoney,
    bulkFrom: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.coerce.number().int().min(2, "Mínimo 2 unidades.").max(9999).nullable(),
    ),
    dimensions: optText(300),
    colors: optText(300),
    deliveryTime: optText(120),
    note: optText(1000),
    /** Mensaje final. Vacío = se arma solo con los datos de arriba. */
    message: optText(6000),
  })
  .refine(
    (v) =>
      v.unitCost != null ||
      ((v.filamentId != null || v.material != null) &&
        ((v.grams ?? 0) > 0 || (v.printMinutes ?? 0) > 0)),
    {
      path: ["calc"],
      message:
        "Calculá el precio con la calculadora: así queda guardado el costo del pedido.",
    },
  )
  .refine((v) => (v.bulkPrice == null) === (v.bulkFrom == null), {
    path: ["bulkFrom"],
    message: "Para el precio por cantidad poné el precio y desde cuántas.",
  });
export type InquiryAnswerInput = z.infer<typeof inquiryAnswerSchema>;

/** Cambios de estado que hace atención al cliente. */
export const inquiryStatusSchema = z.object({
  to: z.enum(["confirmed", "cancelled", "reopen"]),
  /** Cómo paga el cliente: hace falta para crear el pedido al confirmar. */
  paymentMethod: z.enum(PAYMENT_METHODS).default("transfer"),
});
export type InquiryStatusChange = z.infer<typeof inquiryStatusSchema>["to"];
export type InquiryPaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Chat de la consulta: largo máximo de un mensaje. */
export const MAX_CHAT_BODY = 2000;

export const chatMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .max(MAX_CHAT_BODY, `Máximo ${MAX_CHAT_BODY} caracteres.`)
    .default(""),
});
