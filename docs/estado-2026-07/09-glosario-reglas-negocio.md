# Documento 9 — Glosario de reglas de negocio

**Proyecto:** Hefesto 3D · **Fecha:** 2026-07-06 · **Doc 9 de 15.**
Cómo están implementadas **hoy** las reglas de negocio, con archivo y función.
Deep-read de los módulos puros de dinero/stock.

---

## 1. Pricing por FILAMENTO (no por material)

**Regla:** el costo se calcula por filamento concreto (`filamentId`), no por el
material genérico. Los productos toman el costo de referencia del material (el
más caro / MAX) cuando no hay filamento puntual.

**Implementación:**

- `features/calculator/calculator.ts` → `resolveCostPerKg(...)`, `computeQuote(...)`,
  `computePrintPrice(...)`, `selectActiveMargin(...)`.
- El costo por kg se resuelve del filamento elegido; la calculadora cotiza **una
  pieza** y luego se escala por cantidad (venta manual).
- Alimentado por `inventory/queries.listFilamentsView` (de ahí el cruce
  calculator→inventory, Doc 2).

**Estado:** ✅ implementado y **testeado** (`calculator.test.ts`, 17 casos).
Amortización obligatoria en venta manual (si da 0, se rechaza — "nunca 0
silencioso", ver `orders/actions.createManualSaleAction`).

---

## 2. Categoría obligatoria + no borrar categoría en uso

**Regla:** todo producto requiere categoría; no se puede borrar una categoría con
productos.

**Implementación:**

- `features/products/actions.ts` → `createProductAction`/`updateProductAction`
  (Zod exige `categoryId`) y `deleteCategoryAction`.
- `features/products/services/catalogService.ts` + `repository.ts` (chequeo de
  productos asociados antes de borrar).
- Integridad reforzada por migración `0002`.

**Estado:** ✅ implementado (Zod + guard en servicio). Alineado con Cap. 9.

---

## 3. Stock en GRAMOS por color

**Regla:** el inventario se mide en gramos de filamento por color; nunca baja de
0; alerta bajo umbral. Los productos son **a pedido** (no descuentan stock de
producto; el stock es de filamento).

**Implementación (pura, deep-read):**

- `features/inventory/service.ts`:
  - `computeNewStock(current, gramsLost) = max(0, current - gramsLost)` — nunca <0.
  - `isLowStock(stock, threshold) = stock <= threshold`.
  - `filamentStatus()` → `agotado` (≤0) / `bajo` (≤umbral) / `ok`.
  - `registerFailure(...)`: si `deducted` y existe filamento de ese material+color,
    descuenta los gramos (transaccional en el repo, `registerFailureTx`).

**Estado:** ✅ implementado y **testeado** (`inventory/service.test.ts`, 15 casos).

---

## 4. Cupones (descuentos)

**Regla:** % o monto fijo; nunca supera el subtotal; valida vigencia, usos y
compra mínima. Anti-abuso por canje.

**Implementación (pura, deep-read):**

- `features/discounts/service.ts`:
  - `computeDiscount(type, value, subtotal)`: `percentage` → `subtotal*value/100`;
    `fixed` → `value`; **acota a `min(raw, subtotal)`** y redondea a 2 decimales.
  - `validateCoupon(coupon, subtotal, now)`: rechaza si `!isActive`, fuera de
    `startsAt/expiresAt`, `usedCount >= maxUses`, o `subtotal < minPurchase`.
- Canje registrado en `coupon_redemptions`; `used_count` se incrementa al usar y
  **se revierte al borrar el pedido** (ver regla 8).

**Estado:** ✅ implementado y **testeado** (`discounts/service.test.ts`, 9 casos).

---

## 5. Profit split (reparto de ganancias entre socios)

**Regla:** la **ganancia** (no la facturación) se reparte entre socios según sus
porcentajes; sobre pedidos entregados + ventas manuales cobradas.

**Implementación (pura):**

- `features/earnings/economics.ts`: `computeOrderEconomics`, `manualSaleEconomics`,
  `sharesTotal`, `distribute(...)` (reparte el total de ganancia según shares).
- `features/earnings/service.ts` → `getEarningsOverview` (agregación mensual).
- Config de costos en `cost_settings`; socios en `profit_shares`.

**Estado:** ✅ implementado y **testeado** (`earnings/economics.test.ts`, 13 casos).

---

## 6. Puntos y recompensas

**Regla:** 1 punto cada $100 de compra; 1 punto = $1 al canjear; se otorgan al
confirmar el pedido (idempotente).

**Implementación (pura, deep-read):**

- `features/rewards/points.ts`: `computePointsEarned = floor(total/100)`;
  `pointsToMoney = floor(points)*1`; `canRedeem(balance, points)`.
- `features/rewards/service.ts` → `awardForOrder` (otorga al pasar a `confirmed`);
  `repository.hasOrderAward` garantiza **idempotencia** (no doble otorgamiento).
- `point_transactions` con unique por pedido (migración `0033`).

**Estado:** ✅ implementado y **testeado** (`rewards/points.test.ts`).

---

## 7. Pedido: total real + máquina de estados

**Regla:** el total se recalcula **en el servidor** desde la base (nunca se confía
en el precio del navegador); las transiciones siguen una máquina de estados;
"enviado" exige código de seguimiento.

**Implementación:**

- `orders/services/orderService.ts` → `createOrder` (recalcula subtotal/total,
  aplica cupón, snapshots de precio, genera número, **transaccional**).
- `orders/services/orderWorkflow.ts` → `transitionOrderStatus` (valida tabla de
  transiciones + historial; marca `paidAt` al confirmar).
- `orders/services/orderAdminService.ts` → `transitionOrder` exige `trackingCode`
  para pasar a `shipped`.
- Tabla de transiciones: `orders/transitions.ts`.

**Estado:** ✅ implementado y **testeado** (`orderService.test.ts` 18,
`orderWorkflow.test.ts`).

---

## 8. Borrado de pedido con reversa (nuevo)

**Regla (rediseñada):** un admin puede **borrar cualquier pedido** (hard delete),
incluidos pagados/entregados, revirtiendo de forma **transaccional** lo que
generó. Sirve para limpiar pedidos mal creados/duplicados/de prueba.

**Implementación (deep-read):**

- `orders/repository.ts` → `deleteOrder(id)` en **transacción**:
  1. baja `coupons.used_count` (`greatest(used_count-1, 0)`) por cada redención y
     borra las redenciones;
  2. borra `point_transactions` del pedido (para que el saldo recompute correcto);
  3. borra el pedido (ítems/historial/chat cascadean; `print_jobs` → null).
- `orders/services/orderAdminService.ts` → `deleteOrderAdmin` (cualquier estado) y
  `deleteOrdersAdmin` (masivo).
- `orders/actions.ts` → `deleteOrderAction` **solo admin**.

**Estado:** ✅ implementado y **testeado a nivel servicio** (`orderDelete.test.ts`).
⚠ La **reversa transaccional real** (SQL) aún no tiene test de integración (Doc 6).
Es un **desvío intencional** del criterio previo (borrado restringido) → Doc 14.

---

## 9. Venta manual / histórica

**Regla:** el admin registra ventas de mostrador o previas sin pasar por checkout;
cliente por texto, total a mano, amortización obligatoria (por filamento), cantidad.

**Implementación:** `orders/services/manualSaleService.ts`
(`computeManualSaleCosts`, `createManualSale`), `manual_sales` (+ `quantity`,
migración `0034`), `manual_customers`.

**Estado:** ✅ implementado y **testeado** (`manualSale.test.ts`, 19 casos).

---

## Tabla resumen

| Regla                 | Archivo:función                                          | Test             |
| --------------------- | -------------------------------------------------------- | ---------------- |
| Pricing por filamento | `calculator/calculator.ts:resolveCostPerKg/computeQuote` | ✅               |
| Categoría obligatoria | `products/actions.ts` + `catalogService`                 | (indirecto)      |
| Stock en gramos       | `inventory/service.ts:computeNewStock/filamentStatus`    | ✅               |
| Cupones               | `discounts/service.ts:computeDiscount/validateCoupon`    | ✅               |
| Profit split          | `earnings/economics.ts:distribute`                       | ✅               |
| Puntos                | `rewards/points.ts` + `service.awardForOrder`            | ✅               |
| Total real + estados  | `orders/services/orderService.ts` + `orderWorkflow.ts`   | ✅               |
| Borrado con reversa   | `orders/repository.ts:deleteOrder`                       | 🟡 solo servicio |
| Venta manual          | `orders/services/manualSaleService.ts`                   | ✅               |

_Fin del Documento 9._
