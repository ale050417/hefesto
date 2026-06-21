import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/core/db";
import { products, reviews } from "@/core/db/schema";
import type { Review } from "./types";

type Database = typeof db;

export async function listApprovedByProduct(
  productId: string,
  database: Database = db,
): Promise<Review[]> {
  return database.query.reviews.findMany({
    where: and(eq(reviews.productId, productId), eq(reviews.isApproved, true)),
    orderBy: (r, { desc: d }) => [d(r.createdAt)],
  });
}

export async function getStats(
  productId: string,
  database: Database = db,
): Promise<{ average: number; count: number }> {
  const [row] = await database
    .select({
      average: sql<number>`coalesce(avg(${reviews.rating}), 0)::float8`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.isApproved, true)));
  return { average: row?.average ?? 0, count: row?.count ?? 0 };
}

export async function hasReviewed(
  productId: string,
  customerId: string,
  database: Database = db,
): Promise<boolean> {
  const row = await database.query.reviews.findFirst({
    where: and(
      eq(reviews.productId, productId),
      eq(reviews.customerId, customerId),
    ),
  });
  return Boolean(row);
}

export async function insertReview(
  values: typeof reviews.$inferInsert,
  database: Database = db,
): Promise<Review> {
  const [row] = await database.insert(reviews).values(values).returning();
  if (!row) throw new Error("No se pudo guardar la reseña");
  return row;
}

export type ModerationReview = {
  id: string;
  productId: string;
  productName: string | null;
  authorName: string | null;
  rating: number;
  comment: string | null;
  isApproved: boolean;
  createdAt: Date;
};

export async function listForModeration(
  database: Database = db,
): Promise<ModerationReview[]> {
  return database
    .select({
      id: reviews.id,
      productId: reviews.productId,
      productName: products.name,
      authorName: reviews.authorName,
      rating: reviews.rating,
      comment: reviews.comment,
      isApproved: reviews.isApproved,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .leftJoin(products, eq(reviews.productId, products.id))
    .orderBy(desc(reviews.createdAt))
    .limit(200);
}

export async function setApproved(
  id: string,
  isApproved: boolean,
  database: Database = db,
): Promise<void> {
  await database.update(reviews).set({ isApproved }).where(eq(reviews.id, id));
}

export async function deleteReviewRow(
  id: string,
  database: Database = db,
): Promise<void> {
  await database.delete(reviews).where(eq(reviews.id, id));
}
