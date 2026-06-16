import { z } from "zod";

// Orden disponible en el catálogo.
export const PRODUCT_SORTS = [
  "newest",
  "price_asc",
  "price_desc",
  "name",
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

// Los filtros llegan como query params (strings) y se validan en el servidor.
const boolFromString = z.enum(["true", "false"]).transform((v) => v === "true");

export const productFilterSchema = z.object({
  category: z.string().min(1).optional(), // slug de categoría
  material: z.string().min(1).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  isNew: boolFromString.optional(),
  onSale: boolFromString.optional(),
  sort: z.enum(PRODUCT_SORTS).default("newest"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(48).default(12),
});

export type ProductFilter = z.infer<typeof productFilterSchema>;
export type ProductFilterInput = z.input<typeof productFilterSchema>;

// Validación de alta/edición de producto (admin). La validación que cuenta es
// la del servidor (Cap. 11/14).
export const productInputSchema = z
  .object({
    name: z.string().min(1, "El nombre es obligatorio").max(120),
    slug: z
      .string()
      .min(1, "El slug es obligatorio")
      .max(140)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug inválido (minúsculas, números y guiones)",
      ),
    description: z.string().max(2000).nullish(),
    categoryId: z.uuid().nullish(),
    price: z.coerce.number().positive("El precio debe ser mayor a 0"),
    salePrice: z.coerce.number().positive().nullish(),
    material: z.string().max(60).nullish(),
    printTimeMinutes: z.coerce.number().int().nonnegative().nullish(),
    weightGrams: z.coerce.number().int().nonnegative().nullish(),
    dimensions: z.string().max(120).nullish(),
    isFeatured: z.boolean().default(false),
    isNew: z.boolean().default(false),
  })
  .refine((d) => d.salePrice == null || d.salePrice < d.price, {
    message: "El precio de oferta debe ser menor al precio",
    path: ["salePrice"],
  });

export type ProductInput = z.infer<typeof productInputSchema>;
