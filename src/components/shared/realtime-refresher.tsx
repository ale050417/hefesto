"use client";

import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

/**
 * Componente utilitario para páginas server: se monta invisible y refresca la
 * vista cuando hay filas nuevas en `table` (ej. bandeja de /admin/medida).
 */
export function RealtimeRefresher(props: {
  table: string;
  filter?: string;
  pollMs?: number;
}) {
  useRealtimeRefresh(props);
  return null;
}
