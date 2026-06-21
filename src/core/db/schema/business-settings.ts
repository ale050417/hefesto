import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Configuración de marca/tienda. Fila única (singleton: id siempre = 1).
export const businessSettings = pgTable(
  "business_settings",
  {
    id: integer("id").primaryKey().default(1),
    logoUrl: text("logo_url"),
    heroImageUrl: text("hero_image_url"),
    // Datos del negocio (configuración completa)
    storeName: text("store_name"),
    description: text("description"),
    whatsapp: text("whatsapp"),
    contactEmail: text("contact_email"),
    addressText: text("address_text"),
    instagram: text("instagram"),
    facebook: text("facebook"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check("business_settings_singleton", sql`${t.id} = 1`)],
);
