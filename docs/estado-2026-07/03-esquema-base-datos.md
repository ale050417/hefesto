# Documento 3 — Esquema de base de datos + RLS

**Proyecto:** Hefesto 3D · **Fecha:** 2026-07-06 · **Doc 3 de 15.**
**Fuente:** `src/core/db/schema/*` (Drizzle) + `src/core/db/migrations/*.sql`.

## Estado general

- **~37 tablas** (una por archivo de schema, salvo `tags.ts` que define `tags` +
  `product_tags`). Enums, relations y el barrel no son tablas.
- **36 migraciones** (`0000`–`0035`), gestionadas por Drizzle Kit (`meta/` = journal).
- **RLS: cubre las 37 tablas.** Se activó por olas: base (0004), pedidos (0006),
  cuenta/inventario/cupones (0009–0011), y dos hardenings grandes
  (**0032_rls_hardening** = 9 tablas, **0035_delete_hardening** = roles +
  calc_margin_presets). No se detectaron tablas sin RLS.
- ⚠ **Migraciones aplicadas vs pendientes:** no verificable desde el código
  (depende del estado real de la base Supabase). El repo tiene hasta `0035`;
  confirmar en Supabase que `0034`/`0035` (manual_sales.quantity y delete
  hardening) estén aplicadas — ver Doc 15 / checklist de deploy.

## Catálogo de tablas por dominio

Leyenda RLS: ✅ = RLS activada (con policy). Origen = migración que la creó
(aprox., por nombre de migración).

### Catálogo / productos

| Tabla                   | Rol                                          | RLS | Origen          |
| ----------------------- | -------------------------------------------- | --- | --------------- |
| `products`              | Producto (precio NOT NULL, status, material) | ✅  | 0000 / RLS 0004 |
| `categories`            | Categoría (obligatoria en producto)          | ✅  | 0000 / 0004     |
| `product_images`        | Imágenes (primaria)                          | ✅  | 0000 / 0004     |
| `product_variants`      | Variantes (tamaño/precio)                    | ✅  | 0000 / 0004     |
| `tags` / `product_tags` | Etiquetas N:M                                | ✅  | 0000 / 0004     |

### Pedidos / pagos

| Tabla                  | Rol                                               | RLS | Origen                |
| ---------------------- | ------------------------------------------------- | --- | --------------------- |
| `orders`               | Pedido (customer_id restrict; coupon_id set null) | ✅  | 0000 / RLS 0006       |
| `order_items`          | Líneas (FK cascade)                               | ✅  | 0006                  |
| `order_status_history` | Historial de estados (cascade)                    | ✅  | 0006                  |
| `order_messages`       | Chat pedido (cascade)                             | ✅  | 0015                  |
| `manual_sales`         | Ventas manuales/históricas                        | ✅  | 0032; `quantity` 0034 |
| `manual_customers`     | Clientes de venta manual                          | ✅  | 0032                  |
| `coupons`              | Cupones                                           | ✅  | 0011                  |
| `coupon_redemptions`   | Canjes (order_id set null)                        | ✅  | 0011                  |
| `point_transactions`   | Puntos (order_id set null)                        | ✅  | 0018; unique 0033     |

### Cuenta / clientes

| Tabla            | Rol                                     | RLS | Origen      |
| ---------------- | --------------------------------------- | --- | ----------- |
| `profiles`       | Perfil (rol enum, must_change_password) | ✅  | 0000 / 0004 |
| `addresses`      | Direcciones                             | ✅  | 0009        |
| `wishlist_items` | Favoritos                               | ✅  | 0009        |
| `notifications`  | Notificaciones in-app                   | ✅  | 0016        |
| `reviews`        | Reseñas (moderación)                    | ✅  | 0013        |
| `roles`          | Roles custom (permisos JSON)            | ✅  | RLS 0035    |

### Inventario / producción

