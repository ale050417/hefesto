export type TrustItem = { ic: string; t: string; d: string };

/**
 * Banda de confianza por defecto del home (si nunca se editó desde Config →
 * Tienda). El ícono queda fijo por punto; solo se editan los textos. Lo usan el
 * editor de la web y la API de la app.
 */
export const DEFAULT_TRUST_BAR: TrustItem[] = [
  {
    ic: "truck",
    t: "Producción en 48 h",
    d: "Imprimimos y despachamos rápido",
  },
  {
    ic: "shield",
    t: "Pago 100% seguro",
    d: "MercadoPago, transferencia y efectivo",
  },
  { ic: "layers", t: "Materiales premium", d: "PLA de primera calidad" },
  {
    ic: "refresh",
    t: "Reimpresión garantizada",
    d: "Si algo sale mal, lo rehacemos",
  },
];

/** Cómo se nombra cada ícono en el editor. */
export const TRUST_ICON_LABEL: Record<string, string> = {
  truck: "Envío / producción",
  shield: "Pago / seguridad",
  layers: "Materiales",
  refresh: "Garantía",
};
