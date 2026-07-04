"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/core/auth/session";
import { can } from "@/core/auth/permissions";
import { type ActionResult, toActionError } from "@/core/errors";
import { reviewSchema } from "./schemas";
import { createReview, removeReview, setReviewApproved } from "./service";

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
  if (!(await can("resenas", "editar")))
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "No autorizado" },
    };
  try {
    await setReviewApproved(id, true);
    revalidatePath("/admin/resenas");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteReviewAction(id: string): Promise<ActionResult> {
  if (!(await can("resenas", "eliminar")))
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "No autorizado" },
    };
  try {
    await removeReview(id);
    revalidatePath("/admin/resenas");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
