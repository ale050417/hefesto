# Documento 6 — Cobertura de tests

**Proyecto:** Hefesto 3D · **Fecha:** 2026-07-06 · **Doc 6 de 15.**
**Fuente:** 20 archivos `*.test.ts` (Vitest, colocados en `src/`) + `tests/`.

## Panorama

| Tipo                      | Ubicación                                | Estado                              |
| ------------------------- | ---------------------------------------- | ----------------------------------- |
| **Unitarios** (Vitest)    | `src/**/*.test.ts` (20 archivos)         | ✅ Fuerte en lógica pura de negocio |
| **E2E** (Playwright)      | `tests/e2e/*.spec.ts` (2: compra, cupón) | 🟡 Solo 2 flujos felices            |
| **Integración** (DB real) | `tests/integration/`                     | 🔴 **Vacío** (solo `.gitkeep`)      |

`tests/unit`, `tests/fixtures`, `tests/helpers` están **scaffoldeados pero
vacíos**; los unitarios reales viven junto al código (patrón colocado).

## Cobertura de dinero y stock (foco pedido)

Módulos puros/servicio con tests (nº de casos):

| Módulo                                   | Qué cubre                                                | Casos           |
| ---------------------------------------- | -------------------------------------------------------- | --------------- |
| `calculator/calculator.test.ts`          | Pricing: costo por filamento, margen, cotización         | **17**          |
| `earnings/economics.test.ts`             | Amortización, economía de pedido, **reparto de socios**  | **13**          |
| `inventory/service.test.ts`              | Stock en gramos, nunca <0, umbral, registrar falla       | **15**          |
| `orders/services/orderService.test.ts`   | **Recalcular total real**, cupón, variantes, color       | **18**          |
| `orders/services/manualSale.test.ts`     | Costos/ganancia de venta manual                          | **19**          |
| `orders/services/paymentService.test.ts` | Inicio/confirmación/cancelación de pago                  | **9**           |
| `orders/services/orderWorkflow.test.ts`  | Máquina de estados + paidAt                              | (state machine) |
| `orders/services/orderDelete.test.ts`    | Borrado en cualquier estado + masivo (con repo mockeado) | **4**           |
| `discounts/service.test.ts`              | Validación de cupón (vigencia/usos/mínimo)               | **9**           |
| `rewards/points.test.ts`                 | Puntos ganados / canje                                   | **4**           |

**Veredicto:** la lógica que toca plata y stock está **bien cubierta a nivel
puro/servicio** (con inyección de dependencias y repos falsos). Es exactamente
donde más importa.

## Otros unitarios

`core/auth/permissions.test.ts` (matriz de permisos), `core/payments/mercadopago.test.ts`
(firma/preferencia), `core/security/rate-limit.test.ts`, `core/observability`,
`custom/quote` + `custom/transitions`, `customers/tier`, `reviews/service`,
`reports/service`, `orders/services/orderEmails`.

## Gaps (qué NO está testeado)

1. 🔴 **`repository.deleteOrder` (transaccional) sin test directo.** El borrado
   de pedidos revierte `coupons.used_count` y borra `point_transactions` dentro
   de una transacción — **código nuevo y crítico para plata**. Hoy solo se testea
   `deleteOrderAdmin`/`deleteOrdersAdmin` con el **repo mockeado**, así que la
   reversa real (SQL + transacción) **no tiene cobertura**. → Recomendado: test de
   **integración** contra una base de prueba que verifique que borrar un pedido
   pagado con cupón y puntos deja `used_count` y saldo correctos.
2. 🔴 **Integración = 0.** La carpeta existe pero está vacía. Nada valida repos +
   DB reales (RLS, FKs, transacciones). Es la deuda de test más importante.
3. 🟡 **Autorización de actions sin test.** No hay test que verifique que un
   no-admin recibe UNAUTHORIZED al borrar/cancelar. La lógica de `resolveAllowed`
   sí está testeada, pero no el cableado en las actions.
4. 🟡 **E2E mínimo** (2 flujos). Faltan: checkout con MP (mock), gestión de
   pedido admin, alta de producto, borrado de pedido, "a medida".
5. 🟢 **Componentes sin test** (esperable en esta estrategia; el foco es lógica).

## Recomendaciones priorizadas

| Prioridad | Test a agregar                                                          |
| --------- | ----------------------------------------------------------------------- |
| 🔴 Alta   | Integración de `deleteOrder` (reversa puntos/cupón) contra DB de prueba |
| 🔴 Alta   | Suite de integración mínima: crear pedido → pagar → confirmar → borrar  |
| 🟡 Media  | Tests de authz en actions críticas (borrar/cancelar/reembolsar)         |
| 🟡 Media  | E2E de checkout MP (sandbox) y de gestión de pedido                     |

_Fin del Documento 6._
