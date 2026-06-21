import { z } from "zod";

export const customRequestSchema = z.object({
  title: z.string().trim().min(3, "Ingresá un título."),
  description: z.string().trim().min(10, "Contanos un poco más (mín. 10)."),
  referenceImageUrl: z.string().trim().url().optional().or(z.literal("")),
});

export const messageSchema = z.object({
  body: z.string().trim().min(1, "Escribí un mensaje.").max(2000),
});

export const quoteSchema = z.object({
  amount: z.coerce.number().positive("El monto debe ser mayor a 0."),
});

export type CustomRequestInput = z.infer<typeof customRequestSchema>;
