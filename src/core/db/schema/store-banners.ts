import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Slides rotativos del hero del home (apariencia de la tienda).
export const storeBanners = pgTable("store_banners", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  imageUrl: text("image_url"),
  // Encuadre de la imagen de fondo (background-position). Ej: "50% 30%".
  position: text("position").notNull().default("50% 50%"),
  align: text("align").notNull().default("left"), // left | center | right
  ctaText: text("cta_text"),
  ctaHref: text("cta_href"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
