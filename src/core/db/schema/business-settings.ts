import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Configuración de marca/tienda. Fila única (singleton: id siempre = 1).
// Arranca mínima (logo + imagen del hero); se amplía en fases altas.
export const businessSettings = pgTable(
  "business_settings",
  {
    id: integer("id").primaryKey().default(1),
    logoUrl: text("logo_url"),
    heroImageUrl: text("hero_image_url"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check("business_settings_singleton", sql`${t.id} = 1`)],
);
