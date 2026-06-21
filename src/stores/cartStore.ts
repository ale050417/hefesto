import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  unitPrice: number; // precio de referencia (el real lo recalcula el servidor)
  image: string | null;
  variantId: string | null;
  variantLabel: string | null;
  quantity: number;
};

export type AppliedCoupon = { code: string; discount: number };

type CartState = {
  items: CartItem[];
  appliedCoupon: AppliedCoupon | null;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: string, variantId: string | null) => void;
  setQuantity: (
    productId: string,
    variantId: string | null,
    quantity: number,
  ) => void;
  setCoupon: (coupon: AppliedCoupon | null) => void;
  clear: () => void;
};

function isSameLine(
  item: CartItem,
  productId: string,
  variantId: string | null,
): boolean {
  return item.productId === productId && item.variantId === variantId;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      appliedCoupon: null,
      addItem: (item, quantity = 1) =>
        set((state) => {
          const exists = state.items.some((i) =>
            isSameLine(i, item.productId, item.variantId),
          );
          if (exists) {
            return {
              items: state.items.map((i) =>
                isSameLine(i, item.productId, item.variantId)
                  ? { ...i, quantity: i.quantity + quantity }
                  : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity }] };
        }),
      removeItem: (productId, variantId) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !isSameLine(i, productId, variantId),
          ),
        })),
      setCoupon: (coupon) => set({ appliedCoupon: coupon }),
      setQuantity: (productId, variantId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter(
                (i) => !isSameLine(i, productId, variantId),
              ),
            };
          }
          return {
            items: state.items.map((i) =>
              isSameLine(i, productId, variantId) ? { ...i, quantity } : i,
            ),
          };
        }),
      clear: () => set({ items: [], appliedCoupon: null }),
    }),
    { name: "hefesto-cart" },
  ),
);

/** Cantidad total de ítems (para el badge del header). */
export const selectItemCount = (state: CartState): number =>
  state.items.reduce((total, item) => total + item.quantity, 0);

/** Subtotal de referencia (el monto real lo recalcula el servidor). */
export const selectSubtotal = (state: CartState): number =>
  state.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
