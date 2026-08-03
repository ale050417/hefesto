import { inArray, sql } from "drizzle-orm";
import { db } from "@/core/db";
import { orders, orderItems, manualSales } from "@/core/db/schema";

/**
 * "Hefesto en números" del home. TODOS los números son reales: no queda ninguno
 * escrito a mano (el "12 materiales y acabados" y la "valoración 4.9★" salieron
 * el 2026-08-03 justamente por ser inventados).
 *
 * Qué cuenta como venta (decisión de Ale, 2026-08-03: "de los pedidos totales"):
 * desde que el pedido está CONFIRMADO en adelante, el mismo criterio que
 * Ganancias y Reportes. Quedan afuera los que nunca se concretaron:
 * `pending_payment` (todavía no pagó y puede no pagar nunca), `cancelled` y
 * `refunded`. Si contáramos "todos" a secas, un carrito abandonado sumaría a la
 * vidriera y el número dejaría de ser cierto.
 */
const SOLD = [
  "confirmed",
  "in_production",
  "ready",
  "shipped",
  "delivered",
] as const;

export type HomeStats = { pieces: number; customers: number };

export async function getHomeStats(): Promise<HomeStats> {
  const [onlinePieces, manualPieces, customerRows] = await Promise.all([
    db
      .select({ n: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` })
      .from(orderItems)
      .innerJoin(orders, sql`${orders.id} = ${orderItems.orderId}`)
      .where(inArray(orders.status, [...SOLD])),
    db
      .select({
        n: sql<number>`coalesce(sum(${manualSales.quantity}), 0)::int`,
      })
      .from(manualSales)
      .where(inArray(manualSales.status, [...SOLD])),
    // Clientes ÚNICOS entre las DOS fuentes A LA VEZ. Antes se sumaba el
    // `distinct` de cada una por separado, así que quien compró online Y en
    // mostrador contaba DOS veces (pedido de Ale: "si se repite el nombre, no
    // se repite el cliente"). El `union` de una subconsulta deduplica de
    // verdad, y el nombre se normaliza (minúsculas, sin espacios de más) para
    // que "Juan Perez" y "  juan  perez " sean la misma persona.
    db.execute(sql`
      select count(*)::int as n from (
        select distinct lower(btrim(regexp_replace(
          coalesce(nullif(btrim(${orders.shippingAddress} ->> 'fullName'), ''),
                   ${orders.customerId}::text),
          '\\s+', ' ', 'g'))) as k
        from ${orders}
        where ${inArray(orders.status, [...SOLD])}
        union
        select distinct lower(btrim(regexp_replace(
          ${manualSales.customerName}, '\\s+', ' ', 'g')))
        from ${manualSales}
        where ${inArray(manualSales.status, [...SOLD])}
      ) u
      where u.k is not null and u.k <> ''
    `),
  ]);

  const rows = customerRows as unknown as { n: number }[];
  return {
    pieces: (onlinePieces[0]?.n ?? 0) + (manualPieces[0]?.n ?? 0),
    customers: Number(rows[0]?.n ?? 0),
  };
}
