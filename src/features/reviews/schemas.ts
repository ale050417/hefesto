import { z } from "zod";

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Elegí una puntuación.").max(5),
  comment: z.string().trim().max(600).optional(),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
