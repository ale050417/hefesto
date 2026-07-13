import { z } from "zod";

// Presupuesto orientativo del cliente: número positivo opcional.
// Acepta "" o null (campo vacío) y lo trata como ausente.
const optionalBudget = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.number().positive("El presupuesto debe ser mayor a 0.").optional(),
);

export const customRequestSchema = z.object({
  title: z.string().trim().min(3, "Ingresá un título."),
  description: z.string().trim().min(10, "Contanos un poco más (mín. 10)."),
  referenceImageUrl: z.string().trim().url().optional().or(z.literal("")),
  budget: optionalBudget,
});

export const messageSchema = z
  .object({
    body: z.string().trim().max(2000).optional().default(""),
    imageUrl: z.string().trim().url().optional().or(z.literal("")),
  })
  .refine((d) => (d.body && d.body.length > 0) || !!d.imageUrl, {
    message: "Escribí un mensaje o adjuntá una foto.",
    path: ["body"],
  });

export const quoteSchema = z.object({
  amount: z.coerce.number().positive("El monto debe ser mayor a 0."),
});

// Pedido a medida de INVITADO (sin login): suma datos de contacto.
export const guestCustomRequestSchema = z.object({
  name: z.string().trim().min(2, "Ingresá tu nombre."),
  phone: z.string().trim().min(6, "Ingresá tu WhatsApp."),
  email: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().email("Email inválido.").optional(),
  ),
  description: z
    .string()
    .trim()
    .min(10, "Contanos un poco más (mínimo 10 caracteres)."),
  budget: optionalBudget,
  referenceImageUrl: z.string().trim().url().optional().or(z.literal("")),
});
export type GuestCustomRequestInput = z.infer<typeof guestCustomRequestSchema>;

export type CustomRequestInput = z.infer<typeof customRequestSchema>;
