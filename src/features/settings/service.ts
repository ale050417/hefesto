import { cache } from "react";
import { getSettings, upsertSettings } from "./repository";
import type { BrandSettings } from "./types";

// Cacheado por request: Header, Footer y Home lo piden sin duplicar la query.
export const getBrandSettings = cache(async (): Promise<BrandSettings> => {
  const s = await getSettings();
  return {
    logoUrl: s?.logoUrl ?? null,
    heroImageUrl: s?.heroImageUrl ?? null,
  };
});

export async function setBrandImage(
  kind: "logo" | "hero",
  url: string,
): Promise<void> {
  await upsertSettings(
    kind === "logo" ? { logoUrl: url } : { heroImageUrl: url },
  );
}
