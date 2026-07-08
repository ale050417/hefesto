// Diagnóstico fino: mide DÓNDE se va el tiempo hablando con la base, SIN Next.
// Distingue: query simple (warm) vs abrir conexión en frío (introspección de
// tipos del pooler) vs queries reales de tus tablas.
// Correr:  pnpm tsx scripts/db-ping.ts
import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

const url = process.env.DATABASE_URL;

async function time<T>(label: string, fn: () => Promise<T>): Promise<void> {
  const t0 = Date.now();
  try {
    await fn();
    console.log(`✅ ${label}: ${Date.now() - t0} ms`);
  } catch (e) {
    console.error(
      `❌ ${label}: FALLÓ tras ${Date.now() - t0} ms →`,
      e instanceof Error ? e.message : e,
    );
  }
}

async function main() {
  if (!url) {
    console.error("❌ Falta DATABASE_URL en .env.local");
    process.exit(1);
  }
  try {
    console.log("Host:", new URL(url).host, "\n");
  } catch {
    /* noop */
  }

  // Cliente igual al de la app (transaction pooler): prepare:false.
  const sql = postgres(url, { prepare: false, connect_timeout: 30, max: 10 });

  // 1) Primera query = abre conexión + introspección de tipos (fetch_types).
  await time("primera query (conexión en frío + fetch_types)", () =>
    sql`select 1`.then(() => {}),
  );
  // 2) Segunda query = conexión ya caliente.
  await time("query simple (conexión caliente)", () =>
    sql`select 1`.then(() => {}),
  );

  // 3) Queries reales de tus tablas (cuentan filas).
  const tables = [
    "profiles",
    "products",
    "orders",
    "order_items",
    "manual_sales",
    "filaments",
  ];
  for (const t of tables) {
    await time(`count(*) ${t}`, () =>
      sql`select count(*)::int from ${sql(t)}`.then(() => {}),
    );
  }

  // La consulta EXACTA que timeoutea en la app (config de la tienda, 1 fila).
  await time("select business_settings (la que timeoutea)", () =>
    sql`select id from business_settings limit 1`.then(() => {}),
  );

  // ¿Sesiones colgadas "idle in transaction" (posible causa del lock)?
  await time("sesiones idle-in-transaction", async () => {
    const rows = await sql`
      select pid, state, now() - xact_start as tx_age, left(query, 90) as q
      from pg_stat_activity
      where state = 'idle in transaction'
      order by xact_start`;
    console.log(`   → ${rows.length} idle-in-transaction`, rows);
  });

  // ¿Locks sobre business_settings?
  await time("locks en business_settings", async () => {
    const rows = await sql`
      select l.pid, l.mode, l.granted
      from pg_locks l join pg_class c on c.oid = l.relation
      where c.relname = 'business_settings'`;
    console.log(`   → ${rows.length} locks`, rows);
  });

  // 4) 10 queries en paralelo (simula lo que hace una página con Promise.all
  //    + varias conexiones a la vez → detecta saturación del pool/pooler).
  await time("10 queries en paralelo", () =>
    Promise.all(Array.from({ length: 10 }, () => sql`select 1`)).then(() => {}),
  );

  await sql.end({ timeout: 5 });

  // 5) API de Auth de Supabase (host DISTINTO al pooler). getUser() pega acá en
  //    CADA request; si este host está lento, cuelga todas las páginas aunque la
  //    base vuele.
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supaUrl) {
    console.log("\nAuth host:", new URL(supaUrl).host);
    await time("HTTP a la API de Auth (auth/v1/health)", async () => {
      const res = await fetch(`${supaUrl}/auth/v1/health`);
      await res.text();
    });
    await time("HTTP a la API de Auth (2da, caliente)", async () => {
      const res = await fetch(`${supaUrl}/auth/v1/health`);
      await res.text();
    });
  } else {
    console.log(
      "\n(no hay NEXT_PUBLIC_SUPABASE_URL para probar la API de Auth)",
    );
  }
}

void main();
