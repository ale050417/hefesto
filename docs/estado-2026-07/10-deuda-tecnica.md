# Documento 10 — Deuda técnica

**Proyecto:** Hefesto 3D · **Fecha:** 2026-07-06 · **Doc 10 de 15.**

Nota positiva de arranque: **muy pocos marcadores `TODO`/`FIXME`/`HACK`** en el
código (2 `TODO` reales), casi sin `@ts-ignore`/`eslint-disable`. La deuda es más
arquitectónica/operativa que de "código sucio".

## Marcadores explícitos en el código

| Marcador                                             | Ubicación                              | Nota                                                               |
| ---------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| `TODO(deploy)`                                       | `core/observability/index.ts:19`       | Cablear Sentry cuando haya DSN (intencional)                       |
| `TODO`                                               | `features/custom/config.ts:6`          | Volver `CUSTOM_ORDERS_ENABLED` a `true` cuando a-medida esté listo |
| `eslint-disable-next-line @next/next/no-img-element` | `custom/components/chat-thread.tsx:99` | `<img>` en chat (aceptable)                                        |

## Deuda por severidad

### 🔴 Alta (tocar antes o durante producción)

1. **Rate limiting en memoria** (`core/security/rate-limit.ts`): no distribuido;
   ineficaz en serverless/multi-instancia. Falta además en checkout y formularios
   públicos. (Doc 7)
2. **Tests de integración = 0** (`tests/integration/` vacío). En particular, la
   **reversa transaccional de `deleteOrder`** (puntos/cupón) no tiene test real.
   Código nuevo que toca plata. (Doc 6)
3. **Reconciliación de pagos** ausente: pedido puede quedar en `pending_payment`
   si el webhook se pierde. (Doc 8)

### 🟡 Media

4. **Feature importa el data-layer de otro feature** (rompe regla Cap. 19):
   `calculator` y `reports` importan `@/features/inventory/queries`; `orderService`
   importa `@/features/discounts/repository` (dinámico). Exponer vía servicio. (Doc 2)
5. **Ciclos entre features**: `products ↔ wishlist`; `orders → rewards → reports →
orders`. Smell de acoplamiento. (Doc 2)
6. **Doble puerta de datos** en `discounts` (`repository.ts` + `queries.ts`) e
   `inventory` (`repository.ts` + `queries.ts`): posible duplicación; unificar o
   documentar la separación lectura/escritura.
7. **`production/actions.ts` sin Zod**: valida authz pero no el payload. (Doc 4)
8. **Sin CSP** en headers (deliberado pero pendiente de definir con nonce). (Doc 7)
9. **Comentario desactualizado**: `deleteOrderAction` dice "la regla de qué
   estados son borrables la valida el service" — ya **no aplica** tras pasar a
   hard-delete sin restricción. Actualizar el comentario.

### 🟢 Baja / cosmética

10. **`NEXT_PUBLIC_ANALYTICS_ID`** declarada en `env.ts` pero sin usar → config
    muerta; cablear analytics o quitar.
11. **`NEXT_PUBLIC_WHATSAPP_PHONE`** leída sin pasar por `env.ts`. (Doc 5)
12. **`import type` desde repository en 3 componentes** (calculator/notifications/
    production): reexportar esos tipos desde `types.ts`. (Doc 2)
13. **`picsum.photos`** en `next.config` `remotePatterns` (demo) → quitar en prod.
14. **Placeholders "en construcción"**: `admin/pedidos/importar` (import Excel/CSV)
    sin implementar; a-medida apagado por flag (intencional).

## Código muerto / naming

- No se detectó código muerto evidente por nombre; la verificación fina de
  imports sin uso la da `eslint`/`tsc` en Windows (el espejo del sandbox truncado
  no permite un análisis confiable acá).
- Naming general **consistente** (español + convención por capa). El único roce:
  `components/layout` y `components/home` no figuran explícitos en el Cap. 19 como
  niveles, aunque cumplen ese rol (más un tema de doc que de código).
- Reciente: `orders/components/order-actions.tsx` ahora exporta `DeleteOrderButton`
  (antes `OrderActions`); coherente con el rediseño de borrado.

## Recomendación de orden de pago de deuda

1. Test de integración de `deleteOrder` + suite mínima con DB de prueba.
2. Rate limit distribuido + cubrir checkout.
3. Reconciliación de pagos.
4. Romper ciclos / exponer inventory vía servicio.
5. Zod en production, CSP, limpieza cosmética.

_Fin del Documento 10._
