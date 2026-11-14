// Plan de cambios del reparto entre socios (módulo puro, testeable). Lo usa la
// API de la app (`PUT /api/v1/admin/ganancias/socios`): valida TODO en el
// servidor con las mismas reglas que el editor web (`ProfitSharesEditor`) y
// decide qué se crea, qué se actualiza y qué se borra. Toca plata: la ganancia
// pura se reparte con estos porcentajes.

import { sharesTotal } from "./economics";
import { profitShareSchema } from "./schemas";

/** Tope de socios por pantalla (la web usa 6 colores y cicla). */
export const MAX_SHARES = 20;

export type CurrentShare = {
  id: string;
  name: string;
  role: string | null;
  pct: string | number;
};

export type SharesRequestItem = {
  id?: string | null;
  name: unknown;
  role?: unknown;
  pct: unknown;
};

export type SharesPlan = {
  creates: Array<{ name: string; role: string | null; pct: number }>;
  updates: Array<{
    id: string;
    name: string;
    role: string | null;
    pct: number;
  }>;
  deletes: string[];
  /** Suma de porcentajes del reparto final. */
  total: number;
};

export type SharesPlanResult =
  | { ok: true; plan: SharesPlan }
  | { ok: false; message: string };

/**
 * `items` = el reparto final que quiere la app (con `id` los que ya existían);
 * `removedIds` = los socios que el usuario quitó. Un socio actual que no está
 * ni en `items` ni en `removedIds` es uno que la app NO conocía (lo agregaron
 * desde otro lado): se rechaza para no borrarlo ni repartir mal.
 */
export function planSharesChange(
  current: CurrentShare[],
  items: SharesRequestItem[],
  removedIds: string[] = [],
): SharesPlanResult {
  if (items.length === 0) {
    return { ok: false, message: "Tiene que haber al menos un socio." };
  }
  if (items.length > MAX_SHARES) {
    return { ok: false, message: `Máximo ${MAX_SHARES} socios.` };
  }

  const currentById = new Map(current.map((c) => [c.id, c]));
  const parsed: Array<{
    id: string | null;
    name: string;
    role: string | null;
    pct: number;
  }> = [];
  const seen = new Set<string>();

  for (const it of items) {
    const p = profitShareSchema.safeParse({
      name: it.name,
      role: it.role,
      pct: it.pct,
    });
    if (!p.success) {
      const issue = p.error.issues[0]?.message ?? "Revisá los datos.";
      return { ok: false, message: `Revisá los datos de los socios: ${issue}` };
    }
    const id = typeof it.id === "string" && it.id !== "" ? it.id : null;
    if (id) {
      if (seen.has(id)) {
        return { ok: false, message: "Hay un socio repetido en el pedido." };
      }
      seen.add(id);
      if (!currentById.has(id)) {
        return {
          ok: false,
          message:
            "Un socio ya no existe (cambió desde otro dispositivo). Actualizá la pantalla.",
        };
      }
    }
    parsed.push({
      id,
      name: p.data.name,
      role: p.data.role ?? null,
      pct: p.data.pct,
    });
  }

  const removed = new Set(removedIds.filter((id) => currentById.has(id)));
  for (const id of removed) {
    if (seen.has(id)) {
      return {
        ok: false,
        message: "Un socio figura como quitado y como activo.",
      };
    }
  }
  const unknown = current.filter((c) => !seen.has(c.id) && !removed.has(c.id));
  if (unknown.length > 0) {
    return {
      ok: false,
      message:
        "Los socios cambiaron desde otro dispositivo. Actualizá la pantalla y volvé a intentar.",
    };
  }

  // Misma regla que el editor web: el reparto suma 100% (redondeado).
  const total = sharesTotal(parsed);
  if (Math.round(total) !== 100) {
    return {
      ok: false,
      message: `El reparto tiene que sumar 100%. Ahora suma ${Math.round(total)}%.`,
    };
  }

  const creates: SharesPlan["creates"] = [];
  const updates: SharesPlan["updates"] = [];
  for (const it of parsed) {
    if (it.id == null) {
      creates.push({ name: it.name, role: it.role, pct: it.pct });
      continue;
    }
    const cur = currentById.get(it.id);
    const same =
      cur != null &&
      cur.name === it.name &&
      (cur.role ?? null) === it.role &&
      Number(cur.pct) === it.pct;
    if (!same) {
      updates.push({ id: it.id, name: it.name, role: it.role, pct: it.pct });
    }
  }

  return {
    ok: true,
    plan: { creates, updates, deletes: [...removed], total },
  };
}
