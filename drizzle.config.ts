import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit corre fuera de Next, así que cargamos el .env.local a mano.
config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("Falta DATABASE_URL (revisá tu .env.local).");
}

export default defineConfig({
  schema: "./src/core/db/schema",
  out: "./src/core/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
});
