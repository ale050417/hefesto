"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/core/supabase/browser";

/**
 * Refresca la vista cuando entra una fila nueva en `table` (Supabase Realtime,
 * Fase 10). Pensado para los chats: el server component vuelve a leer los
 * mensajes y el hilo aparece actualizado sin tocar nada.
 *
 * - `filter`: filtro de Realtime (ej. `order_id=eq.<uuid>`) para escuchar solo
 *   el hilo abierto.
 * - Fallback: si el canal no logra suscribirse (Realtime caído/bloqueado), se
 *   hace polling suave cada `pollMs` (solo con la pestaña visible).
 */
export function useRealtimeRefresh({
  table,
  filter,
  pollMs = 30_000,
}: {
  table: string;
  filter?: string;
  pollMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let subscribed = false;
    let last = 0;
    const refresh = () => {
      // Anti-ráfaga: como mucho un refresh por segundo.
      const now = Date.now();
      if (now - last < 1_000 || document.hidden) return;
      last = now;
      router.refresh();
    };

    const channel = supabase
      .channel(`rt:${table}:${filter ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        refresh,
      )
      .subscribe((status) => {
        subscribed = status === "SUBSCRIBED";
      });

    const interval = setInterval(() => {
      if (!subscribed) refresh();
    }, pollMs);

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [table, filter, pollMs, router]);
}
