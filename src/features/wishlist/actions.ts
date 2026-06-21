"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/core/auth/session";
import type { ProductView } from "@/features/products/types";
import {
  addToWishlist,
  clearWishlist,
  getWishlist,
  getWishlistIds,
  removeFromWishlist,
} from "./service";

export async function getMyWishlistIdsAction(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return getWishlistIds(user.id);
}

export async function toggleWishlistAction(
  productId: string,
): Promise<{ ok: boolean; inWishlist?: boolean; needsAuth?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, needsAuth: true };
  const ids = await getWishlistIds(user.id);
  if (ids.includes(productId)) {
    await removeFromWishlist(user.id, productId);
    revalidatePath("/cuenta/favoritos");
    return { ok: true, inWishlist: false };
  }
  await addToWishlist(user.id, productId);
  revalidatePath("/cuenta/favoritos");
  return { ok: true, inWishlist: true };
}

export async function getMyWishlistProductsAction(): Promise<ProductView[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return getWishlist(user.id);
}

export async function clearMyWishlistAction(): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  await clearWishlist(user.id);
  revalidatePath("/cuenta/favoritos");
  return { ok: true };
}
