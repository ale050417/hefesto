export type ChooserVariant = {
  id: string;
  label: string;
  price: number | null;
  /** Matriz tamaño × color: precio del color DENTRO de este tamaño. */
  colorPrices: Record<string, number>;
};

/**
 * Lo mínimo para elegir tamaño/color y saber cuánto sale. Lo usan la página del
 * producto y el modal rápido del catálogo (que lo pide con una server action al
 * abrirse, no al cargar el catálogo).
 */
export type ChooserProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  salePrice: number | null;
  isOnSale: boolean;
  image: string | null;
  variants: ChooserVariant[];
  colorMode: "single" | "multi";
  colors: string[];
  colorPrices: Record<string, number>;
  /** Nombre del color → su hex REAL del catálogo (Filamentos), no un genérico. */
  colorHex: Record<string, string>;
};
