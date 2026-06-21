import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/core/db";
import {
  couponRedemptions,
  coupons,
  orderItems,
  orderStatusHistory,
  orders,
} from "@/core/db/schema";
import type {
  NewOrder,
  NewOrderItem,
  Order,
  OrderStatus,
  OrderWithItems,
} from "./types";

// Inyección ligera (Cap. 6): por defecto la conexión real; en tests se puede
// pasar otra base. El repository es la ÚNICA puerta a la base (Cap. 5).
type Database = typeof db;

// Datos para crear un pedido completo: la cabecera + sus líneas. El `orderId`
// de cada línea lo pone el repository una vez que existe el pedido.
export type CreateOrderInput = {
  order: NewOrder;
  items: Array<Omit<NewOrderItem, "orderId">>;
  redeemCoupon?: { couponId: string };
};

/**
 * Crea pedido + ítems + primer registro de historial en UNA transacción.
 * Si cualquier paso falla, no queda nada a medias (atomicidad, Cap. 11/15).
 */
export async function createOrder(
  input: CreateOrderInput,
  database: Database = db,
): Promise<Order> {
  return database.transaction(async (tx) => {
    const [created] = await tx.insert(orders).values(input.order).returning();
    if (!created) throw new Error("No se pudo crear el pedido");

    if (input.items.length > 0) {
      await tx
        .insert(orderItems)
        .values(input.items.map((it) => ({ ...it, orderId: created.id })));
    }

    // Historial inicial: nace en su estado (from = null). Lo registra quien
    // lo creó (el cliente).
    await tx.insert(orderStatusHistory).values({
      orderId: created.id,
      fromStatus: null,
      toStatus: created.status,
      changedBy: created.customerId,
      note: "Pedido creado",
    });

    // Canje del cupón (atómico): suma un uso y registra el canje.
    if (input.redeemCoupon) {
      await tx
        .update(coupons)
        .set({ usedCount: sql`${coupons.usedCount} + 1` })
        .where(eq(coupons.id, input.redeemCoupon.couponId));
      await tx.insert(couponRedemptions).values({
        couponId: input.redeemCoupon.couponId,
        orderId: created.id,
        customerId: created.customerId,
      });
    }

    return created;
  });
}

/** Pedido por id, con sus líneas y su historial ordenado. */
export async function findOrderById(
  id: string,
  database: Database = db,
): Promise<OrderWithItems | null> {
  const order = await database.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      items: true,
      history: { orderBy: (h, { asc }) => [asc(h.createdAt)] },
    },
  });
  return order ?? null;
}

/** Pedido por su número público, con ítems e historial (para la confirmación). */
export async function findOrderDetailByNumber(
  orderNumber: string,
  database: Database = db,
): Promise<OrderWithItems | null> {
  const order = await database.query.orders.findFirst({
    where: eq(orders.orderNumber, orderNumber),
    with: {
      items: true,
      history: { orderBy: (h, { asc }) => [asc(h.createdAt)] },
    },
  });
  return order ?? null;
}

/** Pedido por su número público (HEF-XXXX). */
export async function findOrderByNumber(
  orderNumber: string,
  database: Database = db,
): Promise<Order | null> {
  const order = await database.query.orders.findFirst({
    where: eq(orders.orderNumber, orderNumber),
  });
  return order ?? null;
}

/** Pedidos de un cliente, del más nuevo al más viejo. */
export async function findOrdersByCustomer(
  customerId: string,
  database: Database = db,
): Promise<Order[]> {
  return database.query.orders.findMany({
    where: eq(orders.customerId, customerId),
    orderBy: (o, { desc }) => [desc(o.createdAt)],
  });
}

/**
 * Cambia el estado de un pedido y registra la transición en el historial, todo
 * en una transacción. Devuelve el pedido actualizado.
 */
export async function updateOrderStatus(
  params: {
    orderId: string;
    fromStatus: OrderStatus;
    toStatus: OrderStatus;
    paidAt?: Date | null;
    changedBy?: string | null;
    note?: string | null;
  },
  database: Database = db,
): Promise<Order> {
  return database.transaction(async (tx) => {
    const [updated] = await tx
      .update(orders)
      .set({
        status: params.toStatus,
        ...(params.paidAt !== undefined ? { paidAt: params.paidAt } : {}),
      })
      .where(eq(orders.id, params.orderId))
      .returning();
    if (!updated) throw new Error("No se pudo actualizar el pedido");

    await tx.insert(orderStatusHistory).values({
      orderId: params.orderId,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      changedBy: params.changedBy ?? null,
      note: params.note ?? null,
    });

    return updated;
  });
}

/** Pedidos para el panel (admin ve todos), con filtro por estado y paginación. */
export async function findOrdersForAdmin(
  opts: { status?: OrderStatus; page: number; pageSize: number },
  database: Database = db,
): Promise<{
  items: Array<Order & { customer: { fullName: string | null } | null }>;
  total: number;
}> {
  const where = opts.status ? eq(orders.status, opts.status) : undefined;
  const offset = (opts.page - 1) * opts.pageSize;

  const [items, totalRows] = await Promise.all([
    database.query.orders.findMany({
      where,
      with: { customer: { columns: { fullName: true } } },
      orderBy: [desc(orders.createdAt)],
      limit: opts.pageSize,
      offset,
    }),
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(where),
  ]);

  return { items, total: totalRows[0]?.count ?? 0 };
}

/** Pedido completo para el panel: ítems, historial y datos del cliente. */
export async function findOrderDetailForAdmin(
  id: string,
  database: Database = db,
): Promise<
  | (OrderWithItems & {
      customer: { fullName: string | null; phone: string | null } | null;
    })
  | null
> {
  const order = await database.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      items: true,
      history: { orderBy: (h, { asc }) => [asc(h.createdAt)] },
      customer: { columns: { fullName: true, phone: true } },
    },
  });
  return order ?? null;
}

/** Actualiza datos editables del pedido (tracking / nota interna). */
export async function updateOrderMeta(
  orderId: string,
  fields: { trackingCode?: string | null; internalNote?: string | null },
  database: Database = db,
): Promise<Order> {
  const [row] = await database
    .update(orders)
    .set(fields)
    .where(eq(orders.id, orderId))
    .returning();
  if (!row) throw new Error("No se pudo actualizar el pedido");
  return row;
}

/** Conteo de pedidos por estado (para los chips del panel). */
export async function countOrdersByStatus(
  database: Database = db,
): Promise<Record<string, number>> {
  const rows = await database
    .select({ status: orders.status, count: sql<number>`count(*)::int` })
    .from(orders)
    .groupBy(orders.status);
  const map: Record<string, number> = {};
  for (const r of rows) map[r.status] = r.count;
  return map;
}
