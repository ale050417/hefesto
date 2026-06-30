// Temporadas / campañas de la tienda (apariencia). Paths del index.

export type SeasonKey =
  | "none"
  | "navidad"
  | "anionuevo"
  | "reyes"
  | "sanvalentin"
  | "otonio"
  | "invierno"
  | "primavera"
  | "verano"
  | "halloween"
  | "patrias"
  | "blackfriday";

export type SeasonDef = {
  label: string;
  emoji: string;
  /** Ícono SVG (path d) profesional para la tarjeta del panel. */
  icon: string;
  accent: string;
  accent2: string;
  deco: keyof typeof DECO_GLYPHS | null;
  hint: string;
};

// Íconos de línea (24x24, stroke) — sobrios, sin emojis, para el panel.
export const SEASON_ICONS = {
  brand:
    '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.6 17 22l-5-3-5 3 1.5-8.4"/>',
  tree: '<path d="M12 2 7 11h3l-4 6h12l-4-6h3L12 2z"/><path d="M11 17h2v4h-2z"/>',
  burst:
    '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  crown: '<path d="M3 8l3.5 9h11L21 8l-5 4-4-7-4 7-5-4z"/>',
  heart:
    '<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1z"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6"/>',
  snow: '<path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19"/>',
  flower:
    '<circle cx="12" cy="12" r="2.5"/><path d="M12 4a2.6 2.6 0 0 1 0 5M12 15a2.6 2.6 0 0 1 0 5M4 12a2.6 2.6 0 0 1 5 0M15 12a2.6 2.6 0 0 1 5 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
  tag: '<path d="M20.6 13.4 12 22l-9-9V4h9l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1"/>',
} as const;

export const DECO_GLYPHS = {
  snow: ["❄", "❅", "❆", "•"],
  leaves: ["🍂", "🍁", "🍃"],
  petals: ["🌸", "🌼", "🌷"],
  hearts: ["❤️", "💕", "💗"],
  sun: ["🌞", "☀️", "✨"],
  sparkle: ["✨", "⭐", "✦"],
  bats: ["🦇", "🕸️", "🎃"],
} as const;

export const SEASONS: Record<SeasonKey, SeasonDef> = {
  none: {
    label: "Marca Hefesto",
    emoji: "🏛️",
    icon: SEASON_ICONS.brand,
    accent: "#C9A84C",
    accent2: "#A8863A",
    deco: null,
    hint: "Tu identidad dorada de siempre",
  },
  navidad: {
    label: "Navidad",
    emoji: "🎄",
    icon: SEASON_ICONS.tree,
    accent: "#D7263D",
    accent2: "#2E8B57",
    deco: "snow",
    hint: "Rojo y verde + nieve cayendo",
  },
  anionuevo: {
    label: "Año Nuevo",
    emoji: "🎆",
    icon: SEASON_ICONS.burst,
    accent: "#C9A84C",
    accent2: "#8E6F2E",
    deco: "sparkle",
    hint: "Dorado brillante + destellos",
  },
  reyes: {
    label: "Reyes Magos",
    emoji: "👑",
    icon: SEASON_ICONS.crown,
    accent: "#7B4DB3",
    accent2: "#C9A84C",
    deco: "sparkle",
    hint: "Violeta real + destellos dorados",
  },
  sanvalentin: {
    label: "San Valentín",
    emoji: "❤️",
    icon: SEASON_ICONS.heart,
    accent: "#E63956",
    accent2: "#B0244A",
    deco: "hearts",
    hint: "Rojo pasión + corazones",
  },
  otonio: {
    label: "Otoño",
    emoji: "🍂",
    icon: SEASON_ICONS.leaf,
    accent: "#C26B27",
    accent2: "#8A4B1E",
    deco: "leaves",
    hint: "Naranjas terrosos + hojas",
  },
  invierno: {
    label: "Invierno",
    emoji: "❄️",
    icon: SEASON_ICONS.snow,
    accent: "#3E7CB1",
    accent2: "#2C5A82",
    deco: "snow",
    hint: "Azules fríos + nieve",
  },
  primavera: {
    label: "Primavera",
    emoji: "🌸",
    icon: SEASON_ICONS.flower,
    accent: "#E29ABF",
    accent2: "#B96E96",
    deco: "petals",
    hint: "Rosados suaves + pétalos",
  },
  verano: {
    label: "Verano",
    emoji: "🌞",
    icon: SEASON_ICONS.sun,
    accent: "#E0A82E",
    accent2: "#B5851F",
    deco: "sun",
    hint: "Amarillos cálidos + sol",
  },
  halloween: {
    label: "Halloween",
    emoji: "🎃",
    icon: SEASON_ICONS.moon,
    accent: "#E8741E",
    accent2: "#6A2C91",
    deco: "bats",
    hint: "Naranja calabaza + murciélagos",
  },
  patrias: {
    label: "Fiestas Patrias",
    emoji: "🇦🇷",
    icon: SEASON_ICONS.flag,
    accent: "#6CA9DC",
    accent2: "#4A86C0",
    deco: "sparkle",
    hint: "Celeste y blanco + destellos",
  },
  blackfriday: {
    label: "Black Friday",
    emoji: "🛍️",
    icon: SEASON_ICONS.tag,
    accent: "#E0A82E",
    accent2: "#1A1A1A",
    deco: "sparkle",
    hint: "Negro y dorado · alto impacto",
  },
};

export function getSeason(key: string | null | undefined): SeasonDef {
  return SEASONS[(key as SeasonKey) ?? "none"] ?? SEASONS.none;
}

/** Acento efectivo: el de la temporada si hay una activa, si no el custom. */
export function effectiveAccent(
  season: string | null | undefined,
  accentColor: string | null | undefined,
): string | null {
  if (season && season !== "none") return getSeason(season).accent;
  return accentColor ?? null;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((x) => clamp(x).toString(16).padStart(2, "0")).join("");

/** Aclara (pct>0) u oscurece (pct<0) un hex. */
export function shade(hex: string, pct: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const f = pct / 100;
  const adj = (c: number) => (f >= 0 ? c + (255 - c) * f : c * (1 + f));
  return toHex(adj(rgb[0]), adj(rgb[1]), adj(rgb[2]));
}

export function hexToRgbString(hex: string): string | null {
  const rgb = hexToRgb(hex);
  return rgb ? `${rgb[0]}, ${rgb[1]}, ${rgb[2]}` : null;
}
