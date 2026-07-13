import { getBrandSettings } from "../service";
import { DECO_GLYPHS, getSeason } from "../seasons";
import { SeasonDecoration } from "./season-decoration";

/** Monta la decoración de temporada (partículas) — solo en la tienda. */
export async function StoreSeasonDecoration() {
  const brand = await getBrandSettings();
  const season = getSeason(brand.season);
  if (!brand.seasonDeco || !season.deco) return null;
  const glyphs = DECO_GLYPHS[season.deco];
  return (
    <SeasonDecoration
      glyphs={[...glyphs]}
      intensity={brand.seasonIntensity}
      durationSec={brand.seasonDurationSec}
    />
  );
}
