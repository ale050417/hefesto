import { pgEnum } from "drizzle-orm/pg-core";

// Estado de publicación de un producto (Cap. 10).
export const productStatus = pgEnum("product_status", [
  "draft",
  "published",
  "archived",
]);

// Roles de usuario (Cap. 13). El rol inicial siempre es customer.
export const userRole = pgEnum("user_role", ["customer", "operator", "admin"]);
