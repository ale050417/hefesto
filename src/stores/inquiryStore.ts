import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Lista de CONSULTA para el modo "Vidriera digital" (Ale, 2026-08-09): un
 * carrito liviano que nunca cobra ni descuenta stock — solo junta productos
 * para armar UN mensaje de WhatsApp con todos al final. A propósito es un
 * store SEPARADO de `cartStore` (no comparte key de persist ni lógica): el
 * carrito real lo usan `checkout-stepper` y `orderService` para cobrar de
 * verdad, y mezclar los dos habría obligado a que esos archivos supieran
 * distinguir "es una compra" de "es una consulta" — el tipo de cambio que ya
 * rompió cosas antes en el carrito (ver notas de auditoría de checkout).
 */
export type InquiryItem = {
  productId: string;
  slug: string;
  name: string;
  unitPrice: number;
  image: string | null;
  variantId: string | null;
  variantLabel: string | null;
  color: string | null;
  quantity: number;
};

type InquiryState = {
  items: InquiryItem[];
  addItem: (item: Omit<InquiryItem, "quantity">, quantity?: number) => void;
  removeItem: (
    productId: string,
    variantId: string | null,
    color?: string | null,
  ) => void;
  setQuantity: (
    productId: string,
    variantId: string | null,
    quantity: number,
    color?: string | null,
  ) => void;
  clear: () => void;
};

function isSameLine(
  item: InquiryItem,
  productId: string,
  variantId: string | null,
  color: string | null,
): boolean {
  return (
    item.productId === productId &&
    item.variantId === variantId &&
    (item.color ?? null) === (color ?? null)
  );
}

export const useInquiryStore = create<InquiryState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item, quantity = 1) =>
        set((state) => {
          const exists = state.items.some((i) =>
            isSameLine(i, item.productId, item.variantId, item.color),
          );
          if (exists) {
            return {
              items: state.items.map((i) =>
                isSameLine(i, item.productId, item.variantId, item.color)
                  ? { ...i, quantity: i.quantity + quantity }
                  : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity }] };
        }),
      removeItem: (productId, variantId, color = null) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !isSameLine(i, productId, variantId, color),
          ),
        })),
      setQuantity: (productId, variantId, quantity, color = null) =>
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter(
                (i) => !isSameLine(i, productId, variantId, color),
              ),
            };
          }
          return {
            items: state.items.map((i) =>
              isSameLine(i, productId, variantId, color)
                ? { ...i, quantity }
                : i,
            ),
          };
        }),
      clear: () => set({ items: [] }),
    }),
    { name: "hefesto-inquiry" },
  ),
);

/** Cantidad total de ítems (para el badge del header). */
export const selectInquiryCount = (state: InquiryState): number =>
  state.items.reduce((total, item) => total + item.quantity, 0);

/** Total de referencia (el precio real se conversa por WhatsApp, no se cobra). */
export const selectInquirySubtotal = (state: InquiryState): number =>
  state.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
