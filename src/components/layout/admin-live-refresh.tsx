"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/core/supabase/browser";

/**
 * El panel se actualiza SOLO (2026-07-29, pedido de Ale: "si mi empleado carga
 * algo, quiero verlo sin tener que recargar").
 *
 * Escucha los cambios de las tablas que mueven el panel (Supabase Realtime) y
 * pide un `router.refresh()`: los server components vuelven a leer y la
 * pantalla se actualiza sin perder lo que el usuario tenga escrito (React
 * conserva el estado del cliente; un modal abierto sigue abierto).
 *
 * Cuidados, porque esto corre en TODAS las pantallas del panel:
 * - **Una sola conexión**: un canal con varias escuchas, no un canal por tabla.
 * - **Anti-ráfaga**: al importar un lote entran decenas de filas de golpe; se
 *   agrupa todo en un solo refresh (`BURST_MS`).
 * - **Nunca encimado**: si el refresh anterior sigue en curso, se pospone (la
 *   base tiene pocas conexiones; encimar refrescos fue lo que tiró producción
 *   en julio).
 * - **Pestaña oculta = no se hace nada**: al volver a la pestaña se refresca
 *   una vez si quedó algo pendiente.
 * - **Respaldo por si Realtime no está**: si la tabla no está publicada en
 *   Realtime, igual se refresca cada `pollMs`. Así funciona siempre, aunque sea
 *   con unos segundos de demora.
 */

/** Tablas que cambian lo que se ve en el panel. */
const LIVE_TABLES = [
  "orders",
  "order_items",
  "order_status_history",
  "manual_sales",
  "products",
  "product_variants",
  "product_images",
  "categories",
  "filaments",
  "filament_movements",
  "print_failures",
  "print_jobs",
  "reviews",
  "custom_requests",
  "coupons",
  "rewards",
] as const;

const BURST_MS = 1_200;

export function AdminLiveRefresh({ pollMs = 45_000 }: { pollMs?: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // El valor vivo de isPending, para leerlo desde los timers sin tener que
  // recrear el efecto (y con él la conexión) en cada refresh. Se sincroniza en
  // su propio efecto: escribir un ref DURANTE el render no está permitido.
  const pendingRef = useRef(false);
  useEffect(() => {
    pendingRef.current = isPending;
  }, [isPending]);

  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    let burstTimer: ReturnType<typeof setTimeout> | undefined;
    let dirty = false;
    let realtimeOk = false;

    const flush = () => {
      if (disposed || !dirty) return;
      // Pestaña en segundo plano: se espera a que vuelva (visibilitychange).
      if (document.hidden) return;
      // Refresh anterior sin terminar: se reintenta en un rato en vez de
      // encimarlo (la base tiene pocas conexiones). Sin esto, un cambio que
      // llegara justo durante un refresh se perdía hasta el siguiente evento.
      if (pendingRef.current) {
        if (burstTimer) clearTimeout(burstTimer);
        burstTimer = setTimeout(flush, BURST_MS);
        return;
      }
      dirty = false;
      startTransition(() => router.refresh());
    };

    const markDirty = () => {
      dirty = true;
      if (burstTimer) clearTimeout(burstTimer);
      burstTimer = setTimeout(flush, BURST_MS);
    };

    // UN canal con una escucha por tabla (todas las escuchas van ANTES del
    // subscribe: agregarlas después tira error).
    let channel = supabase.channel("admin-live");
    for (const table of LIVE_TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        markDirty,
      );
    }
    channel.subscribe((status) => {
      realtimeOk = status === "SUBSCRIBED";
    });

    // Respaldo: si Realtime no llegó a suscribirse, refrescamos igual cada
    // tanto para no depender de él.
    const interval = setInterval(() => {
      if (!realtimeOk) markDirty();
    }, pollMs);

    // Al volver a la pestaña, aplicar lo que haya quedado pendiente.
    const onVisible = () => {
      if (!document.hidden) flush();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      if (burstTimer) clearTimeout(burstTimer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [router, pollMs]);

  return null;
}
