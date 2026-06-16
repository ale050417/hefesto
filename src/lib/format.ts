const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** Formatea un número como precio en pesos argentinos: 3800 -> "$3.800". */
export function formatPrice(value: number): string {
  return arsFormatter.format(value);
}
