import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Catálogo de colores y marcas de filamento (0042). El admin los elige de un
// selector al cargar un filamento y puede dar de alta nuevos. `kind` distingue
// color/marca; los colores guardan su tono (hex) para el punto de color.
export const filamentCatalog = pgTable(
  "filament_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    hex: text("hex"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("filament_catalog_kind_valid", sql`${t.kind} in ('color','brand')`),
    unique("filament_catalog_unique").on(t.kind, t.name),
  ],
);
