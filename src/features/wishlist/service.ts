import { listProductsByIds } from "@/features/products/services/catalogService";
import type { ProductView } from "@/features/products/types";
import {
  addWishlistItem,
  clearWishlist as clearWishlistRepo,
  listWishlistIds,
  removeWishlistItem,
} from "./repository";

export async function getWishlistIds(customerId: string): Promise<string[]> {
  return listWishlistIds(customerId);
}

export async function getWishlist(customerId: string): Promise<ProductView[]> {
  const ids = await listWishlistIds(customerId);
  return listProductsByIds(ids);
}

export async function addToWishlist(customerId: string, productId: string) {
  return addWishlistItem(customerId, productId);
}

export async function removeFromWishlist(
  customerId: string,
  productId: string,
) {
  return removeWishlistItem(customerId, productId);
}

export async function clearWishlist(customerId: string) {
  return clearWishlistRepo(customerId);
}
