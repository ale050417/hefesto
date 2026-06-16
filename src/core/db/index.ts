import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/core/config/env";
import * as schema from "./schema";

/**
 * Cliente de base de datos (Drizzle sobre postgres-js).
 * `prepare: false` para ser compatible con el pooler de Supabase.
 * postgres-js conecta de forma perezosa (no abre conexión hasta la 1ª query).
 */
const client = postgres(env.DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });
export { client };
