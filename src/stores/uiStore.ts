import { create } from "zustand";

export type AuthMode = "login" | "register";

type UiState = {
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;

  // Popover "agregado al carrito" que sale del ícono (en vez del cajón lateral).
  cartFlash: boolean;
  flashCart: () => void;
  closeFlash: () => void;

  favOpen: boolean;
  openFav: () => void;
  closeFav: () => void;

  authOpen: boolean;
  authMode: AuthMode;
  openAuth: (mode?: AuthMode) => void;
  setAuthMode: (mode: AuthMode) => void;
  closeAuth: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  cartOpen: false,
  openCart: () => set({ cartOpen: true }),
  closeCart: () => set({ cartOpen: false }),

  cartFlash: false,
  flashCart: () => set({ cartFlash: true, cartOpen: false }),
  closeFlash: () => set({ cartFlash: false }),

  favOpen: false,
  openFav: () => set({ favOpen: true }),
  closeFav: () => set({ favOpen: false }),

  authOpen: false,
  authMode: "login",
  openAuth: (mode = "login") => set({ authOpen: true, authMode: mode }),
  setAuthMode: (mode) => set({ authMode: mode }),
  closeAuth: () => set({ authOpen: false }),
}));
