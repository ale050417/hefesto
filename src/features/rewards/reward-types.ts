// Metadatos visuales de cada tipo de recompensa (label, color, ícono SVG).

export type RewardTypeKey = "shipping" | "discount" | "product";

export const REWARD_TYPES: Record<
  RewardTypeKey,
  { label: string; color: string; icon: string }
> = {
  shipping: {
    label: "Envío gratis",
    color: "#5A9CD9",
    icon: '<rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  },
  discount: {
    label: "Descuento",
    color: "#C9A84C",
    icon: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  },
  product: {
    label: "Producto gratis",
    color: "#9B7BD4",
    icon: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  },
};
