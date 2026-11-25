/**
 * Borradores del alta de producto (pedido de Agustín, 2026-11-22: "a veces
 * toco escape sin querer o cierro sin querer y debo empezar el procedimiento
 * todo de nuevo").
 *
 * Mientras se carga un producto nuevo, el asistente se guarda solo en ESTE
 * navegador (IndexedDB, que también guarda las fotos elegidas). Si se cierra
 * por accidente, queda en "Borradores" para retomarlo donde estaba. Al crear
 * el producto, el borrador se borra.
 *
 * Es local al dispositivo: un borrador empezado en la compu no aparece en el
 * celular (la app tiene los suyos).
 */

/** Todo lo que se tipea en el asistente (lo que se puede guardar como JSON). */
export type WizardSnapshot = {
  step: number;
  name: string;
  categoryId: string;
  description: string;
  posX: number;
  posY: number;
  colorMode: "single" | "multi";
  colors: string[];
  colorGrams: Record<string, number>;
  colorPricesSingle: Record<string, number>;
  dimensions: string;
  productionTime: string;
  price: string;
  extras: Array<{ name: string; cost: string; qty: string }>;
  hasSizes: boolean;
  byColor: boolean;
  multiCombos: boolean;
  variants: Array<{
    label: string;
    price: string;
    colorGrams: Record<string, number>;
    weightGrams: string;
    colorPrices: Record<string, number>;
    extrasCost: string;
    comboColors: string[];
  }>;
  est: {
    filamentId: string | null;
    material: string;
    color: string;
    grams: number;
    printMinutes: number;
    layerHeight: string;
    presetId: string;
    price: number | null;
    colorGrams?: Record<string, number>;
  };
  status: "draft" | "published";
  isFeatured: boolean;
};

/** Las fotos elegidas (IndexedDB guarda archivos tal cual). */
export type WizardFiles = {
  image: File | null;
  original: File | null;
  extras: File[];
  colorImages: Record<string, File>;
};

export type ProductDraft = {
  id: string;
  updatedAt: number;
  data: WizardSnapshot;
  files: WizardFiles;
};

export const MAX_PRODUCT_DRAFTS = 10;

/* ---------- Reglas puras (testeadas) ---------- */

export function draftTitle(data: Pick<WizardSnapshot, "name">): string {
  return data.name.trim() || "Producto sin nombre";
}

/**
 * ¿Hay algo cargado que valga la pena guardar? Un asistente recién abierto (o
 * con solo la categoría elegida) no crea un borrador.
 */
export function hasDraftContent(
  data: WizardSnapshot,
  files: WizardFiles,
): boolean {
  return (
    data.name.trim() !== "" ||
    data.description.trim() !== "" ||
    data.dimensions.trim() !== "" ||
    data.productionTime.trim() !== "" ||
    data.price.trim() !== "" ||
    data.colors.length > 0 ||
    data.variants.length > 0 ||
    data.extras.length > 0 ||
    files.image != null ||
    files.extras.length > 0 ||
    Object.keys(files.colorImages).length > 0
  );
}

/** Los más nuevos primero; `stale` son los que sobran del tope. */
export function splitDrafts<T extends { id: string; updatedAt: number }>(
  drafts: T[],
  max = MAX_PRODUCT_DRAFTS,
): { keep: T[]; stale: T[] } {
  const sorted = [...drafts].sort((a, b) => b.updatedAt - a.updatedAt);
  return { keep: sorted.slice(0, max), stale: sorted.slice(max) };
}

/** "recién", "hace 5 min", "hace 3 h", "ayer", "hace 4 días". */
export function draftAge(updatedAt: number, now = Date.now()): string {
  const min = Math.max(0, Math.floor((now - updatedAt) / 60_000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "ayer" : `hace ${days} días`;
}

/** ¿Lo guardado tiene la forma de un borrador? (datos viejos o rotos → no). */
export function isProductDraft(value: unknown): value is ProductDraft {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<ProductDraft>;
  return (
    typeof v.id === "string" &&
    typeof v.updatedAt === "number" &&
    !!v.data &&
    typeof v.data === "object" &&
    typeof v.data.name === "string" &&
    Array.isArray(v.data.variants) &&
    !!v.files &&
    typeof v.files === "object" &&
    Array.isArray(v.files.extras)
  );
}

/* ---------- IndexedDB ---------- */

const DB_NAME = "hefesto-admin";
const STORE = "product-drafts";
/** Aviso entre componentes de la misma pestaña: cambió la lista. */
export const DRAFTS_EVENT = "hefesto:product-drafts";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Este navegador no guarda borradores."));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB"));
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = work(tx.objectStore(STORE));
      let result: T;
      req.onsuccess = () => {
        result = req.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB"));
    });
  } finally {
    db.close();
  }
}

function announce() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DRAFTS_EVENT));
  }
}

/** Borradores guardados, el más nuevo primero. Nunca lanza: sin base, []. */
export async function listProductDrafts(): Promise<ProductDraft[]> {
  try {
    const all = await run(
      "readonly",
      (s) => s.getAll() as IDBRequest<unknown[]>,
    );
    return splitDrafts(all.filter(isProductDraft)).keep;
  } catch {
    return [];
  }
}

export async function getProductDraft(
  id: string,
): Promise<ProductDraft | null> {
  try {
    const row = await run("readonly", (s) => s.get(id) as IDBRequest<unknown>);
    return isProductDraft(row) ? row : null;
  } catch {
    return null;
  }
}

/** Guarda (o pisa) un borrador y descarta los que pasan el tope. */
export async function saveProductDraft(draft: ProductDraft): Promise<void> {
  try {
    await run("readwrite", (s) => s.put(draft));
    const all = await run(
      "readonly",
      (s) => s.getAll() as IDBRequest<unknown[]>,
    );
    const { stale } = splitDrafts(all.filter(isProductDraft));
    for (const old of stale) {
      await run("readwrite", (s) => s.delete(old.id));
    }
    announce();
  } catch (error) {
    // Sin espacio o en modo privado: se sigue cargando, solo que sin borrador.
    console.warn("[borradores] no se pudo guardar:", error);
  }
}

export async function deleteProductDraft(id: string): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(id));
    announce();
  } catch {
    // nada que borrar
  }
}
