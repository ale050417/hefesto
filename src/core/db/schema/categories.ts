import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  icon: text("icon"),
  color: text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
  // Subcategorías (1 nivel): null = categoría raíz. RESTRICT: no se borra un
  // padre con hijas. La regla "el padre debe ser raíz" vive en el servicio.
  parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
    onDelete: "restrict",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
