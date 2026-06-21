"use server";

import { quickSearch } from "./services/catalogService";
import type { ProductView } from "./types";

export async function searchProductsAction(q: string): Promise<ProductView[]> {
  return quickSearch(q, 6);
}
