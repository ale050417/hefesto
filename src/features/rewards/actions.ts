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
