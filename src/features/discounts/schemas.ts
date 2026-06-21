import { z } from "zod";

const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);

export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Ingresá un código.")
    .transform((v) => v.toUpperCase()),
  type: z.enum(["percentage", "fixed"]),
  value: z.coerce.number().positive("El valor debe ser mayor a 0."),
  minPurchase: z.coerce.number().min(0).optional(),
  maxUses: z.preprocess(
    emptyToUndef,
    z.coerce.number().int().positive().optional(),
  ),
  startsAt: z.preprocess(emptyToUndef, z.string().optional()),
  expiresAt: z.preprocess(emptyToUndef, z.string().optional()),
  isActive: z.boolean().optional(),
});

export type CouponInput = z.infer<typeof couponSchema>;
