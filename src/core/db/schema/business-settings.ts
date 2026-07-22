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
    // Segundos que corre la decoración al entrar (0 = siempre). Perf: frena sola.
    seasonDurationSec: integer("season_duration_sec").notNull().default(0),
    // Visibilidad de las secciones del home: { [sectionId]: boolean }.
    homeSections: jsonb("home_sections").$type<Record<string, boolean>>(),
    // Banda de confianza del home (editable desde Config): 4 ítems con ícono +
    // título + texto. Null = usa los textos por defecto del home.
    trustBar:
      jsonb("trust_bar").$type<Array<{ ic: string; t: string; d: string }>>(),
    // FAQ del home (editable desde Config): lista de preguntas/respuestas.
    // Null/vacío = usa las preguntas por defecto del home.
    faq: jsonb("faq").$type<Array<{ q: string; a: string }>>(),
    // Segundos entre banners del hero (autoplay). Default 5; el mínimo/máximo
    // razonables (3-12s) se validan en el servidor para no quedar ni muy rápido
    // ni demasiado lento.
    bannerIntervalSec: integer("banner_interval_sec").notNull().default(5),
    // Datos fiscales / operativos (pestaña Negocio).
    cuit: text("cuit"),
    // Cada día tiene dos turnos: mañana y tarde, cada uno con su on/desde/hasta.
    // (Formato viejo {label,from,to,on} se normaliza al leer en el form.)
    hours: jsonb("hours").$type<
      Array<{
        label: string;
        morning: { on: boolean; from: string; to: string };
        afternoon: { on: boolean; from: string; to: string };
      }>
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
