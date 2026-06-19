import { z } from "zod";

// Dirección de envío: snapshot que se guarda con el pedido (jsonb).
export const shippingAddressSchema = z.object({
  fullName: z.string().min(2, "Ingresá tu nombre y apellido."),
  phone: z.string().min(6, "Ingresá un teléfono de contacto."),
  street: z.string().min(3, "Ingresá la dirección."),
  city: z.string().min(2, "Ingresá la localidad."),
  province: z.string().min(2, "Ingresá la provincia."),
  postalCode: z.string().min(3, "Ingresá el código postal."),
  notes: z.string().max(500).optional(),
});

// Una línea del carrito: SOLO datos confiables. El precio NO viaja desde el
// cliente; el servidor lo recalcula desde la base (Cap. 13).
export const checkoutLineSchema = z.object({
  productId: z.uuid(),
  slug: z.string().min(1),
  variantId: z.uuid().nullable(),
  quantity: z.number().int().min(1).max(99),
});

export const checkoutSchema = z.object({
  items: z.array(checkoutLineSchema).min(1, "El carrito está vacío."),
  paymentMethod: z.enum(["transfer", "mercadopago", "cash"]),
  shippingAddress: shippingAddressSchema,
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CheckoutLine = z.infer<typeof checkoutLineSchema>;
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;
