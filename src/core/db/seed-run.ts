import { config } from "dotenv";

// tsx corre fuera de Next, así que cargamos el .env.local a mano,
// ANTES de importar la base (que valida las variables al cargarse).
config({ path: ".env.local" });

async function main() {
  const { client, db } = await import("./index");
  const { seedDatabase } = await import("./seed");

  console.log("🌱 Cargando datos de ejemplo...");
  const result = await seedDatabase(db);
  console.log("✅ Seed completo:", result);
  await client.end();
}

main().catch((error) => {
  console.error("❌ El seed falló:", error);
  process.exit(1);
});
