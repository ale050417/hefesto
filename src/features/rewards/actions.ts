"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/core/auth/session";
import { can } from "@/core/auth/permissions";
import { type ActionResult, toActionError } from "@/core/errors";
import {
  createReward,
  deleteReward,
  getBalance,
  getHistory,
  getReward,
  refundPoints,
  spendPoints,
  updateReward,
} from "./service";
import { rewardSchema } from "./schemas";
import type { PointTransaction } from "./repository";

export async function getMyPointsAction(): Promise<{
  balance: number;
  history: PointTransaction[];
}> {
  const user = await getCurrentUser();
  if (!user) return { balance: 0, history: [] };
  const [balance, history] = await Promise.all([
    getBalance(user.id),
    getHistory(user.id),
  ]);
  return { balance, history };
}

export async function redeemRewardAction(
  rewardId: string,
): Promise<
  | { ok: true; message: string; couponCode?: string }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Iniciá sesión para canjear." };
  try {
    const reward = await getReward(rewardId);
    if (!reward || !reward.isActive) {
      return { ok: false, error: "Esa recompensa no está disponible." };
    }
    const balance = await getBalance(user.id);
    if (balance < reward.costPoints) {
      return {
        ok: false,
        error: `Te faltan ${reward.costPoints - balance} puntos para este premio.`,
      };
    }
    // Descontamos los puntos (el movimiento negativo es el registro del canje).
    await spendPoints(user.id, reward.costPoints, `Canje: ${reward.title}`);
    if (reward.type === "discount") {
      try {
        const { createRewardCoupon } =
          await import("@/features/discounts/queries");
        const code = await createRewardCoupon({
          isPercent: reward.discountIsPercent,
          value: Number(reward.discountValue ?? 0),
          description: `Premio de fidelidad: ${reward.title}`,
        });
        revalidatePath("/cuenta/puntos");
        return {
          ok: true,
          message: `¡Listo! Usá el cupón ${code} en tu próxima compra.`,
          couponCode: code,
        };
      } catch (e) {
        // Si falló generar el cupón, devolvemos los puntos.
        await refundPoints(user.id, reward.costPoints, "Reverso de canje");
        throw e;
      }
    }
    revalidatePath("/cuenta/puntos");
    return {
      ok: true,
      message:
        reward.type === "shipping"
          ? "¡Canjeaste envío gratis! Te lo aplicamos en tu próximo pedido; escribinos para coordinar."
          : "¡Canjeaste tu producto! Te contactamos para coordinar la entrega.",
    };
  } catch {
    return { ok: false, error: "No se pudo canjear. Probá de nuevo." };
  }
}

const NOT_STAFF = {
  ok: false as const,
  error: { code: "UNAUTHORIZED", message: "No autorizado" },
};

export async function createRewardAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!(await can("recompensas", "crear"))) return NOT_STAFF;
  const parsed = rewardSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá los datos." },
    };
  }
  try {
    const r = await createReward(parsed.data);
    revalidatePath("/admin/recompensas");
    return { ok: true, data: { id: r.id } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function updateRewardAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("recompensas", "editar"))) return NOT_STAFF;
  const parsed = rewardSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá los datos." },
    };
  }
  try {
    await updateReward(id, parsed.data);
    revalidatePath("/admin/recompensas");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteRewardAction(id: string): Promise<ActionResult> {
  if (!(await can("recompensas", "eliminar"))) return NOT_STAFF;
  try {
    await deleteReward(id);
    revalidatePath("/admin/recompensas");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
