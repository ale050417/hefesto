import { create } from "zustand";

type WishlistState = {
  ids: string[];
  loaded: boolean;
  setIds: (ids: string[]) => void;
  setInWishlist: (id: string, on: boolean) => void;
};

export const useWishlistStore = create<WishlistState>((set) => ({
  ids: [],
  loaded: false,
  setIds: (ids) => set({ ids, loaded: true }),
  setInWishlist: (id, on) =>
    set((state) => ({
      ids: on
        ? Array.from(new Set([...state.ids, id]))
        : state.ids.filter((x) => x !== id),
    })),
}));
