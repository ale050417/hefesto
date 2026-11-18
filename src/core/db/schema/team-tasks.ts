import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

// Pendientes del equipo (pedido de Agustín, 2026-11-17): una lista compartida
// en Pedidos donde cualquiera anota lo que falta (un pedido sin cargar, una
// cotización por mandar, un caso olvidado) y cualquiera lo tilda.
// `createdByName` y `doneByName` son snapshots: el pendiente se sigue
// entendiendo aunque la cuenta de quien lo anotó o lo tildó se borre.
export const teamTasks = pgTable(
  "team_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    body: text("body").notNull(),
    done: boolean("done").notNull().default(false),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdByName: text("created_by_name"),
    doneByName: text("done_by_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "team_tasks_body_length",
      sql`char_length(${t.body}) BETWEEN 1 AND 500`,
    ),
    index("team_tasks_done_idx").on(t.done, t.createdAt),
  ],
);
