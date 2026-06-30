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
  color: string | null;
  quantity: number;
};

export type AppliedCoupon = { code: string; discount: number };

type CartState = {
  items: CartItem[];
  appliedCoupon: AppliedCoupon | null;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
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
  setCoupon: (coupon: AppliedCoupon | null) => void;
  clear: () => void;
};

function isSameLine(
  item: CartItem,
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

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      appliedCoupon: null,
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
      setCoupon: (coupon) => set({ appliedCoupon: coupon }),
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
