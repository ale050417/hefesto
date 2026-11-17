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
  pending: "Sin responder",
  answered: "Respondida",
  confirmed: "Confirmada",
  cancelled: "No se hizo",
};

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
  .refine((v) => (v.bulkPrice == null) === (v.bulkFrom == null), {
    path: ["bulkFrom"],
    message: "Para el precio por cantidad poné el precio y desde cuántas.",
  });
export type InquiryAnswerInput = z.infer<typeof inquiryAnswerSchema>;

/** Cambios de estado que hace atención al cliente. */
export const inquiryStatusSchema = z.object({
  to: z.enum(["confirmed", "cancelled", "reopen"]),
});
export type InquiryStatusChange = z.infer<typeof inquiryStatusSchema>["to"];
