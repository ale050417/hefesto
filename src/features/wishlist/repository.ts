import { and, eq } from "drizzle-orm";
import { db } from "@/core/db";
import { wishlistItems } from "@/core/db/schema";

type Database = typeof db;

export async function listWishlistIds(
  customerId: string,
  database: Database = db,
): Promise<string[]> {
  const rows = await database
    .select({ productId: wishlistItems.productId })
    .from(wishlistItems)
    .where(eq(wishlistItems.customerId, customerId));
  return rows.map((r) => r.productId);
}

export async function addWishlistItem(
  customerId: string,
  productId: string,
  database: Database = db,
): Promise<void> {
  await database
    .insert(wishlistItems)
    .values({ customerId, productId })
    .onConflictDoNothing();
}

export async function removeWishlistItem(
  customerId: string,
  productId: string,
  database: Database = db,
): Promise<void> {
  await database
    .delete(wishlistItems)
    .where(
      and(
        eq(wishlistItems.customerId, customerId),
        eq(wishlistItems.productId, productId),
      ),
    );
}
