import { ValidationError } from "@/core/errors";
import * as repo from "./repository";
import type { ReviewInput } from "./schemas";
import type { Review, ReviewStats } from "./types";

/** Promedio redondeado a 1 decimal (función pura, testeable). */
export function computeAverage(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((a, b) => a + b, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

export async function getProductReviews(
  productId: string,
): Promise<{ stats: ReviewStats; items: Review[] }> {
  const [stats, items] = await Promise.all([
    repo.getStats(productId),
    repo.listApprovedByProduct(productId),
  ]);
  return { stats, items };
}

export async function createReview(params: {
  productId: string;
  customerId: string;
  authorName: string | null;
  input: ReviewInput;
}): Promise<Review> {
  if (await repo.hasReviewed(params.productId, params.customerId)) {
    throw new ValidationError("Ya dejaste una reseña en este producto.");
  }
  return repo.insertReview({
    productId: params.productId,
    customerId: params.customerId,
    authorName: params.authorName,
    rating: params.input.rating,
    comment: params.input.comment ?? null,
    isApproved: false,
  });
}

export async function getProductReviewsFor(
  productId: string,
  userId: string | null,
): Promise<{ stats: ReviewStats; items: Review[]; alreadyReviewed: boolean }> {
  const { stats, items } = await getProductReviews(productId);
  const alreadyReviewed = userId
    ? await repo.hasReviewed(productId, userId)
    : false;
  return { stats, items, alreadyReviewed };
}
