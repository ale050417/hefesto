import { create } from "zustand";

export type AuthMode = "login" | "register";

type UiState = {
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;

  /** Lista de consulta (vidriera digital): el "carrito" cuando no hay compra online. */
  inquiryOpen: boolean;
  openInquiry: () => void;
  closeInquiry: () => void;

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

  inquiryOpen: false,
  openInquiry: () => set({ inquiryOpen: true }),
  closeInquiry: () => set({ inquiryOpen: false }),

  favOpen: false,
  openFav: () => set({ favOpen: true }),
  closeFav: () => set({ favOpen: false }),

  authOpen: false,
  authMode: "login",
  openAuth: (mode = "login") => set({ authOpen: true, authMode: mode }),
  setAuthMode: (mode) => set({ authMode: mode }),
  closeAuth: () => set({ authOpen: false }),
}));
