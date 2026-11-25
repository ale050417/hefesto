import { revalidatePath } from "next/cache";
import { apiError, apiOk, requireApiStaff, withApi } from "@/core/api/respond";
import { canForUser, isAdminForUser } from "@/core/auth/permissions";
import { presetErrorResponse } from "@/features/calculator/api-errors";
import {
  marginPresetSchema,
  presetLikeSchema,
} from "@/features/calculator/schemas";
import {
  createMarginPreset,
  createPresetLike,
} from "@/features/calculator/service";

/**
 * POST /api/v1/admin/calculadora/tipos — crea un tipo de producto.
 *
 * Dos formas, según el body:
 *  - { name, likePresetId } → "se cobra como" otro tipo (sugerencia de
 *    Agustín, 2026-11-25). Permiso calculadora/crear: lo puede hacer el
 *    operador. El servidor copia el margen del tipo elegido; el % no viaja
 *    (solo se devuelve si quien lo crea es admin) y al admin le llega un aviso.
 *  - { name, marginPct, active?, sortOrder? } → con su margen. SOLO ADMIN
 *    (como `saveMarginPresetAction`): el margen es secreto de negocio.
 */
export const dynamic = "force-dynamic";

export const POST = withApi(
  "admin/calculadora/tipos",
  async (request: Request) => {
    const auth = await requireApiStaff(request);
    if ("response" in auth) return auth.response;
    const body: unknown = await request.json().catch(() => null);
    const admin = await isAdminForUser(auth.user);

    if (body && typeof body === "object" && "likePresetId" in body) {
      if (!(await canForUser(auth.user, "calculadora", "crear"))) {
        return apiError("forbidden", "No tenés permiso para hacer esto.");
      }
      const parsed = presetLikeSchema.safeParse(body);
      if (!parsed.success) {
        return apiError(
          "invalid",
          "Poné un nombre y elegí con qué tipo se cobra igual.",
        );
      }
      try {
        const row = await createPresetLike(
          parsed.data,
          auth.user.profile?.fullName?.trim() || null,
        );
        revalidatePath("/admin/calculadora");
        return apiOk(
          {
            ok: true,
            id: row.id,
            name: row.name,
            ...(admin ? { marginPct: row.marginPct } : {}),
          },
          { status: 201 },
        );
      } catch (error) {
        return presetErrorResponse(error);
      }
    }

    if (!admin) {
      return apiError(
        "forbidden",
        "Los tipos y márgenes son solo para administradores.",
      );
    }

    const parsed = marginPresetSchema.safeParse(body);
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
