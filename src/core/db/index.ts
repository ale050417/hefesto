import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/core/config/env";
import * as schema from "./schema";

/**
 * Cliente de base de datos (Drizzle sobre postgres-js), tuneado para el pooler
 * de Supabase (modo transacción, puerto 6543 / PgBouncer):
 *  - `prepare: false`: PgBouncer en modo transacción no soporta prepared statements.
 *  - `idle_timeout`: cierra conexiones ociosas del lado del cliente ANTES de que
 *    las cierre el pooler, así no se reusa una conexión muerta → evita
 *    `CONNECTION_CLOSED`.
 *  - `max_lifetime`: recicla conexiones cada tanto (el pooler las rota).
 *  - `max`: tope de conexiones simultáneas (no agotar el límite del pooler).
 *  - `connect_timeout`: falla rápido si la red está caída.
 *
 * En desarrollo, Next hace hot-reload del módulo y crearía un cliente nuevo en
 * cada cambio (fuga de conexiones → el pooler te corta). Por eso reusamos un
 * singleton guardado en `globalThis`.
 */
function makeClient() {
  return postgres(env.DATABASE_URL, {
    prepare: false,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    max: 10,
    connect_timeout: 15,
  });
}

const globalForDb = globalThis as unknown as {
  __hefestoDbClient?: ReturnType<typeof makeClient>;
};

const client = globalForDb.__hefestoDbClient ?? makeClient();
if (process.env.NODE_ENV !== "production") {
  globalForDb.__hefestoDbClient = client;
}

export const db = drizzle(client, { schema });
export { client };
