import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

// Arreglos (pedido de Ale, 2026-11-17): el operador anota lo que hay que
// arreglar o mejorar, con fotos, y al dueño le llega para decidir qué hacer.
// `createdByName` es un snapshot: el pedido se sigue entendiendo aunque la
// cuenta del que lo cargó se borre.
export const fixRequests = pgTable(
  "fix_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    urgent: boolean("urgent").notNull().default(false),
    // pending | in_progress | done
    status: text("status").notNull().default("pending"),
    // URLs públicas de las fotos (bucket de imágenes, prefijo arreglos/).
    images: jsonb("images").$type<string[]>().notNull().default([]),
    // Respuesta del dueño (qué se hizo, o por qué no se va a hacer).
    ownerNote: text("owner_note"),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdByName: text("created_by_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "fix_requests_status_valid",
      sql`${t.status} IN ('pending', 'in_progress', 'done')`,
    ),
    index("fix_requests_status_idx").on(t.status, t.createdAt),
  ],
);
