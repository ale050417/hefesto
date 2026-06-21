# Hefesto 3D — Resumen de la Fase 8 (Cupones / descuentos)

Continúa donde terminó `FASE-7.md`. Explica **qué construimos**, **para qué** y
**cómo se conecta**.

> Resultado de la Fase 8: la tienda acepta **cupones** (% o monto fijo), con
> vigencia, límite de usos y compra mínima. La **validación es robusta y en el
> servidor**: el descuento se recalcula en el checkout y el cupón se **canjea de
> forma atómica** junto con el pedido.

---

## 1. La base de datos (migración 0011)

- **`coupons`** — `code` (único), `type` (`percentage` | `fixed`), `value`
  (CHECK > 0), `min_purchase`, `max_uses` (null = ilimitado), `used_count`,
  `starts_at`, `expires_at`, `is_active`.
- **`coupon_redemptions`** — registro de cada canje (cupón, pedido, cliente).
- **`orders.coupon_id`** — el pedido recuerda qué cupón usó.
- **RLS**: cupones y canjes los lee **solo el admin** (los códigos no son
  públicos). Verificado en pglite: rechaza valor 0 y código duplicado, el canje
  incrementa `used_count`, y el admin ve los cupones mientras un cliente no.

---

## 2. DiscountService (lógica) — Strategy + tests

Lógica **pura y testeada** (Cap. 15, toca dinero):

- **`computeDiscount(tipo, valor, subtotal)`** — Strategy: `percentage` o
  `fixed`; el descuento **nunca supera el subtotal**.
- **`validateCoupon(cupón, subtotal, ahora)`** — valida **activo, vigencia, usos
  y compra mínima**; si pasa, devuelve el descuento.

**9 tests** cubren % y fijo, tope en el subtotal, inactivo, no vigente, vencido,
agotado y por debajo del mínimo.

---

## 3. En el checkout

- **`CouponInput`** (en el carrito) ahora **valida de verdad**: llama a
  `validateCouponAction` (pública, **rate-limited** por IP), muestra el descuento
  o el error, y guarda el cupón aplicado en el store del carrito.
- **`OrderService.createOrder`** **revalida el cupón en el servidor** contra el
  subtotal recalculado (nunca confía en el cliente), aplica el descuento y, en la
  **misma transacción** que crea el pedido, **suma el uso** e inserta el canje
  (anti-abuso). Dos tests nuevos: cupón válido (descuento + total + canje) y
  cupón inexistente.

---

## 4. Gestión en el panel (admin)

- **`/admin/descuentos`** — tabla de cupones (código, descuento, usos, vencimiento)
  con **activar/desactivar** y edición.
- Alta/edición con `CouponForm` (tipo, valor, mínimo, usos, vigencia, activo).
- Las altas/ediciones quedan en la **auditoría**. Link **Descuentos** en el
  sidebar.

---

## 5. Tests E2E

- `tests/e2e/cupon.spec.ts`: aplicar un cupón inexistente en el carrito muestra
  el error (flujo público). Se corre local con `pnpm test:e2e` (requiere la app
  levantada y un producto publicado).

---

## 6. Control + relevamiento (cierre de fase)

- **Control:** typecheck ✅ · lint ✅ · format ✅ · **59 tests** ✅ · build ✅ ·
  migración validada en pglite (7/7).
- **Relevamiento:** reglas de dependencias OK (orders usa el **service** de
  discounts, no su repository); actions con guard + rate limiting; **17 tablas
  con RLS**; sin deudas nuevas.

---

## 7. Comandos y cómo probar

```bash
cd D:\Hefesto\Hefesto\hefesto
pnpm db:migrate     # aplica 0011 (coupons, coupon_redemptions, orders.coupon_id)
pnpm dev
```

- `/admin/descuentos` → creá un cupón (ej. `DESC10`, 10%, activo).
- En la tienda: agregá un producto, abrí el carrito, ingresá `DESC10` → se aplica
  el descuento. Al concretar el pedido, el total baja y el cupón suma un uso.

---

## 8. Qué sigue

**Fase 9 — Reportes** (ventas, métricas) y **Fase 10 — Deploy** (producción en
Vercel + dominio + MercadoPago real).

---

_Documento generado al cierre de la Fase 8. La fuente de verdad sigue siendo
`HEFESTO-Libro-Maestro.md`._
