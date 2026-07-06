import { config } from "dotenv";

// tsx corre fuera de Next, así que cargamos el .env.local a mano (igual que
// seed-run.ts), ANTES de importar nada que valide las variables.
config({ path: ".env.local" });

/**
 * Aplica las migraciones pendientes MOSTRANDO EL ERROR COMPLETO si algo falla
 * (drizzle-kit a veces lo traga y solo deja "Command failed with exit code 1").
 * Usa la MISMA tabla de tracking que drizzle-kit (drizzle.__drizzle_migrations),
 * así que es intercambiable con `pnpm db:migrate`.
 *
 * Uso: pnpm db:migrate:debug
 */
async function main() {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const { default: postgres } = await import("postgres");

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ Falta DATABASE_URL en .env.local");
    process.exit(1);
  }
  // max:1 y sin prepared statements: compatible con el pooler de Supabase.
  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql);

  console.log("⏫ Aplicando migraciones pendientes...");
  try {
    await migrate(db, { migrationsFolder: "src/core/db/migrations" });
    console.log("✅ Migraciones aplicadas. La base quedó al día.");
  } catch (error) {
    console.error("❌ ERROR COMPLETO DE LA MIGRACIÓN:\n");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("❌ Falló el runner de migraciones:", error);
  process.exit(1);
});
