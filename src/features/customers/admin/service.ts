import {
  getCustomer,
  listCustomerOrders,
  listCustomers,
  type CustomerRow,
  type CustomerOrderRow,
} from "./repository";

export async function getCustomersList(): Promise<CustomerRow[]> {
  return listCustomers();
}

export async function getCustomerDetail(id: string): Promise<{
  customer: CustomerRow;
  orders: CustomerOrderRow[];
} | null> {
  const customer = await getCustomer(id);
  if (!customer) return null;
  const orders = await listCustomerOrders(id);
  return { customer, orders };
}
