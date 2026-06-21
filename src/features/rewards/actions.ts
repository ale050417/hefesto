"use server";

import { getCurrentUser } from "@/core/auth/session";
import { getBalance, getHistory } from "./service";
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
