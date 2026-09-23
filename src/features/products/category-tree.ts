/**
 * Árbol de categorías (2026-09-21, pedido de Ale): las subcategorías pueden
 * tener subcategorías, sin límite de nivel. Ejemplo real:
 *
 *   Figuras de colección
 *     └ Funko Pop
 *         └ Superhéroes
 *
 * Hasta acá había un solo nivel (Fase 6) y cada pantalla armaba "raíces +
 * hijas" a mano. Con niveles ilimitados esa cuenta se repite en seis lugares
 * (admin de categorías, formulario, filtros de la tienda, wizard de producto,
 * home, productos del admin), así que vive acá UNA vez, pura y testeada.
 *
 * Todo es tolerante a datos raros: un padre que no existe en la lista cuenta
 * como raíz (por ejemplo, la tienda solo recibe las categorías con productos),
 * y un ciclo accidental no cuelga el render (se corta al repetir un id).
 */

export type CategoryNode = { id: string; parentId: string | null };

/** Hijas directas de cada categoría, en el orden en que vinieron. */
export function childrenByParent<T extends CategoryNode>(
  cats: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const c of cats) {
    if (!c.parentId) continue;
    const list = map.get(c.parentId) ?? [];
    list.push(c);
    map.set(c.parentId, list);
  }
  return map;
}

/** Raíces: sin padre, o con un padre que no está en la lista. */
export function rootsOf<T extends CategoryNode>(cats: T[]): T[] {
  const ids = new Set(cats.map((c) => c.id));
  return cats.filter((c) => !c.parentId || !ids.has(c.parentId));
}

/** Ids de TODA la descendencia (hijas, nietas, ...), sin incluir la propia. */
export function descendantIds<T extends CategoryNode>(
  cats: T[],
  id: string,
): string[] {
  const byParent = childrenByParent(cats);
  const out: string[] = [];
  const seen = new Set<string>([id]);
  const stack = [...(byParent.get(id) ?? [])];
  while (stack.length > 0) {
    const c = stack.pop()!;
    if (seen.has(c.id)) continue; // ciclo: no repetir
    seen.add(c.id);
    out.push(c.id);
    stack.push(...(byParent.get(c.id) ?? []));
  }
  return out;
}

/** La categoría y toda su descendencia (lo que "cubre" un filtro). */
export function subtreeIds<T extends CategoryNode>(
  cats: T[],
  id: string,
): string[] {
  return [id, ...descendantIds(cats, id)];
}

/** ¿`candidateId` está debajo de `ancestorId` (a cualquier profundidad)? */
export function isDescendantOf<T extends CategoryNode>(
  cats: T[],
  candidateId: string,
  ancestorId: string,
): boolean {
  return descendantIds(cats, ancestorId).includes(candidateId);
}

/** Antepasados de una categoría, de la raíz hacia el padre directo. */
export function ancestorsOf<T extends CategoryNode>(
  cats: T[],
  id: string,
): T[] {
  const byId = new Map(cats.map((c) => [c.id, c]));
  const chain: T[] = [];
  const seen = new Set<string>([id]);
  let cur = byId.get(id);
  while (cur?.parentId) {
    const parent = byId.get(cur.parentId);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    chain.unshift(parent);
    cur = parent;
  }
  return chain;
}

/** Profundidad: 0 = raíz, 1 = hija, 2 = nieta, ... */
export function depthOf<T extends CategoryNode>(cats: T[], id: string): number {
  return ancestorsOf(cats, id).length;
}

/**
 * Ruta legible: "Figuras de colección › Funko Pop › Superhéroes". Sirve para
 * los selectores donde una lista plana no deja ver de quién es hija cada una.
 */
export function categoryPath<T extends CategoryNode & { name: string }>(
  cats: T[],
  id: string,
  separator = " › ",
): string {
  const self = cats.find((c) => c.id === id);
  if (!self) return "";
  return [...ancestorsOf(cats, id), self].map((c) => c.name).join(separator);
}

/**
 * El árbol aplanado en orden de lectura (cada categoría seguida de sus
 * descendientes), con su profundidad para indentar. Respeta el orden en que
 * vinieron las categorías entre hermanas.
 */
export function flattenTree<T extends CategoryNode>(
  cats: T[],
  rootId?: string,
): Array<{ node: T; depth: number }> {
  const byParent = childrenByParent(cats);
  const out: Array<{ node: T; depth: number }> = [];
  const seen = new Set<string>();
  const walk = (nodes: T[], depth: number) => {
    for (const n of nodes) {
      if (seen.has(n.id)) continue; // ciclo
      seen.add(n.id);
      out.push({ node: n, depth });
      walk(byParent.get(n.id) ?? [], depth + 1);
    }
  };
  if (rootId) {
    walk(byParent.get(rootId) ?? [], 0);
  } else {
    walk(rootsOf(cats), 0);
  }
  return out;
}

/**
 * Suma un valor numérico (ej. cantidad de productos) sobre la categoría y
 * toda su descendencia: un padre cuyos productos están en las nietas no puede
 * decir "0 productos".
 */
export function sumSubtree<T extends CategoryNode>(
  cats: T[],
  id: string,
  value: (c: T) => number,
): number {
  const byId = new Map(cats.map((c) => [c.id, c]));
  return subtreeIds(cats, id).reduce((acc, cid) => {
    const c = byId.get(cid);
    return acc + (c ? value(c) : 0);
  }, 0);
}
