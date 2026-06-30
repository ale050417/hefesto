const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** Formatea un número como precio en pesos argentinos: 3800 -> "$3.800". */
export function formatPrice(value: number): string {
  return arsFormatter.format(value);
}

/** Precio compacto para stats: 365000 -> "$365k", 1200000 -> "$1.20M". */
export function compactPrice(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

/** Minutos a un texto legible: 45 -> "45 min", 180 -> "3 h", 90 -> "1 h 30 min". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
