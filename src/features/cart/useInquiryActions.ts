"use client";

import { useInquiryStore, type InquiryItem } from "@/stores/inquiryStore";
import { toast } from "@/stores/toastStore";

type NuevoItem = Omit<InquiryItem, "quantity">;

/**
 * Vidriera digital: agregar un producto a la LISTA DE CONSULTA. No hay pago
 * ni carrito real acá — solo junta productos para el mensaje de WhatsApp
 * final (Ale, 2026-08-09). Ver `useCartActions` para el equivalente que sí
 * cobra.
 */
export function useInquiryActions() {
  const addItem = useInquiryStore((s) => s.addItem);

  const agregar = (item: NuevoItem, qty = 1) => {
    addItem(item, qty);
    toast(`${item.name} agregado a la lista de consulta`, "success");
  };

  return { agregar };
}
