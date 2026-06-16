const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** Formatea un número como precio en pesos argentinos: 3800 -> "$3.800". */
export function formatPrice(value: number): string {
  return arsFormatter.format(value);
}

/** Minutos a un texto legible: 45 -> "45 min", 180 -> "3 h", 90 -> "1 h 30 min". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
