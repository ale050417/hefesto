import { sql } from "drizzle-orm";
import { db } from "@/core/db";

// Siempre dinámica: nunca se cachea ni se evalúa en build.
export const dynamic = "force-dynamic";

/**
 * Health check: comprueba que la conexión a la base funciona (SELECT 1).
 * Abrir en /api/health.
 */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: "up" });
  } catch (error) {
    // Detalle solo a los logs del servidor (Cap. 14: no filtrar al cliente).
    console.error("[health] fallo de conexión a la base:");
    console.error(error);
    const cause = error instanceof Error && error.cause ? error.cause : null;
    if (cause) {
      console.error("[health] causa raíz:", cause);
    }
    return Response.json({ ok: false, db: "down" }, { status: 500 });
  }
}
