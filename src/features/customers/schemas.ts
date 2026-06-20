import { z } from "zod";

const optional = z
  .string()
  .trim()
  .max(80)
  .optional()
  .transform((v) => (v ? v : undefined));

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresá tu nombre y apellido."),
  phone: optional,
});

export const addressSchema = z.object({
  label: optional,
  fullName: optional,
  phone: optional,
  street: z.string().trim().min(3, "Ingresá la dirección."),
  city: z.string().trim().min(2, "Ingresá la localidad."),
  province: z.string().trim().min(2, "Ingresá la provincia."),
  postalCode: z.string().trim().min(3, "Ingresá el código postal."),
  isDefault: z.boolean().optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
