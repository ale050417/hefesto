import type {
  categories,
  productImages,
  productVariants,
  products,
} from "@/core/db/schema";

// Tipos inferidos del schema de Drizzle: fuente única de verdad.
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type ProductStatus = Product["status"];

// Producto con todo lo necesario para listarlo o mostrar su detalle.
export type ProductWithRelations = Product & {
  category: Category | null;
  images: ProductImage[];
  variants: ProductVariant[];
};
