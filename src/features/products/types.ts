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

// --- DTOs de vista: datos ya calculados para la UI (Cap. 9) ---

export type ProductView = {
  id: string;
  name: string;
  slug: string;
  price: number;
  salePrice: number | null;
  effectivePrice: number;
  isOnSale: boolean;
  discountPercent: number | null;
  hasVariants: boolean; // si true, el precio se muestra como "desde"
  isNew: boolean;
  isFeatured: boolean;
  material: string | null;
  category: { name: string; slug: string } | null;
  primaryImage: { url: string; alt: string; position: string } | null;
};

export type ProductDetailView = ProductView & {
  description: string | null;
  printTimeMinutes: number | null;
  weightGrams: number | null;
  dimensions: string | null;
  colorMode: "single" | "multi";
  colors: string[];
  colorPrices: Record<string, number>;
  layerHeight: string | null;
  infillPercent: number | null;
  productionTime: string | null;
  images: { url: string; alt: string; position: string }[];
  variants: { id: string; label: string; price: number | null }[];
};

export type CatalogPage = {
  items: ProductView[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type HomeData = {
  featured: ProductView[];
  latest: ProductView[];
  onSale: ProductView[];
  categories: CategoryWithCount[];
};

export type NewProductImage = typeof productImages.$inferInsert;

export type AdminProductRow = {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  price: number;
  salePrice: number | null;
  material: string | null;
  isNew: boolean;
  categoryId: string | null;
  categoryName: string | null;
  primaryImage: string | null;
};

export type AdminProductPage = {
  items: AdminProductRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type NewCategory = typeof categories.$inferInsert;
export type CategoryWithCount = Category & { productCount: number };
