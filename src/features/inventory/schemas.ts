import { z } from "zod";

export const filamentSchema = z.object({
  material: z.string().trim().min(1, "Ingresá el material."),
  color: z.string().trim().min(1, "Ingresá el color."),
  brand: z.string().trim().min(1, "Ingresá la marca."),
  diameter: z.string().trim().min(1, "Ingresá el diámetro."),
  stockGrams: z.coerce.number().min(0, "El stock no puede ser negativo."),
  spoolGrams: z.coerce
    .number()
    .positive("El tamaño del carrete debe ser mayor a 0."),
  costPerKg: z.coerce.number().min(0, "El costo no puede ser negativo."),
  alertThresholdGrams: z.coerce
    .number()
    .min(0, "El umbral no puede ser negativo."),
  // Tipo de filamento (0084): con tipo, el costo/kg es el del tipo (lo pone el
  // servidor). null = sin tipo, precio propio. Sin el campo = no se toca (las
  // versiones viejas de la app no lo mandan).
  typeId: z.uuid().nullable().optional(),
});

// Tipo de filamento con su precio por kg.
export const filamentTypeSchema = z.object({
  name: z.string().trim().min(1, "Ingresá el nombre del tipo.").max(60),
  costPerKg: z.coerce.number().min(0, "El precio no puede ser negativo."),
});

// Modelo de carrete con su peso vacío.
export const spoolModelSchema = z.object({
  name: z.string().trim().min(1, "Ingresá el nombre del carrete.").max(60),
  emptyGrams: z.coerce
    .number()
    .min(0, "El peso no puede ser negativo.")
    .max(5000, "Revisá el peso del carrete vacío."),
});

// "Calcular filamento": peso total del carrete en uso y su modelo.
export const weighSchema = z.object({
  spoolModelId: z.uuid("Elegí el modelo de carrete."),
  totalGrams: z.coerce.number().positive("Ingresá cuánto pesa el carrete."),
  sealedSpools: z.coerce.number().int().min(0).max(100).optional(),
});

export const failureSchema = z.object({
  pieceName: z.string().trim().min(1, "Ingresá la pieza."),
  material: z.string().trim().min(1, "Ingresá el material."),
  color: z.string().trim().min(1, "Ingresá el color."),
  gramsLost: z.coerce.number().positive("Los gramos deben ser mayores a 0."),
  reason: z.string().trim().min(1, "Ingresá la causa."),
  notes: z.string().trim().max(500).optional(),
  deducted: z.boolean().optional(),
  // Falla multicolor: gramos perdidos por carrete. Cada línea descuenta su
  // filamento (mismo patrón que la venta manual). Si viene, manda el descuento.
  colorLines: z
    .array(
      z.object({
        filamentId: z.uuid(),
        grams: z.coerce.number().positive(),
      }),
    )
    .optional(),
});

export const colorSchema = z.object({
  name: z.string().trim().min(1, "Ingresá el nombre del color.").max(40),
  hex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Elegí un color válido.")
    .optional(),
});

export const brandSchema = z.object({
  name: z.string().trim().min(1, "Ingresá el nombre de la marca.").max(40),
});

// Edición de los datos del carrete desde la app (2026-10-31): SIN stock. El
// stock se mueve solo por el ajuste (queda en el ledger con su historial).
export const filamentDetailsSchema = filamentSchema.omit({ stockGrams: true });

// Ajuste manual de stock (app, 2026-10-31): o se suma/resta una cantidad
// (`deltaGrams`, con signo) o se fija el stock contado (`newStockGrams`).
// Exactamente uno de los dos. `reason` es el motivo (queda en auditoría).
export const stockAdjustSchema = z
  .object({
    deltaGrams: z.number().optional(),
    newStockGrams: z
      .number()
      .min(0, "El stock no puede ser negativo.")
      .optional(),
    reason: z.string().trim().max(200).optional(),
  })
  .refine(
    (v) => (v.deltaGrams === undefined) !== (v.newStockGrams === undefined),
    { message: "Indicá cuántos gramos sumar o restar, o el stock contado." },
  );

// Alta/baja de un color, marca o material del catálogo (selectores del form).
export const catalogKindSchema = z.enum(["color", "brand", "material"]);
export const catalogItemSchema = z.object({
  kind: catalogKindSchema,
  name: z.string().trim().min(1, "Ingresá el nombre.").max(40),
  hex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Elegí un color válido.")
    .optional(),
});

export type FilamentInput = z.infer<typeof filamentSchema>;
export type FilamentTypeInput = z.infer<typeof filamentTypeSchema>;
export type SpoolModelInput = z.infer<typeof spoolModelSchema>;
export type WeighInput = z.infer<typeof weighSchema>;
export type FilamentDetailsInput = z.infer<typeof filamentDetailsSchema>;
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;
export type ColorInput = z.infer<typeof colorSchema>;
export type BrandInput = z.infer<typeof brandSchema>;
export type FailureInput = z.infer<typeof failureSchema>;
