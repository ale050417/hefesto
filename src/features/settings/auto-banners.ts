import { env } from "@/core/config/env";
import { getHomeData } from "@/features/products/services/catalogService";
import type { ProductView } from "@/features/products/types";
import { getSettings, upsertSettings } from "./repository";
import { createBanner, deleteBanner, getAllBanners } from "./service";

/**
 * Banners del hero generados por IA (pedido de Ale, 2026-10-21: "que me
 * actualice los banners cada 10 días con productos nuevos, que los cree
 * solo"). Cada corrida:
 *
 *  1. Elige candidatos: los productos publicados más nuevos y los más
 *     vendidos, siempre con foto (la foto del producto ES el fondo del banner;
 *     ya tienen el estilo de catálogo).
 *  2. Le pide a Claude el copy de 3 banners (título, bajada, botón) en
 *     castellano rioplatense, como JSON.
 *  3. Borra SOLO los banners de la corrida anterior (sus ids quedan en
 *     business_settings.auto_banners) y crea los nuevos. Los banners que
 *     cargó el dueño a mano no se tocan.
 *
 * Lo dispara el cron de Vercel (/api/cron/banners, cada 10 días) o el botón
 * "Renovar con IA" de Config → Tienda.
 */

export const AUTO_BANNERS_EVERY_DAYS = 10;
const BANNERS_PER_RUN = 3;
const MODEL = env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";

export type BannerCandidate = {
  id: string;
  name: string;
  slug: string;
  price: number;
  category: string | null;
  isNew: boolean;
  topSeller: boolean;
  image: string;
  position: string;
};

export type BannerCopy = {
  productId: string;
  title: string;
  subtitle: string;
  cta: string;
};

export function isAutoBannersConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

/** Productos con foto: nuevos primero, después los más vendidos. Sin repetir. */
export function pickCandidates(home: {
  latest: ProductView[];
  featured: ProductView[];
}): BannerCandidate[] {
  const out: BannerCandidate[] = [];
  const seen = new Set<string>();
  const push = (p: ProductView, topSeller: boolean) => {
    if (seen.has(p.id) || !p.primaryImage?.url) return;
    seen.add(p.id);
    out.push({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.displayPrice,
      category: p.category?.name ?? null,
      isNew: p.isNew,
      topSeller,
      image: p.primaryImage.url,
      position: p.primaryImage.position || "50% 50%",
    });
  };
  for (const p of home.latest) push(p, false);
  for (const p of home.featured) push(p, true);
  return out.slice(0, 10);
}

/** Saca el JSON de la respuesta aunque venga entre ```json … ```. */
export function parseBannerCopy(
  raw: string,
  candidates: BannerCandidate[],
): BannerCopy[] {
  const text = raw.replace(/```(?:json)?/gi, "").trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const ids = new Set(candidates.map((c) => c.id));
  const used = new Set<string>();
  const out: BannerCopy[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const productId = String(o.productId ?? "");
    const title = String(o.title ?? "").trim();
    const subtitle = String(o.subtitle ?? "").trim();
    const cta = String(o.cta ?? "").trim();
    if (!ids.has(productId) || used.has(productId) || !title) continue;
    used.add(productId);
    out.push({
      productId,
      title: title.slice(0, 60),
      subtitle: subtitle.slice(0, 140),
      cta: (cta || "Ver producto").slice(0, 28),
    });
    if (out.length >= BANNERS_PER_RUN) break;
  }
  return out;
}

const SYSTEM = [
  "Sos el redactor de Hefesto 3D, una tienda argentina de piezas impresas en 3D a pedido (figuras, decoración, llaveros, trofeos, accesorios).",
  "Escribís en castellano rioplatense (vos), corto, con gancho y sin exagerar. Nada de emojis ni mayúsculas gritadas.",
  "Te van a dar productos candidatos y tenés que elegir los 3 mejores para los banners de la portada y escribir el copy de cada uno.",
  'Respondé SOLO con un JSON válido: un array de 3 objetos {"productId", "title", "subtitle", "cta"}.',
  'title: máximo 40 caracteres, el nombre o la idea del producto en clave de titular. subtitle: máximo 90 caracteres, por qué vale la pena (nuevo, el más pedido, para regalar, color a elección). cta: máximo 20 caracteres, un verbo ("Ver producto", "Lo quiero", "Pedir el mío").',
  "Priorizá los productos nuevos; si hay un más vendido, usalo como uno de los 3. No inventes precios ni datos que no estén en la lista.",
].join(" ");

async function askClaude(candidates: BannerCandidate[]): Promise<string> {
  const list = candidates
    .map(
      (c, i) =>
        `${i + 1}. productId=${c.id} · "${c.name}"${c.category ? ` (${c.category})` : ""} · $${Math.round(c.price).toLocaleString("es-AR")}${c.isNew ? " · NUEVO" : ""}${c.topSeller ? " · MÁS VENDIDO" : ""}`,
    )
    .join("\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Productos candidatos:\n${list}\n\nElegí 3 y devolvé el JSON.`,
        },
      ],
    }),
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(
      "[auto-banners] Anthropic falló:",
      res.status,
      detail.slice(0, 300),
    );
    throw new Error(`AUTO_BANNERS_API_ERROR:${res.status}`);
  }
  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}

export type AutoBannersResult =
  | { ok: true; created: number; skipped?: undefined }
  | {
      ok: false;
      skipped: "not_configured" | "no_products" | "too_soon" | "empty_copy";
    };

/** ¿Pasaron los 10 días desde la última corrida? */
export function isDue(
  lastRunAt: string | null | undefined,
  now = new Date(),
): boolean {
  if (!lastRunAt) return true;
  const last = new Date(lastRunAt).getTime();
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= (AUTO_BANNERS_EVERY_DAYS - 0.5) * 86_400_000;
}

export async function refreshAutoBanners(
  opts: {
    force?: boolean;
  } = {},
): Promise<AutoBannersResult> {
  if (!isAutoBannersConfigured())
    return { ok: false, skipped: "not_configured" };
  const settings = await getSettings().catch(() => null);
  const prev = settings?.autoBanners ?? null;
  if (!opts.force && !isDue(prev?.lastRunAt))
    return { ok: false, skipped: "too_soon" };

  const home = await getHomeData();
  const candidates = pickCandidates(home);
  if (candidates.length === 0) return { ok: false, skipped: "no_products" };

  const copy = parseBannerCopy(await askClaude(candidates), candidates);
  if (copy.length === 0) return { ok: false, skipped: "empty_copy" };

  // Primero se crean los nuevos; si algo falla, los viejos siguen en pie.
  const existing = new Set((await getAllBanners()).map((b) => b.id));
  const created: string[] = [];
  for (const [i, c] of copy.entries()) {
    const product = candidates.find((p) => p.id === c.productId)!;
    const b = await createBanner({
      title: c.title,
      subtitle: c.subtitle || null,
      imageUrl: product.image,
      position: product.position,
      align: i % 2 === 0 ? "left" : "center",
      ctaText: c.cta,
      ctaHref: `/producto/${product.slug}`,
      isActive: true,
      sortOrder: i,
    });
    created.push(b.id);
  }
  for (const id of prev?.ids ?? []) {
    if (existing.has(id)) await deleteBanner(id).catch(() => undefined);
  }
  await upsertSettings({
    autoBanners: {
      ids: created,
      lastRunAt: new Date().toISOString(),
      model: MODEL,
    },
  });
  return { ok: true, created: created.length };
}
