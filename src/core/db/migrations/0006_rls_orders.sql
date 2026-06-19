-- RLS de pedidos (Cap. 10/13). La app entra con Drizzle (rol postgres,
-- BYPASSRLS); estas políticas son la red final para la API pública de Supabase.
-- Regla: cada cliente ve SOLO sus pedidos.

-- Pedidos: el cliente ve los suyos (customer_id = auth.uid()).
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "orders_select_own" ON "orders" FOR SELECT USING ((select auth.uid()) = "customer_id");--> statement-breakpoint

-- Ítems: visibles si el pedido padre es del cliente.
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "order_items_select_own" ON "order_items" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "orders" o
    WHERE o."id" = "order_items"."order_id"
      AND o."customer_id" = (select auth.uid())
  )
);--> statement-breakpoint

-- Historial: visible si el pedido padre es del cliente.
ALTER TABLE "order_status_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "order_status_history_select_own" ON "order_status_history" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "orders" o
    WHERE o."id" = "order_status_history"."order_id"
      AND o."customer_id" = (select auth.uid())
  )
);
