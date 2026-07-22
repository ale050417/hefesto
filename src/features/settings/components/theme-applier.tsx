import { getBrandSettings } from "../service";
import { effectiveAccent, hexToRgbString, shade } from "../seasons";

/**
 * Aplica el color de acento (custom o de la temporada) sobrescribiendo las
 * variables --gold del tema. Server component: se monta en el layout raíz, así
 * que el acento vale en toda la app.
 *
 * Además, cuando hay una TEMPORADA activa (no "Marca Hefesto"), tiñe TODA la
 * paleta con un lavado SUTIL del color de la temporada: una capa fija y muy
 * translúcida con `mix-blend-mode: soft-light`, que se adapta a fondos claros
 * (tienda) y oscuros (admin) sin quedar chillón ni tapar la interacción. Es
 * reversible: en "Marca Hefesto" no hay lavado y todo queda como el tema base.
 */
export async function ThemeApplier() {
  const brand = await getBrandSettings();
  const accent = effectiveAccent(brand.season, brand.accentColor);
  const rgb = accent ? hexToRgbString(accent) : null;
  if (!accent || !rgb) return null;

  const css = `:root{--gold:${accent};--gold-bright:${shade(accent, 14)};--gold-deep:${shade(accent, -16)};--gold-rgb:${rgb};}`;
  const seasonActive = !!brand.season && brand.season !== "none";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {seasonActive ? (
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 2147483000,
            background: accent,
            opacity: 0.08,
            mixBlendMode: "soft-light",
          }}
        />
      ) : null}
    </>
  );
}
