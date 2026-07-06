# Documento 4 — Inventario de API / rutas

**Proyecto:** Hefesto 3D · **Fecha:** 2026-07-06 · **Doc 4 de 15.**

En Hefesto la "API" son mayormente **Server Actions** (Next App Router), no
endpoints REST. Solo hay 3 rutas HTTP reales (`route.ts`). Cada action valida
autorización y (cuando muta datos) con Zod, **en el servidor**.

## Rutas HTTP (`route.ts`)

| Ruta                       | Método | Valida                                | Authz                                                      | Notas                                   |
| -------------------------- | ------ | ------------------------------------- | ---------------------------------------------------------- | --------------------------------------- |
| `api/webhooks/mercadopago` | POST   | Firma HMAC (`verifyWebhookSignature`) | Firma; en prod el secret es **obligatorio** (500 si falta) | Idempotente; confirma pago SOLO acá. ✅ |
| `api/health`               | GET    | —                                     | Público                                                    | Healthcheck. OK.                        |
| `auth/callback`            | GET    | Supabase                              | Supabase Auth                                              | Callback OAuth/email. OK.               |

## Server Actions por feature (authz + Zod)

Conteo de guardas de autorización y de `safeParse` (Zod) por archivo de actions:

| Feature (actions)         | Guardas de autorización                                                                               | Zod `safeParse` | Veredicto                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------ |
| `auth`                    | `getCurrentUser` + **rate-limit** (login/register/reset/changepw)                                     | 4               | ✅                                               |
| `calculator`              | `can(calculadora, ver/crear/editar/eliminar)`, `isAdmin`×2, `getCurrentUser`                          | 4               | ✅                                               |
| `custom`                  | `can(medida, editar/eliminar)`, `isStaff`×2, `getCurrentUser`×4                                       | 3               | ✅ (ownership + staff)                           |
| `customers`               | `can(clientes, crear/editar)`, `getCurrentUser`×6                                                     | 6               | ✅                                               |
| `discounts`               | `can(descuentos, editar/eliminar)`, rate-limit (validar cupón)                                        | 1               | ✅                                               |
| `earnings`                | `can(ganancias, crear/editar/eliminar)`                                                               | 3               | ✅                                               |
| `inventory`               | `can(filamentos/fallas, editar/eliminar/crear)`                                                       | 3               | ✅                                               |
| `notifications`           | `getCurrentUser`×2                                                                                    | 0               | ✅ (datos propios; sin payload que validar)      |
| `orders`                  | `can(pedidos, crear/editar)`, **`isAdmin`×4** (borrar + cancel/refund), `isStaff`, `getCurrentUser`×7 | 4               | ✅                                               |
| `production`              | `can(produccion, crear/editar)`                                                                       | **0**           | 🟡 sin Zod (ver abajo)                           |
| `products`                | `can(productos, ver/crear/editar/eliminar)`, `getStaffUser`×8                                         | 9               | ✅                                               |
| `products/search-actions` | —                                                                                                     | 0               | ✅ **público por diseño** (búsqueda de catálogo) |
| `reports`                 | `can(reportes, ver)`                                                                                  | 0               | ✅ (solo lectura/CSV)                            |
| `reviews`                 | `can(resenas, editar/eliminar)`, `getCurrentUser`                                                     | 1               | ✅                                               |
| `rewards`                 | `can(recompensas, crear/editar/eliminar)`, `getCurrentUser`                                           | 2               | ✅                                               |
| `settings`                | `can(config, editar)`×9, `getCurrentUser`                                                             | 13              | ✅ (la más robusta)                              |
| `wishlist`                | `getCurrentUser`×4                                                                                    | 0               | ✅ (datos propios)                               |

### Patrones correctos

- **Autorización siempre en el servidor.** Ninguna action confía en la UI:
  `can("modulo","accion")` o `isAdmin()`/`isStaff()`/ownership por
  `getCurrentUser`.
- **Acciones que tocan plata = solo admin.** Borrar pedido, cancelar y reembolsar
  chequean `isAdmin()` (orders: 4 usos).
- **Rate-limit** en las superficies sensibles de auth y en validar cupón.
- **Productos** usa `getStaffUser` (staff resuelto una vez) + Zod en 9 puntos.
- **Settings** valida 13 payloads distintos con Zod.

### Puntos a revisar

1. 🟡 **`production/actions.ts` sin Zod (`safeParse` 0).** Recibe ids y enums de
   estado (`printerStatus`/`jobStatus`). Aunque `can(produccion,...)` protege el
   acceso, el payload (p. ej. el status) debería validarse con Zod para no
   confiar en el string del cliente. Riesgo bajo (enums de DB rechazarían un
   valor inválido), pero es inconsistente con el resto. → Doc 10.
2. ✅ **`search-actions` público**: correcto, expone solo catálogo publicado.
3. 🟡 **`reports`/`notifications`/`wishlist` con 0 Zod**: aceptable (lectura o
   datos propios con params triviales), pero conviene validar los rangos de
   fecha/año del export de reportes.
4. ✅ **Webhook MP**: verificación de firma + idempotencia + secret obligatorio
   en prod. Bien resuelto (detalle en Doc 8).

## Exposición pública (¿algo público que no debería?)

| Superficie                                        | ¿Pública?                                                  | ¿Correcto?            |
| ------------------------------------------------- | ---------------------------------------------------------- | --------------------- |
| Catálogo, producto, home, búsqueda                | Sí                                                         | ✅ (datos publicados) |
| Checkout / crear pedido                           | Requiere sesión (`getCurrentUser`)                         | ✅                    |
| Webhook MP                                        | Sí, pero firmado                                           | ✅                    |
| Health                                            | Sí                                                         | ✅                    |
| Todo `/admin/*`                                   | Gateado por `requirePermissionPage` + sidebar por permisos | ✅                    |
| Acciones admin (settings, products, orders, etc.) | No — `can(...)`/`isAdmin`                                  | ✅                    |

No se detectó ninguna action mutante pública sin autorización.

_Fin del Documento 4._
