import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { recordAudit } from "@/core/audit";
import { businessError, invalidInput } from "@/features/inventory/api-helpers";
import { buildHexResolver } from "@/features/inventory/color-hex";
import {
  deleteFilament,
  getFilament,
  listColorCatalog,
  toFilamentView,
  updateFilamentDetails,
} from "@/features/inventory/queries";
import { filamentDetailsSchema } from "@/features/inventory/schemas";

/**
 * /api/v1/admin/filaments/:id — un carrete (app móvil, 2026-10-31).
 *  - GET    → el carrete con su hex. Permiso filamentos/ver.
 *  - PATCH  → edita sus datos (material, color, marca, diámetro, carrete, costo
 *             y umbral de alerta). Permiso filamentos/editar. NO toca el stock:
 *             eso va por `POST /filaments/:id/adjust` (queda en el historial).
 *  - DELETE → elimina el carrete. Permiso filamentos/eliminar. Los movimientos
 *             y fallas que lo referenciaban quedan con su snapshot de
 *             material/color (la FK es `set null`).
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function withHex<T extends { color: string }>(filament: T) {
  const colors = await listColorCatalog().catch(() => []);
  return { ...filament, hex: buildHexResolver(colors)(filament.color) };
}

export const GET = withApi(
  "admin/filaments/id",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "filamentos", "ver");
    if ("response" in auth) return auth.response;

    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Filamento inválido.");

    const f = await getFilament(id.data);
    if (!f) return apiError("not_found", "No encontramos el filamento.");
    return apiOk({ filament: await withHex(toFilamentView(f)) });
  },
);

export const PATCH = withApi(
  "admin/filaments/update",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "filamentos", "editar");
    if ("response" in auth) return auth.response;

    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Filamento inválido.");

    const parsed = filamentDetailsSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    try {
      const updated = await updateFilamentDetails(id.data, parsed.data);
      await recordAudit({
        actorId: auth.user.id,
        action: "inventory.filament_updated",
        entityType: "filament",
        entityId: id.data,
        metadata: { material: updated.material, color: updated.color },
      });
      revalidatePath("/admin/filamentos");
      return apiOk({ filament: await withHex(toFilamentView(updated)) });
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);

export const DELETE = withApi(
  "admin/filaments/delete",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "filamentos", "eliminar");
    if ("response" in auth) return auth.response;

    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Filamento inválido.");

    const f = await getFilament(id.data);
    if (!f) return apiError("not_found", "No encontramos el filamento.");

    await deleteFilament(id.data);
    await recordAudit({
      actorId: auth.user.id,
      action: "inventory.filament_deleted",
      entityType: "filament",
      entityId: id.data,
      metadata: {
        material: f.material,
        color: f.color,
        stockGrams: Number(f.stockGrams),
      },
    });
    revalidatePath("/admin/filamentos");
    return apiOk({ ok: true });
  },
);
