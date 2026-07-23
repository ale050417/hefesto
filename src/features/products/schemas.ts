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
  q: z.string().trim().min(1).max(80).optional(), // búsqueda por nombre
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
// la del servidor (Cap. 11/14). `preprocess` convierte los "" del formulario
// en null para los campos opcionales.
const emptyToNull = (v: unknown) => (v === "" ? null : v);

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
    description: z
      .preprocess(emptyToNull, z.string().max(2000).nullable())
      .optional(),
    categoryId: z.uuid("Elegí una categoría"),
    price: z.coerce.number().positive("El precio debe ser mayor a 0"),
    salePrice: z
      .preprocess(emptyToNull, z.coerce.number().positive().nullable())
      .optional(),
    material: z
      .preprocess(emptyToNull, z.string().max(60).nullable())
      .optional(),
    printTimeMinutes: z
      .preprocess(emptyToNull, z.coerce.number().int().nonnegative().nullable())
      .optional(),
    weightGrams: z
      .preprocess(emptyToNull, z.coerce.number().int().nonnegative().nullable())
      .optional(),
    dimensions: z
      .preprocess(emptyToNull, z.string().max(120).nullable())
      .optional(),
    colorMode: z.enum(["single", "multi"]).default("single"),
    colors: z.array(z.string().max(40)).max(24).default([]),
    colorPrices: z.record(z.string(), z.coerce.number()).default({}),
    layerHeight: z
      .preprocess(emptyToNull, z.string().max(60).nullable())
      .optional(),
    infillPercent: z
      .preprocess(
        emptyToNull,
        z.coerce.number().int().min(0).max(100).nullable(),
      )
      .optional(),
    productionTime: z
      .preprocess(emptyToNull, z.string().max(120).nullable())
      .optional(),
    // Costos (los completa el servidor con la calculadora, no el cliente).
    amortization: z
      .preprocess(emptyToNull, z.coerce.number().nonnegative().nullable())
      .optional(),
    profit: z.preprocess(emptyToNull, z.coerce.number().nullable()).optional(),
    // Costo de insumos del producto (va aparte del precio; baja la ganancia).
    extrasCost: z
      .preprocess(emptyToNull, z.coerce.number().nonnegative().nullable())
      .optional(),
    // Estado elegible al CREAR (borrador/publicado). En edición se maneja aparte.
    status: z.enum(["draft", "published", "archived"]).optional(),
    isFeatured: z.boolean().default(false),
    isNew: z.boolean().default(false),
    // Variantes por TAMAÑO, cada una con su precio (opcional; vacío = precio
    // base). Se guardan en product_variants; el checkout cobra el precio del
    // tamaño elegido. Los labels no se pueden repetir dentro del producto.
    variants: z
      .array(
        z.object({
          label: z.string().trim().min(1, "Poné el nombre del tamaño").max(60),
          price: z.preprocess(
            emptyToNull,
            z.coerce
              .number()
              .positive("El precio del tamaño debe ser mayor a 0")
              .nullable(),
          ),
          // Gramos por color de este tamaño (multicolor). Vacío = usa los del
          // producto. Se usa para descontar stock según el tamaño vendido.
          colorGrams: z
            .record(z.string().max(40), z.coerce.number().nonnegative())
            .default({}),
        }),
      )
      .max(20, "Demasiados tamaños")
      .default([])
      .refine(
        (arr) =>
          new Set(arr.map((v) => v.label.trim().toLowerCase())).size ===
          arr.length,
        { message: "Hay dos tamaños con el mismo nombre" },
      ),
  })
  .refine((d) => d.salePrice == null || d.salePrice < d.price, {
    message: "El precio de oferta debe ser menor al precio",
    path: ["salePrice"],
  });

export type ProductInput = z.infer<typeof productInputSchema>;

// Validación de alta/edición de categoría (admin).
export const categoryInputSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(80),
  // Subcategoría: id del padre o null (raíz). "" del form se normaliza a null.
  parentId: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.uuid("Categoría padre inválida").nullable(),
  ),
  slug: z
    .string()
    .min(1, "El slug es obligatorio")
    .max(100)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug inválido (minúsculas, números y guiones)",
    ),
  icon: z.preprocess(emptyToNull, z.string().max(40).nullable()).optional(),
  color: z
    .preprocess(
      emptyToNull,
      z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido (formato #RRGGBB)")
        .nullable(),
    )
    .optional(),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;
