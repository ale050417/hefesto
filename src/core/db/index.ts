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
  // En serverless (Vercel prod) cada instancia abre su propio pool; con muchas
  // instancias, un `max` alto agota el pooler de Supabase → `statement timeout`
  // (57014) hasta en queries triviales. En producción usamos max:1 (el pooler
  // en modo transacción ya multiplexa muchas instancias sobre pocos backends).
  // En dev, con el singleton de HMR hay UN cliente: un pool chico da paralelismo
  // (Promise.all) sin fugas.
  const isProd = process.env.NODE_ENV === "production";
  return postgres(env.DATABASE_URL, {
    prepare: false,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    // max:1 obligaba a que las queries en paralelo (Promise.all de la home,
    // por ejemplo) se encolaran una por una en la ÚNICA conexión → sumaban
    // sus tiempos en vez de correr juntas, y eso fue lo que disparó el
    // timeout de 10s en la home. Con max:3 sí corren en paralelo de verdad.
    // Sigue siendo bajo a propósito: con el pooler de Supabase en modo
    // transacción (200 conexiones, pool de 15) varias instancias con max:3
    // no lo agotan, pero un max alto sí lo haría.
    max: isProd ? 3 : 5,
    connect_timeout: 15,
    // Supabase exige SSL en la conexión al pooler. Sin esto, postgres-js
    // conecta en texto plano y Supabase rechaza con "SSL connection is
    // required" (XX000/ESSLREQUIRED) — así se cayó todo el sitio hoy.
    ssl: "require",
    // Red de seguridad: si una query queda colgada esperando que el cliente
    // lea el resultado (ej. la app se cuelga/crashea a mitad de camino), sin
    // esto Postgres la deja viva PARA SIEMPRE. Con max:1 en producción, esa
    // única conexión quedaría tomada y todo el sitio se cuelga hasta que
    // alguien la mate a mano (nos pasó: pid colgado 5+ min en "ClientRead").
    // Con este límite, Postgres aborta la query sola a los 20s y libera la
    // conexión para la siguiente request.
    connection: {
      statement_timeout: 20000,
      idle_in_transaction_session_timeout: 20000,
    },
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
