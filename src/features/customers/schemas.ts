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
  // Fecha de nacimiento (opcional) para cupones de cumpleaños. "YYYY-MM-DD".
  birthDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
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

// Email opcional: acepta vacío (lo tratamos como ausente).
const optionalEmail = z
  .string()
  .trim()
  .email("El email no es válido.")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

const optionalNote = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

// Alta/edición de cliente manual (sin cuenta).
export const manualCustomerSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del cliente."),
  email: optionalEmail,
  phone: optional,
  city: optional,
  note: optionalNote,
});

// Nota interna (admin) sobre cualquier cliente.
export const adminNoteSchema = z.object({ note: optionalNote });

export type ProfileInput = z.infer<typeof profileSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type ManualCustomerInput = z.infer<typeof manualCustomerSchema>;
