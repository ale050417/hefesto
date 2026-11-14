import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiError, apiOk, requireApiStaff, withApi } from "@/core/api/respond";
import { isAdminForUser } from "@/core/auth/permissions";
import { presetErrorResponse } from "@/features/calculator/api-errors";
import { marginPresetSchema } from "@/features/calculator/schemas";
import {
  deleteMarginPreset,
  updateMarginPreset,
} from "@/features/calculator/service";

/**
 * PATCH / DELETE /api/v1/admin/calculadora/tipos/:id — edita o borra un tipo de
 * producto (2026-10-31). SOLO ADMIN (como `saveMarginPresetAction` y
 * `deleteMarginPresetAction`). PATCH recibe el tipo completo
 * { name, marginPct, active?, sortOrder? } (misma validación que la web).
 */
export const dynamic = "force-dynamic";

const NOT_ADMIN = "Los tipos y márgenes son solo para administradores.";

export const PATCH = withApi(
  "admin/calculadora/tipos/id",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireApiStaff(request);
    if ("response" in auth) return auth.response;
    if (!(await isAdminForUser(auth.user))) {
      return apiError("forbidden", NOT_ADMIN);
    }

    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Tipo inválido.");

    const parsed = marginPresetSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiError("invalid", "Revisá el nombre y el margen del tipo.");
    }

    try {
      await updateMarginPreset(id.data, parsed.data);
      revalidatePath("/admin/calculadora");
      return apiOk({ ok: true });
    } catch (error) {
      return presetErrorResponse(error);
    }
  },
);

export const DELETE = withApi(
  "admin/calculadora/tipos/id",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireApiStaff(request);
    if ("response" in auth) return auth.response;
    if (!(await isAdminForUser(auth.user))) {
      return apiError("forbidden", NOT_ADMIN);
    }

    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Tipo inválido.");

    try {
      await deleteMarginPreset(id.data);
      revalidatePath("/admin/calculadora");
      return apiOk({ ok: true });
    } catch (error) {
      return presetErrorResponse(error);
    }
  },
);
