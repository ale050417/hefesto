import { z } from "zod";

/**
 * Validación de entrada de las actions de producción (Cap. 5/8: la validación
 * SIEMPRE en el servidor con Zod). Los estados se validan contra los mismos
 * valores que los enums de la base (printer_status / print_job_status).
 */

export const printerStatusSchema = z.enum([
  "idle",
  "printing",
  "maintenance",
  "offline",
]);

export const jobStatusSchema = z.enum(["queued", "printing", "done", "failed"]);

export const idSchema = z.string().uuid("Identificador inválido.");

export const addPrinterSchema = z.object({
  name: z.string().trim().min(2, "Nombre inválido.").max(80),
  model: z.string().trim().max(120).optional().default(""),
});

export const addJobSchema = z.object({
  title: z.string().trim().min(2, "Título inválido.").max(120),
  // Vacío = sin impresora asignada; si viene, debe ser un uuid.
  printerId: z
    .union([z.string().uuid(), z.literal("")])
    .optional()
    .default(""),
});

export type AddPrinterInput = z.infer<typeof addPrinterSchema>;
export type AddJobInput = z.infer<typeof addJobSchema>;
