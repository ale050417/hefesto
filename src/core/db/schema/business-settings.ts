import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Configuración de marca/tienda. Fila única (singleton: id siempre = 1).
export const businessSettings = pgTable(
  "business_settings",
  {
    id: integer("id").primaryKey().default(1),
    logoUrl: text("logo_url"),
    heroImageUrl: text("hero_image_url"),
    // Datos del negocio (configuración completa)
    storeName: text("store_name"),
    slogan: text("slogan"),
    description: text("description"),
    whatsapp: text("whatsapp"),
    contactEmail: text("contact_email"),
    addressText: text("address_text"),
    instagram: text("instagram"),
    facebook: text("facebook"),
    // Apariencia: color de acento + temporada/campaña activa.
    accentColor: text("accent_color"),
    season: text("season").notNull().default("none"),
    seasonDeco: boolean("season_deco").notNull().default(false),
    seasonIntensity: integer("season_intensity").notNull().default(16),
    // Visibilidad de las secciones del home: { [sectionId]: boolean }.
    homeSections: jsonb("home_sections").$type<Record<string, boolean>>(),
    // Datos fiscales / operativos (pestaña Negocio).
    cuit: text("cuit"),
    hours:
      jsonb("hours").$type<
        Array<{ label: string; from: string; to: string; on: boolean }>
      >(),
    pickupEnabled: boolean("pickup_enabled").notNull().default(true),
    deliveryEnabled: boolean("delivery_enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check("business_settings_singleton", sql`${t.id} = 1`)],
);