| Tabla            | Rol                                       | RLS | Origen |
| ---------------- | ----------------------------------------- | --- | ------ |
| `filaments`      | Filamento (stock en gramos por color)     | ✅  | 0010   |
| `print_failures` | Impresiones fallidas                      | ✅  | 0010   |
| `printers`       | Impresoras                                | ✅  | 0019   |
| `print_jobs`     | Cola (order_id set null al borrar pedido) | ✅  | 0019   |

### Finanzas / config / calc

| Tabla                 | Rol                      | RLS | Origen          |
| --------------------- | ------------------------ | --- | --------------- |
| `profit_shares`       | Socios y reparto         | ✅  | 0032            |
| `cost_settings`       | Config de costos         | ✅  | 0032            |
| `payment_settings`    | Métodos de pago          | ✅  | 0032            |
| `shipping_settings`   | Envíos                   | ✅  | 0032            |
| `business_settings`   | Info/marca/apariencia    | ✅  | 0007 / RLS 0012 |
| `store_banners`       | Banners de la tienda     | ✅  | 0032            |
| `rewards`             | Catálogo de recompensas  | ✅  | 0018 / RLS 0032 |
| `calc_history`        | Historial de calculadora | ✅  | RLS 0032        |
| `calc_margin_presets` | Presets de margen        | ✅  | RLS 0035        |
| `audit_log`           | Bitácora de auditoría    | ✅  | 0008            |

## Migraciones de RLS (mapa)

| Migración               | Tablas que asegura                                                                                                                      | Policies |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `0004_rls_initial`      | products, categories, product_images, product_variants, tags, product_tags, profiles                                                    | 7        |
| `0006_rls_orders`       | orders, order_items, order_status_history                                                                                               | 3        |
| `0008_audit_log`        | audit_log                                                                                                                               | 1        |
| `0009_account`          | addresses, wishlist_items                                                                                                               | 3        |
| `0010_inventory`        | filaments, print_failures                                                                                                               | 2        |
| `0011_coupons`          | coupons, coupon_redemptions                                                                                                             | 2        |
| `0012_rls_settings`     | business_settings                                                                                                                       | 1        |
| `0013_reviews`          | reviews                                                                                                                                 | 1        |
| `0014_custom_requests`  | custom_requests, custom_messages                                                                                                        | 2        |
| `0015_order_messages`   | order_messages                                                                                                                          | 1        |
| `0016_notifications`    | notifications                                                                                                                           | 1        |
| `0018_rewards`          | point_transactions                                                                                                                      | 1        |
| `0019_printing`         | printers, print_jobs                                                                                                                    | 2        |
| `0032_rls_hardening`    | manual_sales, profit_shares, cost_settings, calc_history, manual_customers, payment_settings, store_banners, rewards, shipping_settings | 9        |
| `0035_delete_hardening` | roles, calc_margin_presets (+ soporte del borrado transaccional de pedidos)                                                             | —        |

## Integridad referencial destacada (money-safe)

- `orders.customer_id` → `profiles` **restrict**: no se borra un cliente con
  pedidos (preserva historial).
- `order_items`, `order_status_history`, `order_messages` → **cascade** al borrar
  el pedido.
- `coupon_redemptions.order_id` y `point_transactions.order_id` → **set null**
  por FK; **pero** el borrado de pedidos (`repository.deleteOrder`, 0035) los
  **borra explícitamente en transacción** y revierte `coupons.used_count`, para
  no inflar saldos de puntos ni dejar usos de cupón fantasma. Ver Doc 9.
- `print_jobs.order_id` → **set null** (se conserva el histórico de producción).

## Observaciones

1. RLS parece **completa** hoy; la validación real de las policies (que además
   sean correctas, no solo presentes) requiere revisar cada `CREATE POLICY` —
   se profundiza en el Doc 7 (seguridad).
2. `calc_history` y `calc_margin_presets` recibieron RLS tarde (0032/0035): OK
   ahora, pero fue deuda hasta esas migraciones.
3. Confirmar en la base que **0034 y 0035 estén aplicadas** (migraciones
   recientes ligadas a venta manual con cantidad y borrado de pedidos).

_Fin del Documento 3._
