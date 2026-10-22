import { cache } from "react";
import { getSettings, upsertSettings } from "@/features/settings/repository";
import { DEFAULT_QUOTE_DEFAULTS, type QuoteDefaults } from "./build-quote";

/**
 * Textos por defecto de la cotización (business_settings.quote_defaults).
 * Fresco por request (React cache): el que los guarda los ve al instante.
 */
export const getQuoteDefaults = cache(async (): Promise<QuoteDefaults> => {
  const s = await getSettings().catch(() => null);
  const q = s?.quoteDefaults;
  if (!q) return DEFAULT_QUOTE_DEFAULTS;
  return {
    title: q.title?.trim() || DEFAULT_QUOTE_DEFAULTS.title,
    depositPct: Number.isFinite(q.depositPct)
      ? q.depositPct
      : DEFAULT_QUOTE_DEFAULTS.depositPct,
    depositText: q.depositText ?? DEFAULT_QUOTE_DEFAULTS.depositText,
    notes: Array.isArray(q.notes) ? q.notes : DEFAULT_QUOTE_DEFAULTS.notes,
  };
});

export async function saveQuoteDefaults(next: QuoteDefaults): Promise<void> {
  await upsertSettings({ quoteDefaults: next });
}
