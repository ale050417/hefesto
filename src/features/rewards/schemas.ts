import { z } from "zod";

const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);

export const rewardSchema = z.object({
  type: z.enum(["shipping", "discount", "product"]),
  title: z.string().trim().min(2, "Ingresá un título."),
  description: z.preprocess(
    emptyToUndef,
    z.string().trim().max(200).optional(),
  ),
  costPoints: z.coerce
    .number()
    .int()
    .positive("El costo en puntos debe ser mayor a 0."),
  discountValue: z.preprocess(
    emptyToUndef,
    z.coerce.number().positive().optional(),
  ),
  discountIsPercent: z.boolean().optional(),
  productId: z.preprocess(emptyToUndef, z.string().uuid().optional()),
  isActive: z.boolean().optional(),
});

export type RewardInput = z.infer<typeof rewardSchema>;
