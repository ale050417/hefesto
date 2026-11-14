import { revalidatePath } from "next/cache";
import { apiError, apiOk, requireApiStaff, withApi } from "@/core/api/respond";
import { isAdminForUser } from "@/core/auth/permissions";
import { presetErrorResponse } from "@/features/calculator/api-errors";
import { marginPresetSchema } from "@/features/calculator/schemas";
import { createMarginPreset } from "@/features/calculator/service";

/**
 * POST /api/v1/admin/calculadora/tipos — crea un tipo de producto con su
 * margen (2026-10-31). SOLO ADMIN (como `saveMarginPresetAction`): el margen es
 * secreto de negocio. Body: { name, marginPct, active?, sortOrder? }.
 */
export const dynamic = "force-dynamic";

export const POST = withApi(
  "admin/calculadora/tipos",
  async (request: Request) => {
    const auth = await requireApiStaff(request);
    if ("response" in auth) return auth.response;
    if (!(await isAdminForUser(auth.user))) {
      return apiError(
        "forbidden",
        "Los tipos y márgenes son solo para administradores.",
      );
    }

    const parsed = marginPresetSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiError("invalid", "Revisá el nombre y el margen del tipo.");
    }

    try {
      const row = await createMarginPreset(parsed.data);
      revalidatePath("/admin/calculadora");
      return apiOk({ ok: true, id: row.id });
    } catch (error) {
      return presetErrorResponse(error);
    }
  },
);
