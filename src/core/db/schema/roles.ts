import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Roles personalizados con permisos por módulo. Capa ENCIMA del enum `user_role`
 * (que sigue siendo el portón de acceso y lo usan las RLS): el enum decide quién
 * entra al panel; el rol decide QUÉ puede hacer adentro (se aplica en el servidor).
 *
 * - `permissions`: { [módulo]: acciones[] }, p. ej. { pedidos: ["ver","editar"] }.
 *   Módulos: productos, pedidos, clientes, descuentos, reportes, config.
 *   Acciones: ver, crear, editar, eliminar.
 * - `isAdmin`: acceso total (ignora `permissions`) + gestión de equipo/roles.
 * - `isSystem`: roles base (Administrador / Operador), no se pueden borrar.
 */
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  permissions: jsonb("permissions")
    .$type<Record<string, string[]>>()
    .notNull()
    .default({}),
  isSystem: boolean("is_system").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
