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
  accent: string;
  accent2: string;
  deco: keyof typeof DECO_GLYPHS | null;
  hint: string;
};

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
    accent: "#C9A84C",
    accent2: "#A8863A",
    deco: null,
    hint: "Tu identidad dorada de siempre",
  },
  navidad: {
    label: "Navidad",
    emoji: "🎄",
    accent: "#D7263D",
    accent2: "#2E8B57",
    deco: "snow",
    hint: "Rojo y verde + nieve cayendo",
  },
  anionuevo: {
    label: "Año Nuevo",
    emoji: "🎆",
    accent: "#C9A84C",
    accent2: "#8E6F2E",
    deco: "sparkle",
    hint: "Dorado brillante + destellos",
  },
  reyes: {
    label: "Reyes Magos",
    emoji: "👑",
    accent: "#7B4DB3",
    accent2: "#C9A84C",
    deco: "sparkle",
    hint: "Violeta real + destellos dorados",
  },
  sanvalentin: {
    label: "San Valentín",
    emoji: "❤️",
    accent: "#E63956",
    accent2: "#B0244A",
    deco: "hearts",
    hint: "Rojo pasión + corazones",
  },
  otonio: {
    label: "Otoño",
    emoji: "🍂",
    accent: "#C26B27",
    accent2: "#8A4B1E",
    deco: "leaves",
    hint: "Naranjas terrosos + hojas",
  },
  invierno: {
    label: "Invierno",
    emoji: "❄️",
    accent: "#3E7CB1",
    accent2: "#2C5A82",
    deco: "snow",
    hint: "Azules fríos + nieve",
  },
  primavera: {
    label: "Primavera",
    emoji: "🌸",
    accent: "#E29ABF",
    accent2: "#B96E96",
    deco: "petals",
    hint: "Rosados suaves + pétalos",
  },
  verano: {
    label: "Verano",
    emoji: "🌞",
    accent: "#E0A82E",
    accent2: "#B5851F",
    deco: "sun",
    hint: "Amarillos cálidos + sol",
  },
  halloween: {
    label: "Halloween",
    emoji: "🎃",
    accent: "#E8741E",
    accent2: "#6A2C91",
    deco: "bats",
    hint: "Naranja calabaza + murciélagos",
  },
  patrias: {
    label: "Fiestas Patrias",
    emoji: "🇦🇷",
    accent: "#6CA9DC",
    accent2: "#4A86C0",
    deco: "sparkle",
    hint: "Celeste y blanco + destellos",
  },
  blackfriday: {
    label: "Black Friday",
    emoji: "🛍️",
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
