import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { userRole } from "./enums";

// Extiende auth.users de Supabase con nuestros datos + rol.
// La FK a auth.users y el trigger que crea el profile se agregan por SQL
// en la migración (Drizzle no maneja el schema `auth`).
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name"),
  phone: text("phone"),
  role: userRole("role").notNull().default("customer"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
