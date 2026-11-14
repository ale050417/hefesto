import { revalidatePath } from "next/cache";
import { recordAudit } from "@/core/audit";
import * as queries from "./queries";
import type { FailureInput } from "./schemas";

/**
 * Registrar / borrar una falla CON todos sus efectos (2026-10-31, pedido de
 * Ale: app móvil). Antes vivían inline en `registerFailureAction` /
 * `deleteFailureAction`; se extrajeron para que la web (Server Action) y la API
 * de la app (`/api/v1/admin/fallas`) hagan EXACTAMENTE lo mismo: stock por el
 * ledger (con aviso de stock bajo / faltante) + auditoría + revalidación.
 *
 * La AUTORIZACIÓN (fallas/crear y fallas/eliminar) la valida cada caller antes.
 */

export async function registerFailureFlow(
  input: FailureInput,
  actorId: string | null,
): Promise<{ lowStock: boolean; deducted: boolean }> {
  const res = await queries.recordFailure(input);
  await recordAudit({
    actorId,
    action: "inventory.failure_registered",
    entityType: "filament",
    entityId: null,
    metadata: {
      material: input.material,
      color: input.color,
      gramsLost: input.gramsLost,
      deducted: res.deducted,
    },
  });
  revalidatePath("/admin/fallas");
  revalidatePath("/admin/filamentos");
  // El aviso de stock bajo / faltante lo dispara recordFailure (ledger),
  // que distingue "quedó bajo el umbral" de "faltó" (shortfall) por color.
  return res;
}

/** Borrar una falla DEVUELVE al stock los gramos que había descontado. */
export async function deleteFailureFlow(
  id: string,
  actorId: string | null,
): Promise<{ restored: number }> {
  const { restored } = await queries.deleteFailure(id);
  await recordAudit({
    actorId,
    action: "inventory.failure_deleted",
    entityType: "filament",
    entityId: null,
    metadata: { restoredGrams: restored },
  });
  revalidatePath("/admin/fallas");
  revalidatePath("/admin/filamentos");
  return { restored };
}
