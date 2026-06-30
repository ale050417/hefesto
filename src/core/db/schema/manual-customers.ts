import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

// Clientes cargados a mano: compraron sin registrarse (WhatsApp, teléfono, en el
// local). A diferencia de `profiles`, NO dependen de auth.users, así que se
// pueden dar de alta libremente para tener su ficha y contacto en la base.
// (Misma razón que `manual_sales`: el alta por cuenta exige auth.)
export const manualCustomers = pgTable(
  "manual_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    city: text("city"),
    note: text("note"),
    // Quién lo cargó (staff). Se conserva si se borra el usuario.
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("manual_customers_name_idx").on(t.name)],
);
