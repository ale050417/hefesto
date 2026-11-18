import { z } from "zod";

/** Largo máximo de un pendiente (igual al CHECK de la tabla). */
export const TASK_BODY_MAX = 500;

/** Cuántos "hechos" se muestran (los últimos que se tildaron). */
export const DONE_TASKS_SHOWN = 20;

/** Lo que anota cualquiera del equipo. */
export const taskCreateSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Escribí el pendiente.")
    .max(TASK_BODY_MAX, `Máximo ${TASK_BODY_MAX} caracteres.`),
});
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

/** Tildar / destildar. */
export const taskDoneSchema = z.object({ done: z.boolean() });
export type TaskDoneInput = z.infer<typeof taskDoneSchema>;
