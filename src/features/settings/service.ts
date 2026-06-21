import { cache } from "react";
import { getSettings, upsertSettings } from "./repository";
import type { BrandSettings, BusinessSettings } from "./types";

// Cacheado por request: Header, Footer, Home y el FAB lo piden sin duplicar query.
export const getBrandSettings = cache(async (): Promise<BrandSettings> => {
  const s = await getSettings();
  return {
    logoUrl: s?.logoUrl ?? null,
    heroImageUrl: s?.heroImageUrl ?? null,
    storeName: s?.storeName ?? null,
    whatsapp: s?.whatsapp ?? null,
    instagram: s?.instagram ?? null,
    facebook: s?.facebook ?? null,
    contactEmail: s?.contactEmail ?? null,
  };
});

// Configuración completa (para el panel del admin).
export const getBusinessSettings = cache(
  async (): Promise<BusinessSettings | null> => {
    return getSettings();
  },
);

export async function setBrandImage(
  kind: "logo" | "hero",
  url: string,
): Promise<void> {
  await upsertSettings(
    kind === "logo" ? { logoUrl: url } : { heroImageUrl: url },
  );
}

export type BusinessInfoPatch = {
  storeName?: string | null;
  description?: string | null;
  whatsapp?: string | null;
  contactEmail?: string | null;
  addressText?: string | null;
  instagram?: string | null;
  facebook?: string | null;
};

export async function saveBusinessInfo(
  patch: BusinessInfoPatch,
): Promise<void> {
  await upsertSettings(patch);
}
