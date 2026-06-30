import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { userRole } from "./enums";
import { roles } from "./roles";

// Extiende auth.users de Supabase con nuestros datos + rol.
// La FK a auth.users y el trigger que crea el profile se agregan por SQL
// en la migración (Drizzle no maneja el schema `auth`).
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name"),
  phone: text("phone"),
  // Nota interna del taller sobre el cliente (solo admin; no la ve el cliente).
  adminNote: text("admin_note"),
  role: userRole("role").notNull().default("customer"),
  // Rol personalizado con permisos por módulo (capa sobre el enum). Para staff;
  // los clientes lo tienen en null. ON DELETE SET NULL: si se borra el rol, el
  // perfil queda sin rol custom (pero conserva su `role` enum de acceso).
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "set null" }),
  // Invitado con contraseña temporal: debe cambiarla en el primer ingreso.
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
