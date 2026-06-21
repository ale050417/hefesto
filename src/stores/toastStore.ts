import { create } from "zustand";

export type ToastVariant = "default" | "success" | "danger";
export type Toast = { id: number; message: string; variant: ToastVariant };

type ToastState = {
  toasts: Toast[];
  push: (message: string, variant: ToastVariant) => number;
  remove: (id: number) => void;
};

let seq = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, variant) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }));
    return id;
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Muestra un aviso efímero (se auto-cierra). Llamable desde client components. */
export function toast(message: string, variant: ToastVariant = "default") {
  const { push, remove } = useToastStore.getState();
  const id = push(message, variant);
  setTimeout(() => remove(id), 3500);
}
