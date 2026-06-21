"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, isStaff } from "@/core/auth/session";
import { type ActionResult, toActionError } from "@/core/errors";
import { reviewSchema } from "./schemas";
import { createReview } from "./service";
import { deleteReviewRow, setApproved } from "./repository";

export async function createReviewAction(
  productId: string,
  slug: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Iniciá sesión para opinar." },
    };
  }
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Elegí una puntuación válida." },
    };
  }
  try {
    await createReview({
      productId,
      customerId: user.id,
      authorName: user.profile?.fullName ?? null,
      input: parsed.data,
    });
    revalidatePath(`/producto/${slug}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function approveReviewAction(id: string): Promise<ActionResult> {
  if (!(await isStaff()))
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "No autorizado" },
    };
  try {
    await setApproved(id, true);
    revalidatePath("/admin/resenas");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteReviewAction(id: string): Promise<ActionResult> {
  if (!(await isStaff()))
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "No autorizado" },
    };
  try {
    await deleteReviewRow(id);
    revalidatePath("/admin/resenas");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
