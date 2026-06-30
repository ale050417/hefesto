import { getBrandSettings } from "../service";
import { effectiveAccent, hexToRgbString, shade } from "../seasons";

/**
 * Aplica el color de acento (custom o de la temporada) sobrescribiendo las
 * variables --gold del tema. Server component: se monta en el layout raíz, así
 * que el acento vale en toda la app. (La decoración de temporada se monta solo
 * en la tienda, ver StoreSeasonDecoration.)
 */
export async function ThemeApplier() {
  const brand = await getBrandSettings();
  const accent = effectiveAccent(brand.season, brand.accentColor);
  const rgb = accent ? hexToRgbString(accent) : null;
  if (!accent || !rgb) return null;

  const css = `:root{--gold:${accent};--gold-bright:${shade(accent, 14)};--gold-deep:${shade(accent, -16)};--gold-rgb:${rgb};}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
