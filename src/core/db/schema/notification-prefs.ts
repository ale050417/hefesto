import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

// Preferencias de avisos del panel, por persona (0085): qué tipos apagó y
// hasta cuándo leyó (el "no leído" es de cada uno, no de todo el equipo).
export const notificationPrefs = pgTable("notification_prefs", {
  profileId: uuid("profile_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  mutedKinds: text("muted_kinds")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  seenAt: timestamp("seen_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Dispositivos (navegadores) que aceptaron recibir avisos push (0085).
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("push_subscriptions_profile_idx").on(t.profileId)],
);
