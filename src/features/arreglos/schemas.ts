import { z } from "zod";

/** Máximo de fotos por arreglo. */
export const MAX_FIX_IMAGES = 6;

export const FIX_STATUSES = ["pending", "in_progress", "done"] as const;
export type FixStatus = (typeof FIX_STATUSES)[number];

export const FIX_STATUS_LABEL: Record<FixStatus, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  done: "Resuelto",
};

/** Lo que carga el operador. */
export const fixCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Poné un título corto (qué hay que arreglar).")
    .max(120, "Máximo 120 caracteres."),
  description: z
    .string()
    .trim()
    .min(5, "Explicá qué pasa y qué habría que cambiar.")
    .max(4000, "Máximo 4000 caracteres."),
  urgent: z.boolean().default(false),
});
export type FixCreateInput = z.infer<typeof fixCreateSchema>;

/** Lo que responde el dueño: estado + nota opcional. */
export const fixUpdateSchema = z.object({
  status: z.enum(FIX_STATUSES),
  ownerNote: z
    .string()
    .trim()
    .max(2000, "Máximo 2000 caracteres.")
    .nullish()
    .transform((v) => (v ? v : null)),
});
export type FixUpdateInput = z.infer<typeof fixUpdateSchema>;
