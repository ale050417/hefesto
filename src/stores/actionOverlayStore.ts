import { create } from "zustand";

/**
 * Estado global del overlay de acciones (la "H" bloqueante que se muestra
 * mientras corre un crear/editar/eliminar). Contador en vez de boolean para
 * soportar operaciones solapadas: el overlay se va recién cuando TODAS terminan.
 */
type ActionOverlayState = {
  pending: number;
  label: string | null;
  begin: (label?: string) => void;
  end: () => void;
};

export const useActionOverlayStore = create<ActionOverlayState>((set) => ({
  pending: 0,
  label: null,
  begin: (label) =>
    set((s) => ({ pending: s.pending + 1, label: label ?? s.label })),
  end: () =>
    set((s) => {
      const pending = Math.max(0, s.pending - 1);
      return { pending, label: pending === 0 ? null : s.label };
    }),
}));
