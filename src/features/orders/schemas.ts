import { z } from "zod";

// Los 8 estados del pedido (mismo enum que la DB). Compartido: venta manual al
// crear/editar y validación de transiciones. Fuente única para no desincronizar.
export const orderStatusSchema = z.enum([
  "pending_payment",
  "confirmed",
  "in_production",
  "ready",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

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
  // Cantidad de unidades (fix auditoría 2026-07: 80 unidades = un registro).
  // El total es de TODA la venta; la amortización se multiplica en el servidor.
  quantity: z.coerce
    .number()
    .int("La cantidad debe ser un número entero.")
    .min(1, "La cantidad mínima es 1.")
    .max(9999)
    .default(1),
  total: z.coerce.number().positive("Ingresá el total cobrado."),
  // Datos para calcular la amortización (costo) en el servidor. `filamentId`
  // identifica el filamento exacto (dos PLA pueden costar distinto);
  // `material` queda como fallback para cargas viejas.
  filamentId: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.uuid().optional(),
  ),
  material: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().trim().max(60).optional(),
  ),
  grams: z.coerce.number().min(0).optional(),
  printMinutes: z.coerce.number().min(0).optional(),
  // Multicolor: gramos por color/carrete. Se descuenta cada uno de su filamento;
  // si un color pide más de lo que hay, se registra igual y se avisa al panel.
  colorLines: z
    .array(z.object({ filamentId: z.uuid(), grams: z.coerce.number().min(0) }))
    .optional(),
  // Insumos/agregados (argollas, vaso del chop, polímero, etc.): su costo TOTAL
  // (ya calculado en el cliente) suma al total cobrado y a la amortización.
  extrasCost: z.coerce.number().min(0).optional(),
  // Costos resueltos en el servidor (no se confía en el cliente).
  amortization: z.coerce.number().min(0).optional(),
  profit: z.coerce.number().optional(),
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
    .optional()
    // Regla de dinero → se valida en el SERVIDOR, no solo en la UI (Cap. 11/14).
    // Si viene un reparto, los % deben sumar 100 (tolerancia por decimales).
    .refine(
      (parts) => {
        if (!parts || parts.length === 0) return true;
        const sum = parts.reduce((acc, p) => acc + p.pct, 0);
        return Math.abs(sum - 100) < 0.01;
      },
      { message: "El reparto debe sumar 100%." },
    ),
  status: orderStatusSchema,
});

export type ManualSaleInput = z.infer<typeof manualSaleSchema>;

// Mensaje del chat del pedido (solo texto; el chat a medida, que sí acepta
// foto, tiene SU schema en features/custom). Antes orders importaba el schema
// de custom — cross-feature innecesario (Cap. 5). Auditoría 2026-07.
export const orderMessageSchema = z.object({
  body: z.string().trim().min(1, "Escribí un mensaje.").max(2000),
});

export type OrderMessageInput = z.infer<typeof orderMessageSchema>;
