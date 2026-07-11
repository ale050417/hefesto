/**
 * Migrador del proyecto (`pnpm db:migrate`). Usa el migrator oficial de
 * drizzle-orm en vez de `drizzle-kit migrate`, que en este entorno fallaba
 * con exit 1 sin mostrar el error (2026-07-09). Ventajas: mismo cliente
 * postgres-js que la app (SSL requerido, sin prepared statements) y errores
 * de Postgres COMPLETOS en pantalla (código, tabla, constraint, query).
 *
 * REGLA (incidentes 2026-07-10/11): el DDL NUNCA va por el pooler en modo
 * TRANSACCIÓN (puerto 6543). Una migración fallida ahí deja conexiones y
 * locks huérfanos que bloquean tablas enteras (pedidos/clientes colgados
 * hasta reiniciar Supabase). Por eso acá:
 *  - si la URL apunta al pooler :6543, se cambia a :5432 (mismo host =
 *    pooler en modo SESIÓN: semántica completa de Postgres, apta para DDL);
 *  - se puede forzar otra conexión con DIRECT_DATABASE_URL en .env.local
 *    (p. ej. la conexión directa db.<ref>.supabase.co:5432);
 *  - statement_timeout = 0 SOLO en esta sesión: una migración legítima puede
 *    tardar más que los 8 s del default que tiene la base.
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.local" });

const raw = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!raw) {
  throw new Error(
    "Falta DATABASE_URL o DIRECT_DATABASE_URL (revisá tu .env.local).",
  );
}

const url = raw.includes(":6543/") ? raw.replace(":6543/", ":5432/") : raw;
if (url !== raw) {
  console.log("db:migrate → usando el pooler en modo SESIÓN (:5432) para DDL");
}

const sql = postgres(url, {
  max: 1,
  prepare: false,
  ssl: "require",
  // Sin el statement_timeout global de la base (solo esta sesión, solo DDL).
  connection: { statement_timeout: 0 },
  onnotice: (n) => console.log("NOTICE:", n.message),
});
const db = drizzle(sql);

async function main() {
  try {
    await migrate(db, { migrationsFolder: "./src/core/db/migrations" });
    console.log("✔ Migraciones aplicadas OK");
  } catch (e) {
    const err = e as Record<string, unknown> & { cause?: unknown };
    console.error("\n===== ERROR REAL =====");
    console.error(err);
    if (err?.cause) console.error("\n===== CAUSA =====\n", err.cause);
    for (const k of [
      "code",
      "detail",
      "table",
      "constraint",
      "query",
      "where",
    ]) {
      const v =
        (err as Record<string, unknown>)[k] ??
        (err?.cause as Record<string, unknown> | undefined)?.[k];
      if (v) console.error(`${k}:`, String(v).slice(0, 500));
    }
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

void main();
