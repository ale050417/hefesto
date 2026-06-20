import { findOrderDetailForAdmin, findOrdersForAdmin } from "../repository";
import type { OrderListItem, OrderStatus } from "../types";

export async function listOrdersAdmin(opts: {
  status?: OrderStatus;
  page: number;
  pageSize: number;
}): Promise<{
  items: OrderListItem[];
  page: number;
  totalPages: number;
  total: number;
}> {
  const { items, total } = await findOrdersForAdmin(opts);
  return {
    items: items.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customer?.fullName ?? null,
      total: Number(o.total),
      status: o.status,
      createdAt: o.createdAt,
    })),
    page: opts.page,
    totalPages: Math.max(1, Math.ceil(total / opts.pageSize)),
    total,
  };
}

export async function getOrderAdmin(id: string) {
  return findOrderDetailForAdmin(id);
}
