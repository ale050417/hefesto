import { pgEnum } from "drizzle-orm/pg-core";

// Estado de publicación de un producto (Cap. 10).
export const productStatus = pgEnum("product_status", [
  "draft",
  "published",
  "archived",
]);
