# Documento 14 — Log de desvíos del libro maestro

**Proyecto:** Hefesto 3D · **Fecha:** 2026-07-06 · **Doc 14 de 15.**
Cada lugar donde el **código actual se aparta** de `HEFESTO-Libro-Maestro.md`,
con la razón (o "sin razón documentada"). Referencias cruzadas a Docs 2–13.

## Desvíos con razón documentada (decisiones deliberadas)

| #   | Desvío                                                           | Regla del libro                                                                                   | Razón                                                                                                                     | Acción                                                                  |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| D1  | **Borrado de pedidos: hard delete en cualquier estado + masivo** | Cap. 11: "operador no cancela/reembolsa"; espíritu money-safe (no destruir registros financieros) | Limpiar pedidos mal creados/duplicados/prueba; la **reversa transaccional** (puntos/cupón) lo hace seguro; **solo admin** | ✅ Actualizar Cap. 11 con la regla; agregar test de integración (Doc 6) |
| D2  | **Sentry/Analytics no cableado** (Fase 10, paso 68)              | Cap. 17: observabilidad; Cap. 18 F10                                                              | No sumar dependencia hasta el deploy (Cap. 4)                                                                             | Cablear en Fase 11                                                      |
| D3  | **Sin CSP** en headers                                           | Cap. 13/17: seguridad                                                                             | Evitar romper scripts inline de Next y checkout MP                                                                        | Definir CSP con nonce (Doc 7)                                           |
| D4  | **a-medida "en construcción"** (flag)                            | Cap. 15: pedidos a medida operativos                                                              | No ofrecer el flujo al público hasta pulirlo                                                                              | Reactivar flag cuando esté listo (ya en libro)                          |
| D5  | **Rate limit en memoria**                                        | Cap. 16: robustez                                                                                 | Simplicidad inicial; deuda conocida (relevamiento)                                                                        | Mover a store distribuido (Doc 7/10)                                    |

## Desvíos SIN razón documentada (revisar)

| #   | Desvío                                                                                                                                                         | Regla del libro                                                | Nota                                                               | Acción sugerida                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ |
| D6  | **Feature importa el data-layer de otro feature**: `calculator`/`reports` → `@/features/inventory/queries`; `orderService` → `@/features/discounts/repository` | Cap. 19: "un feature no importa el repository de otro feature" | Conveniencia; `inventory/queries` se usa como API pública de facto | Exponer vía servicio de `inventory`                    |
| D7  | **Ciclos entre features**: `products ↔ wishlist`; `orders → rewards → reports → orders`                                                                        | Cap. 19: dependencias solo hacia abajo                         | Acoplamiento no intencional                                        | Romper ciclos (Doc 2)                                  |
| D8  | **Doble puerta de datos**: `discounts` y `inventory` tienen `repository.ts` **y** `queries.ts`                                                                 | Cap. 5: "el repository es la ÚNICA puerta a la base"           | Posible duplicación o separación lectura/escritura no documentada  | Unificar o documentar la convención                    |
| D9  | **`production/actions.ts` sin Zod**                                                                                                                            | Regla innegociable: "Validación SIEMPRE en el servidor (Zod)"  | Recibe enums de estado sin `safeParse`                             | Agregar Zod                                            |
| D10 | **TanStack Query en el stack pero no instalado**                                                                                                               | Cap. 4: stack define TanStack Query                            | La arquitectura RSC + Server Actions no lo necesita                | Quitar del Cap. 4 o sumarlo si hay fetching de cliente |
| D11 | **shadcn/ui nominal vs implementación propia**                                                                                                                 | Cap. 4: "Tailwind + shadcn/ui"                                 | Se usa el patrón shadcn a mano (`cva`+`clsx`+`tailwind-merge`)     | Aclarar en Cap. 4                                      |
| D12 | **Alcance extra fuera del Cap. 18**: custom, rewards, earnings, production, venta manual, borrado                                                              | Cap. 18 termina en reportes/hardening                          | Evolución del producto; el libro quedó corto                       | Absorber estas epics en el Cap. 18                     |

## Desvíos menores / cosméticos

| #   | Desvío                                                                          | Acción                            |
| --- | ------------------------------------------------------------------------------- | --------------------------------- |
| D13 | `NEXT_PUBLIC_WHATSAPP_PHONE` fuera de `env.ts`                                  | Sumar al schema                   |
| D14 | `NEXT_PUBLIC_ANALYTICS_ID` declarada sin usar                                   | Cablear o quitar                  |
| D15 | `import type` desde repository en 3 componentes                                 | Reexportar tipos desde `types.ts` |
| D16 | `components/layout` y `components/home` no nombrados en niveles del Cap. 19     | Documentar en el libro            |
| D17 | Comentario desactualizado en `deleteOrderAction` (menciona "estados borrables") | Actualizar comentario             |
| D18 | `picsum.photos` en `remotePatterns` (demo)                                      | Quitar en prod                    |

## Síntesis

- **Desvíos deliberados y sanos:** D1–D5 (con razón; requieren sobre todo
  actualizar el libro y sumar tests/infra).
- **Desvíos a corregir en código:** D6–D9 (arquitectura/validación) son los que
  más conviene atacar para no erosionar las reglas del Cap. 5/19.
- **El libro necesita una pasada de actualización** (Cap. 4, 11, 18, 19) para
  reflejar el estado real: borrado de pedidos, features extra, stack real y
  convención de `queries.ts`.

_Fin del Documento 14._
