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
