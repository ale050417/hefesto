import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Rate limiting DISTRIBUIDO (2026-07, cierra la deuda del Cap. 4): un contador
// por clave (p. ej. "login:<ip>") con ventana fija. Vive en Postgres para que
// el límite valga entre TODAS las instancias serverless (el limiter en memoria
// contaba por proceso). El upsert atómico vive en core/security/rate-limit.ts.
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});
