/**
 * Migrador del proyecto (`pnpm db:migrate`). Usa el migrator oficial de
 * drizzle-orm en vez de `drizzle-kit migrate`, que en este entorno fallaba
 * con exit 1 sin mostrar el error (2026-07-09). Ventajas: mismo cliente
 * postgres-js que la app (SSL requerido, sin prepared statements) y errores
 * de Postgres COMPLETOS en pantalla (código, tabla, constraint, query).
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL (revisá tu .env.local).");

const sql = postgres(url, {
  max: 1,
  prepare: false,
  ssl: "require",
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
