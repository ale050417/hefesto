// Catálogo de opciones para filamentos (tal cual el index).

export const FILAMENT_MATERIALS = [
  "PLA",
  "PLA mate",
  "PLA translúcido",
  "PLA arcoíris",
  "PETG",
  "PETG reforzado",
  "TPU",
  "TPU + PLA",
  "Resina",
  "Resina 8K",
  "ABS",
];

export const FILAMENT_COLORS = [
  { n: "Negro", c: "#1a1a1f" },
  { n: "Blanco", c: "#f4f4f0" },
  { n: "Dorado", c: "#C9A84C" },
  { n: "Gris", c: "#8b8b95" },
  { n: "Rojo", c: "#d14b3c" },
  { n: "Azul", c: "#3a72c4" },
  { n: "Verde", c: "#3fa46a" },
  { n: "Galaxia", c: "#4b3a78" },
  { n: "Translúcido", c: "#cfe6ee" },
  { n: "Arcoíris", c: "#d98a5a" },
];

export const FILAMENT_BRANDS = [
  "Grilon3",
  "Print3D",
  "3N3",
  "eSun",
  "Bambu Lab",
  "Hellbot",
  "Genérico",
];

export const FILAMENT_DIAMETERS = ["1.75", "2.85", "—"];

export const FAIL_REASONS = [
  "Corte de luz",
  "Boquilla tapada",
  "Despegue de la cama",
  "Filamento enredado",
  "Error del modelo",
  "Calibración",
  "Otro",
];

/** Hex del color por nombre (fallback gris). */
export function filColor(name: string): string {
  return FILAMENT_COLORS.find((x) => x.n === name)?.c ?? "#888";
}
