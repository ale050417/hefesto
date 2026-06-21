import {
  addOrderMessage,
  getOrderCustomerId,
  listOrderMessages,
  type OrderMessage,
} from "../messages.repository";

export async function getOrderMessages(
  orderId: string,
): Promise<OrderMessage[]> {
  return listOrderMessages(orderId);
}

export async function sendOrderMessage(params: {
  orderId: string;
  fromStaff: boolean;
  authorId: string | null;
  body: string;
}): Promise<OrderMessage> {
  return addOrderMessage({
    orderId: params.orderId,
    fromStaff: params.fromStaff,
    authorId: params.authorId,
    body: params.body,
  });
}

export { getOrderCustomerId };
