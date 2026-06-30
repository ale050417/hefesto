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
  color: z.string().max(60).nullable().optional(),
  quantity: z.number().int().min(1).max(99),
});

export const checkoutSchema = z.object({
  items: z.array(checkoutLineSchema).min(1, "El carrito está vacío."),
  paymentMethod: z.enum(["transfer", "mercadopago", "cash"]),
  shippingAddress: shippingAddressSchema,
  couponCode: z.string().trim().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CheckoutLine = z.infer<typeof checkoutLineSchema>;
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

// Venta manual / histórica (admin). Registro libre que NO usa el checkout:
// cliente por texto, total cargado a mano, estado a elección.
export const manualSaleSchema = z.object({
  saleDate: z.string().min(1, "Elegí la fecha."),
  customerName: z
    .string()
    .trim()
    .min(1, "Ingresá el nombre del cliente.")
    .max(120),
  detail: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().trim().max(300).optional(),
  ),
  total: z.coerce.number().positive("Ingresá el total cobrado."),
  paymentMethod: z.enum(["transfer", "mercadopago", "cash"]),
  // Reparto de la ganancia de esta venta: [{nombre, pct}]. Opcional; si no viene,
  // se divide por los socios actuales (lo resuelve el panel de ganancias).
  profitSplit: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        pct: z.coerce.number().min(0).max(100),
      }),
    )
    .optional(),
  status: z.enum([
    "pending_payment",
    "confirmed",
    "in_production",
    "ready",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
  ]),
});

export type ManualSaleInput = z.infer<typeof manualSaleSchema>;
