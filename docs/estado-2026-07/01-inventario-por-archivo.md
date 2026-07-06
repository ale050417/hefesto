# Documento 1 — Inventario por archivo

**Proyecto:** Hefesto 3D · **Fecha del relevamiento:** 2026-07-06
**Alcance:** todo `src/` (core, lib, features, app, components) + config raíz.
**Documento:** 1 de 15 de la serie _Estado 2026-07_.

## Método y límites (leer primero)

- Método aprobado: **eficiente con foco en riesgo**. Para cada archivo se
  extrajo su encabezado y sus símbolos exportados; se hizo **lectura profunda**
  (línea por línea) de lo que toca dinero, stock, auth, RLS y pagos. Donde
  **no** se leyó línea por línea se aclara; el resto se infiere de nombre +
  exports + rol en la arquitectura (Cap. 5/19) y del conocimiento ya acumulado
  del proyecto.
- **Advertencia técnica:** el espejo del sandbox sobre la carpeta montada está
  **truncando archivos ~a la mitad** al leerlos por shell (ej.: `ui/button.tsx`
  real ≈70 líneas se lee como 39). Por eso **no publico conteos de líneas por
  archivo** (serían poco confiables) y, en archivos grandes, la lista de exports
  puede estar incompleta. Los conteos agregados van con caveat. Las
  verificaciones definitivas se corren en Windows.
- **Área en obra:** el feature **orders** está en pleno rediseño del borrado de
  pedidos (borrado total + masivo). Lo marco como _en flujo_ donde corresponde;
  ver Doc 14 (desvíos) y Doc 10 (deuda).

## 0. Resumen cuantitativo

| Métrica                              | Valor (aprox.) |
| ------------------------------------ | -------------- |
| Archivos `.ts`/`.tsx` en `src/`      | ~363           |
| Features (`src/features/*`)          | 17             |
| Rutas (`page.tsx` + `route.ts`)      | 43             |
| Tablas de esquema (`core/db/schema`) | 40 archivos    |
| Migraciones SQL                      | 36             |
| Archivos de test                     | 20             |

> Los agregados pueden estar levemente subestimados por la truncación del
> espejo; el orden de magnitud es correcto.

---

## 1. Configuración raíz + middleware

| Archivo                | Qué hace                                                                      | Estado   | Alineación libro                      |
| ---------------------- | ----------------------------------------------------------------------------- | -------- | ------------------------------------- |
| `next.config.ts`       | Config de Next (imágenes, headers, etc.). Deep-read pendiente (ver Doc 5/7).  | —        | Cap. 4                                |
| `tsconfig.json`        | TS estricto, paths `@/*`.                                                     | Completo | Cap. 4 (TS estricto) ✅               |
| `eslint.config.mjs`    | Reglas ESLint (flat config).                                                  | Completo | Cap. 4                                |
| `drizzle.config.ts`    | Config Drizzle Kit (dialect, schema, migraciones).                            | Completo | Cap. 4 (Drizzle) ✅                   |
| `vitest.config.ts`     | Runner de unit tests.                                                         | Completo | Cap. 15 ✅                            |
| `playwright.config.ts` | Runner E2E.                                                                   | Presente | Cap. 15 (E2E) — cobertura real: Doc 6 |
| `postcss.config.mjs`   | Tailwind/PostCSS.                                                             | Completo | Cap. 4                                |
| `src/middleware.ts`    | Middleware de Next (sesión Supabase / gating de rutas). Deep-read en Doc 4/7. | —        | Cap. 8                                |

---

## 2. `core/` — núcleo compartido (sin dependencias de features)

### 2.1 auth

| Archivo                    | Qué hace                                                                                                                                                                                               | Estado               | Alineación           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | -------------------- |
| `auth/perm-defs.ts`        | Definiciones **puras** de permisos: `PERM_MODULES`, `PERM_ACTIONS` (ver/crear/editar/eliminar), `resolveAllowed()` (deny-by-default; admin todo, operador solo lo marcado). Usable en cliente y tests. | Completo · deep-read | Cap. 8 (permisos) ✅ |
| `auth/permissions.ts`      | Lógica server: `isAdmin`, `can`, `canViewModules`, `getModulePerms`, `getAllPerms`, `requirePermissionPage`, `hasPermission`. Puerta de autorización de páginas admin.                                 | Completo · deep-read | Cap. 8 ✅            |
| `auth/session.ts`          | `getCurrentUser`, `requireStaff` (+ `requireUser` usado en storefront). Sesión desde Supabase.                                                                                                         | Completo             | Cap. 8 ✅            |
| `auth/profile.ts`          | `getProfileById`, tipos `Profile`/`UserRole`.                                                                                                                                                          | Completo             | Cap. 8               |
| `auth/permissions.test.ts` | Tests de `resolveAllowed` (matriz admin/operador).                                                                                                                                                     | Completo             | Cap. 15 ✅           |

### 2.2 config / db / infra

| Archivo                                       | Qué hace                                                                                                                                                                | Estado                                          | Alineación            |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------- |
| `config/env.ts`                               | Objeto `env` centralizado (lee `process.env`). Punto único de env (ver Doc 5).                                                                                          | Completo · a deep-read en Doc 5                 | Cap. 4/16             |
| `db/index.ts`                                 | Instancia Drizzle `db` (única conexión).                                                                                                                                | Completo                                        | Cap. 5 ✅             |
| `db/schema/*` (40 archivos)                   | Una tabla por archivo (`orders`, `products`, `filaments`, `coupons`, `profit-shares`, etc.) + `enums.ts`, `relations.ts`, `order-relations.ts`, `index.ts` (barrel).    | Completo · núcleo deep-read                     | Doc 3 lo detalla      |
| `db/seed.ts` / `seed-data.ts` / `seed-run.ts` | Semilla de catálogo (categorías/productos demo).                                                                                                                        | Completo                                        | Cap. 18 F0/F2         |
| `email/index.ts`                              | `sendEmail`, `isEmailConfigured` (wrapper Resend). Degrada si falta API key.                                                                                            | Completo                                        | Cap. 12 (Resend) ✅   |
| `errors/index.ts`                             | Jerarquía `AppError` + `ValidationError`/`NotFoundError`/`UnauthorizedError`/`InvalidTransitionError`/`PaymentError`/`RateLimitError`, `ActionResult`, `toActionError`. | Completo · deep-read                            | Cap. 6 (errores) ✅   |
| `observability/index.ts`                      | Wrapper de logging (`captureException/Message`). Sin Sentry aún (decisión Cap. 4: no sumar dep no usada).                                                               | Completo (stub intencional)                     | Cap. 17 ✅            |
| `payments/mercadopago.ts`                     | SDK-lite MP: `createPreference`, `verifyWebhookSignature`, `getPayment`, `isMercadoPagoConfigured`.                                                                     | Completo · deep-read en Doc 8                   | Cap. 11 ✅            |
| `security/rate-limit.ts`                      | `rateLimit()` **en memoria** (+ reset para tests).                                                                                                                      | Presente — **no distribuido** (deuda, Doc 7/10) | Cap. 16 ⚠             |
| `security/request.ts`                         | `getClientIp()`.                                                                                                                                                        | Completo                                        | Cap. 16               |
| `storage/index.ts`                            | `optimizeImage`, `uploadObject`, `deleteObject` (Supabase Storage).                                                                                                     | Completo · Doc 8                                | Cap. 12 ✅            |
| `supabase/{admin,browser,server}.ts`          | Clientes Supabase por contexto (service-role / browser / server con cookies).                                                                                           | Completo                                        | Cap. 8/12 ✅          |
| `audit/index.ts`                              | `recordAudit`, `listRecentAudit` (bitácora).                                                                                                                            | Completo                                        | Cap. 8 (auditoría) ✅ |

**Tests core:** `observability.test.ts`, `mercadopago.test.ts`, `rate-limit.test.ts` — ver Doc 6.

---

## 3. `lib/` — utilidades puras

| Archivo                 | Qué hace                                                                                     | Estado   | Alineación      |
| ----------------------- | -------------------------------------------------------------------------------------------- | -------- | --------------- |
| `lib/format.ts`         | `formatPrice`, `compactPrice`, `formatMinutes` (formato AR).                                 | Completo | Cap. 5          |
| `lib/site.ts`           | `siteUrl`, `siteName`, `whatsappPhone`, `whatsappUrl`. **Fuente de `SITE_URL`** (ver Doc 5). | Completo | Cap. 16 ⚠ (env) |
| `lib/image-compress.ts` | `compressImageToWebp` (cliente).                                                             | Completo | Cap. 12         |
| `lib/utils.ts`          | `cn()` (merge de clases).                                                                    | Completo | Cap. 5          |

---

## 4. `components/` — UI transversal (fuera de features)

### 4.1 `ui/` — primitivos (Nivel 1, Cap. 19)

| Archivo                 | Qué hace                                                                                | Estado               | Alineación                  |
| ----------------------- | --------------------------------------------------------------------------------------- | -------------------- | --------------------------- |
| `ui/button.tsx`         | Botón con `variant`/`size` + prop **`loading`** (spinner + auto-disable + `aria-busy`). | Completo · deep-read | Cap. 19 (Button loading) ✅ |
| `ui/spinner.tsx`        | `Spinner` inline (`animate-spin`, `currentColor`).                                      | Completo (nuevo)     | Cap. 19 (Spinner) ✅        |
| `ui/badge.tsx`          | Badge por variante (estados).                                                           | Completo             | Cap. 19                     |
| `ui/card.tsx`           | Card / superficie.                                                                      | Completo             | Cap. 19                     |
| `ui/modal.tsx`          | Modal base.                                                                             | Completo             | Cap. 19                     |
| `ui/confirm-dialog.tsx` | Diálogo de confirmación reutilizable.                                                   | Completo             | Cap. 19 (ConfirmDialog) ✅  |
| `ui/dropdown.tsx`       | Menú desplegable.                                                                       | Completo             | Cap. 19                     |
| `ui/toaster.tsx`        | Toasts.                                                                                 | Completo             | Cap. 19                     |

### 4.2 `shared/` — compuestos

| Archivo                         | Qué hace                                                  | Estado           | Alineación                    |
| ------------------------------- | --------------------------------------------------------- | ---------------- | ----------------------------- |
| `shared/hefesto-loader.tsx`     | Loader de marca (H que se "imprime"), para `loading.tsx`. | Completo         | Cap. 19 (Spinner/Skeleton) ✅ |
| `shared/under-construction.tsx` | Placeholder "en construcción" para features gateados.     | Completo (nuevo) | — (soporte de feature flag)   |
| `shared/empty-state.tsx`        | Estado vacío.                                             | Completo         | Cap. 19 (EmptyState) ✅       |
| `shared/pagination.tsx`         | Paginación.                                               | Completo         | Cap. 19                       |
| `shared/price-tag.tsx`          | Etiqueta de precio.                                       | Completo         | Cap. 19 (PriceTag) ✅         |

### 4.3 `layout/` y otros

| Archivo                                                                         | Qué hace                                                    | Estado   |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------- |
| `layout/admin-shell.tsx`, `sidebar.tsx`                                         | Cascarón admin + navegación (gateada por permisos).         | Completo |
| `layout/header.tsx`, `store-nav.tsx`, `footer.tsx`, `top-banner.tsx`            | Layout storefront.                                          | Completo |
| `layout/theme-switcher.tsx`, `brand-mark.tsx`, `to-top.tsx`, `whatsapp-fab.tsx` | Utilidades de UI de layout.                                 | Completo |
| `home/hero-carousel.tsx`, `home/count-up.tsx`                                   | Piezas de la home.                                          | Completo |
| `auth/perms-provider.tsx`                                                       | Provider cliente de permisos (para gatear controles en UI). | Completo |

---

## 5. `features/` — módulos de dominio

Cada feature sigue el patrón del Cap. 5/19: `actions.ts` (server actions, entrada),
`service.ts`/`services/*` (reglas de negocio), `repository.ts`/`queries.ts` (única
puerta a DB), `schemas.ts` (Zod), `types.ts`, `components/*` (UI), `constants`.

### 5.1 auth

Login/registro/recupero/cambio de clave sobre Supabase Auth.

| Archivo         | Qué hace                                                                                                        | Estado   | Alineación             |
| --------------- | --------------------------------------------------------------------------------------------------------------- | -------- | ---------------------- |
| `actions.ts`    | `loginAction`, `registerAction`, `logoutAction`, `requestPasswordResetAction`, `changePasswordAction`.          | Completo | Cap. 8 ✅              |
| `schemas.ts`    | Zod: login/registro/reset.                                                                                      | Completo | Cap. 8 (Zod server) ✅ |
| `repository.ts` | `clearMustChangePassword`.                                                                                      | Completo | Cap. 8                 |
| `components/*`  | `AuthDialog`, `LoginForm`, `RegisterForm`, `ResetForm`, `ChangePasswordForm`, `UserMenu`, `auth-modal/trigger`. | Completo | Cap. 8 / index         |

### 5.2 calculator

Calculadora de precio de impresión (amortización + margen) y cotización.

| Archivo         | Qué hace                                                                                                                          | Estado                            | Alineación          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------- |
| `calculator.ts` | **Puro**: `computePrintPrice`, `computeQuote`, `selectActiveMargin`, `resolveCostPerKg`. Núcleo de pricing.                       | Completo · **deep-read en Doc 9** | Cap. 9 (pricing) ✅ |
| `service.ts`    | Orquesta config/historial/presets/cotización.                                                                                     | Completo                          | Cap. 9              |
| `repository.ts` | Historial de cálculo + presets de margen + config de costo.                                                                       | Completo                          | Cap. 5              |
| `schemas.ts`    | Zod: save/quote/config/preset.                                                                                                    | Completo                          | Cap. 9 ✅           |
| `actions.ts`    | `quotePriceAction`, `saveCalcAction`, presets, `saveCalcConfigAction`.                                                            | Completo                          | Cap. 9              |
| `components/*`  | `PriceCalculator` (grande), `PriceEstimator` (modal producto), `MarginPresetsButton`, `CalcConfigButton`, `EstimatorModalButton`. | Completo                          | index / Cap. 9      |

### 5.3 cart

Carrito en cliente (Zustand); validación de total en server (checkout).

| Archivo                                                                                                                      | Qué hace                                               | Estado   | Alineación                                     |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------- | ---------------------------------------------- |
| `components/add-to-cart.tsx`, `cart-drawer`, `cart-item`, `cart-button`, `coupon-input`, `clear-cart-on-mount`, `newsletter` | UI de carrito + cupón + newsletter. Estado en cliente. | Completo | Cap. 10 (CartService: total real en server) ✅ |

> El recálculo de total y validación viven en `orders` (checkout) — el cart NO
> confía en el precio del navegador. Correcto según Cap. 10.

### 5.4 custom (pedidos a medida)

Encargos personalizados con chat y cotización. **Gateado tras feature flag.**

| Archivo                  | Qué hace                                                                                                                         | Estado                     | Alineación            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | --------------------- |
| `config.ts`              | `CUSTOM_ORDERS_ENABLED` (hoy `false`).                                                                                           | Completo (nuevo)           | Feature flag (Doc 14) |
| `actions.ts`             | Crear pedido, mensajes, subir imagen, cotizar, transicionar, aprobar.                                                            | Completo                   | Cap. 15 (custom)      |
| `service.ts`             | Reglas + lecturas admin (`listAdminRequestsWithMeta`, `requestNeedsReply`).                                                      | Completo                   | Cap. 5                |
| `repository.ts`          | CRUD de requests + mensajes.                                                                                                     | Completo                   | Cap. 5                |
| `transitions.ts`         | Máquina de estados custom + `canQuote`.                                                                                          | Completo                   | Cap. 15               |
| `schemas.ts`, `types.ts` | Zod + tipos.                                                                                                                     | Completo                   | ✅                    |
| `components/*`           | `RequestForm`, `ChatThread`, `ApproveQuote`, `MedidaStatusSelect/QuoteButton/DeleteButton`, `AdminManager`, `CustomStatusBadge`. | Completo (oculto por flag) | index                 |

### 5.5 customers

Cuenta del cliente + fichas admin + clientes manuales + direcciones.

| Archivo                  | Qué hace                                                                                                                         | Estado   | Alineación |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| `actions.ts`             | Perfil, direcciones (add/update/default/delete), cliente manual, nota admin.                                                     | Completo | Cap. 13    |
| `service.ts`             | `getAccount`, `listAdminCustomers` (total sobre pagados), clientes manuales, nota.                                               | Completo | Cap. 13 ✅ |
| `repository.ts`          | Perfiles, agregados de pedidos, direcciones, clientes manuales.                                                                  | Completo | Cap. 5     |
| `tier.ts`                | Cálculo de tier por gasto (`computeTier`, umbrales, labels).                                                                     | Completo | Cap. 13    |
| `schemas.ts`, `types.ts` | Zod + tipos.                                                                                                                     | Completo | ✅         |
| `components/*`           | `AccountShell/Nav`, `ProfileForm`, `AddressManager`, `CustomerForm`, `CustomerSearch`, `CustomerNoteForm`, botones nuevo/editar. | Completo | index      |

### 5.6 discounts (cupones)

| Archivo                        | Qué hace                                                                                                                      | Estado                        | Alineación                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------- |
| `service.ts`                   | `computeDiscount`, `validateCoupon` (vigencia/usos/mínimo en server).                                                         | Completo · deep-read en Doc 9 | Cap. 10 (DiscountService) ✅ |
| `repository.ts` / `queries.ts` | Buscar por código/id, listar, insertar, actualizar, toggle. **Dos archivos de acceso a datos** (posible duplicación, Doc 10). | Completo                      | Cap. 5 ⚠                     |
| `actions.ts`                   | `validateCouponAction`, `saveCouponAction`, `toggleCouponAction`.                                                             | Completo                      | Cap. 10                      |
| `schemas.ts`, `types.ts`       | Zod + tipos.                                                                                                                  | Completo                      | ✅                           |
| `components/*`                 | `CouponsAdmin`, `CouponForm`, `CouponToggle`.                                                                                 | Completo                      | index                        |

### 5.7 earnings (ganancias y socios)

| Archivo                      | Qué hace                                                                                                 | Estado                         | Alineación               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------ |
| `economics.ts`               | **Puro**: `computeOrderEconomics`, `manualSaleEconomics`, `distribute` (reparto), `sharesTotal`. Dinero. | Completo · **deep-read Doc 9** | Cap. 8 (profit split) ✅ |
| `service.ts`                 | Config de costo, CRUD socios, `getEarningsOverview` (mensual).                                           | Completo                       | Cap. 8                   |
| `repository.ts`              | Cost settings, profit shares, pedidos/ítems entregados.                                                  | Completo                       | Cap. 5                   |
| `schemas.ts`, `constants.ts` | Zod + colores.                                                                                           | Completo                       | ✅                       |
| `actions.ts`                 | Guardar costos, CRUD socios.                                                                             | Completo                       | Cap. 8                   |
| `components/*`               | `ProfitSharesEditor`, `CostSettingsButton`, `EarningsMonthFilter`.                                       | Completo                       | index                    |

### 5.8 inventory (filamentos + fallas)

| Archivo                                  | Qué hace                                                                                                            | Estado                         | Alineación               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------ |
| `service.ts`                             | **Puro/negocio**: `computeNewStock`, `isLowStock`, `filamentStatus`, `registerFailure` (con deps). Stock en gramos. | Completo · **deep-read Doc 9** | Cap. 7 (stock gramos) ✅ |
| `repository.ts`                          | Filamentos + fallas; incluye TX (`registerFailureTx`, `deleteFailureTx`).                                           | Completo                       | Cap. 5/7                 |
| `queries.ts`                             | Vistas de lectura (view de filamentos, listados). **Coexiste con repository** (Doc 10).                             | Completo                       | Cap. 5 ⚠                 |
| `schemas.ts`, `types.ts`, `constants.ts` | Zod + tipos + materiales/colores/motivos.                                                                           | Completo                       | ✅                       |
| `actions.ts`                             | Guardar filamento, sumar bobina, borrar, registrar/editar/borrar falla.                                             | Completo                       | Cap. 7                   |
| `components/*`                           | `FilamentsBoard`, `FailuresTable`, `FilamentForm`, `FailureForm`, botones.                                          | Completo                       | index                    |

### 5.9 notifications

| Archivo                            | Qué hace                                                   | Estado   | Alineación |
| ---------------------------------- | ---------------------------------------------------------- | -------- | ---------- |
| `service.ts`                       | `getNotifications`, `markAllRead`, `notifyCustomer`.       | Completo | Cap. 12    |
| `repository.ts`                    | Listar/contar/insertar/marcar leídas.                      | Completo | Cap. 5     |
| `actions.ts`                       | `getMyNotificationsAction`, `markNotificationsReadAction`. | Completo | Cap. 12    |
| `components/notification-bell.tsx` | Campana + dropdown.                                        | Completo | index      |

### 5.10 orders — checkout, pago, gestión, venta manual

El feature más grande. Contiene checkout, integración MP, máquina de estados,
venta manual, chat y **borrado de pedidos** (rediseñado a hard-delete transaccional).

| Archivo                                                        | Qué hace                                                                                                                                                                                               | Estado                         | Alineación                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ----------------------------------------- |
| `actions.ts`                                                   | `createOrderAction`, `createManualSaleAction`, `transitionOrderAction` (side-effects en `after()`), `updateOrderMetaAction`, `deleteOrderAction` (**solo admin**).                                     | Completo · deep-read           | Cap. 10/11 ✅                             |
| `services/orderService.ts`                                     | `createOrder` (recalcula precio real, cupón, snapshots, genera número, **transaccional**).                                                                                                             | Completo · **deep-read Doc 9** | Cap. 10 ✅                                |
| `services/orderWorkflow.ts`                                    | `transitionOrderStatus` (valida máquina de estados + historial + paidAt).                                                                                                                              | Completo · deep-read           | Cap. 11 ✅                                |
| `services/orderAdminService.ts`                                | `listOrdersAdmin`, `getOrderAdmin`, `setOrderMeta`, `transitionOrder` (tracking obligatorio para shipped), **`deleteOrderAdmin` (hard delete cualquier estado)**, **`deleteOrdersAdmin` (masivo)**.    | Completo · deep-read           | Cap. 11 · **desvío intencional** (Doc 14) |
| `services/paymentService.ts`                                   | `startMercadoPagoPayment`, `confirmOrderPayment`, `cancelPendingOrder`.                                                                                                                                | Completo · Doc 8               | Cap. 11 ✅                                |
| `services/manualSaleService.ts`                                | `computeManualSaleCosts`, `createManualSale`, `listManualSales`. Dinero.                                                                                                                               | Completo · deep-read Doc 9     | Cap. 8                                    |
| `services/orderEmails.ts` / `orderChat.ts` / `orderQueries.ts` | Emails por transición; chat pedido; lecturas del cliente.                                                                                                                                              | Completo                       | Cap. 12                                   |
| `repository.ts`                                                | Única puerta a DB. **`deleteOrder` transaccional**: revierte `usedCount` de cupón + borra redenciones + borra point_transactions + borra pedido (ítems/historial/chat cascade; print_jobs → null).     | Completo · **deep-read**       | Cap. 11/15 ✅ (money-safe)                |
| `transitions.ts`                                               | Tabla de transiciones permitidas + `canTransition`.                                                                                                                                                    | Completo                       | Cap. 11 ✅                                |
| `schemas.ts`, `types.ts`, `constants.ts`                       | Zod (checkout, venta manual, mensaje), tipos, labels/variantes.                                                                                                                                        | Completo                       | ✅                                        |
| `components/*`                                                 | `CheckoutStepper`, `ManualOrderForm`, `OrderStatusManager`, `OrderSummary`, `OrderChat`, `OrdersAdminList`, `DeleteOrderButton` (antes `OrderActions`), `DeleteManualSaleButton`, `CargarVentaButton`. | Completo · en flujo            | index                                     |

> **Notas de estado (orders):** (1) el comentario de `deleteOrderAction` todavía
> dice "la regla de qué estados son borrables la valida el service" — **quedó
> desactualizado** tras pasar a hard-delete sin restricción (deuda menor, Doc 10).
> (2) `deleteOrdersAdmin` (masivo) existe en el service; verificar el cableado de
> la action/UI de borrado masivo (Doc 4/10).

### 5.11 production (cola de impresión)

| Archivo                                           | Qué hace                                             | Estado   | Alineación |
| ------------------------------------------------- | ---------------------------------------------------- | -------- | ---------- |
| `repository.ts`                                   | Impresoras + trabajos (listar/crear/estado).         | Completo | Cap. 7     |
| `service.ts`                                      | `getBoard` + wrappers. Muy delgado (deriva al repo). | Completo | Cap. 5     |
| `actions.ts`                                      | Alta impresora/trabajo + cambios de estado.          | Completo | Cap. 7     |
| `constants.ts`, `components/production-board.tsx` | Labels + tablero.                                    | Completo | index      |

### 5.12 products — catálogo + categorías

| Archivo                                       | Qué hace                                                                                                                                                                                                | Estado               | Alineación |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------- |
| `services/catalogService.ts`                  | Catálogo público + admin: `listProducts`, `getProductBySlug`, `getHomeData`, `createProduct`/`updateProduct`, `publishProduct` (bloquea sin imagen), `archiveProduct`.                                  | Completo · deep-read | Cap. 9 ✅  |
| `repository.ts`                               | Única puerta a DB de productos/imágenes/variantes/categorías.                                                                                                                                           | Completo             | Cap. 5     |
| `actions.ts`                                  | CRUD producto + publicar/archivar + imágenes + **CRUD categoría** (categoría obligatoria; no borrar en uso).                                                                                            | Completo · deep-read | Cap. 9 ✅  |
| `schemas.ts`, `types.ts`, `category-icons.ts` | Zod (filtros/producto/categoría), tipos, íconos.                                                                                                                                                        | Completo             | ✅         |
| `search-actions.ts`                           | `searchProductsAction`.                                                                                                                                                                                 | Completo             | Cap. 9     |
| `components/*`                                | `ProductsAdmin`, `ProductForm`, `CategoriesAdmin`, `CategoryForm`, `DeleteCategoryButton`, `ProductStatusActions`, `ImageUpload`, `FilterPanel`, `ProductCard/Grid/Gallery`, `SearchBox`, `SortSelect`. | Completo             | index      |

### 5.13 reports (dashboard + reportes)

| Archivo         | Qué hace                                                                                                      | Estado   | Alineación |
| --------------- | ------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| `repository.ts` | KPIs, revenue por fuente/mes/día, top productos, breakdown por categoría, ventas para CSV (`SALES_STATUSES`). | Completo | Cap. 14    |
| `service.ts`    | `getDashboardData`, `getReportsData`, `getSalesCsv`, series diarias.                                          | Completo | Cap. 14    |
| `actions.ts`    | `exportSalesCsvAction`.                                                                                       | Completo | Cap. 14    |
| `components/*`  | `RevenueChart`, `MonthlyBars`, `CategoryDonut`, `KpiCard`, `ExportCsvButton`.                                 | Completo | index      |

### 5.14 reviews (reseñas)

| Archivo                                  | Qué hace                                                                                                 | Estado   | Alineación |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| `service.ts`                             | `getProductReviews`, `createReview`, moderación (`setReviewApproved`, `removeReview`), `computeAverage`. | Completo | Cap. 15    |
| `repository.ts`                          | Aprobadas por producto, stats, `hasReviewed`, insertar, moderación.                                      | Completo | Cap. 5     |
| `actions.ts`                             | `createReviewAction`, `approveReviewAction`, `deleteReviewAction`.                                       | Completo | Cap. 15    |
| `schemas.ts`, `types.ts`, `components/*` | Zod, tipos, `ProductReviews`, `ReviewForm`, `ReviewModeration`, `Stars`.                                 | Completo | index      |

### 5.15 rewards (puntos y recompensas)

| Archivo                                         | Qué hace                                                                  | Estado                     | Alineación |
| ----------------------------------------------- | ------------------------------------------------------------------------- | -------------------------- | ---------- |
| `points.ts`                                     | **Puro**: `computePointsEarned`, `pointsToMoney`, `canRedeem`.            | Completo · deep-read Doc 9 | Cap. 13 ✅ |
| `service.ts`                                    | Saldo/historial, CRUD recompensas, `awardForOrder` (otorga al confirmar). | Completo                   | Cap. 13    |
| `repository.ts`                                 | Saldo, transacciones, `hasOrderAward` (idempotencia), CRUD recompensas.   | Completo                   | Cap. 5     |
| `reward-types.ts`, `schemas.ts`, `components/*` | Tipos de recompensa, Zod, `RewardsAdmin`, `RewardForm`.                   | Completo                   | index      |

### 5.16 settings (configuración del negocio)

El feature de mayor superficie de config: marca, apariencia, banners, pagos,
envíos, equipo y **roles/permisos**.

| Archivo                                                    | Qué hace                                                                                                                                                                                                                   | Estado                              | Alineación |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------- |
| `actions.ts`                                               | ~14 actions: subir marca/banner, info negocio, apariencia, banners CRUD, pagos, envíos, asignar rol, invitar/reenviar, CRUD roles.                                                                                         | Completo · a auditar authz en Doc 4 | Cap. 8/16  |
| `service.ts`                                               | Marca, info, pagos, envíos, `listRoles`/`createRole`/`updateRole`/`deleteRole`, `listTeam`.                                                                                                                                | Completo                            | Cap. 8     |
| `repository.ts`                                            | Settings, banners, pagos, envíos, perfiles/roles, `countAdmins` (no dejar sistema sin admin).                                                                                                                              | Completo                            | Cap. 5/8   |
| `seasons.ts`, `home-sections.ts`, `types.ts`, `schemas.ts` | Temas de temporada, secciones de home, tipos, Zod.                                                                                                                                                                         | Completo                            | index      |
| `components/*`                                             | `StoreAppearance` (grande), `RolesManager` (grande), `StorePreview`, `BusinessInfoForm`, `BusinessConfigForm`, `PaymentSettingsForm`, `ShippingSettingsForm`, `BrandImageUpload`, `ConfigTabs`, decoraciones de temporada. | Completo                            | index      |

### 5.17 wishlist (favoritos)

| Archivo                        | Qué hace                                                      | Estado   | Alineación          |
| ------------------------------ | ------------------------------------------------------------- | -------- | ------------------- |
| `store.ts`                     | `useWishlistStore` (Zustand).                                 | Completo | Cap. 4 (Zustand) ✅ |
| `service.ts` / `repository.ts` | Get/add/remove/clear favoritos.                               | Completo | Cap. 5              |
| `actions.ts`                   | IDs, toggle, productos, limpiar.                              | Completo | —                   |
| `components/*`                 | `FavDrawer`, `WishlistButton`, `FavButton`, `WishlistLoader`. | Completo | index               |

---

## 6. `app/` — rutas (App Router)

### 6.1 Admin (`(admin)/admin/*`) — gateadas por permiso

| Ruta                                           | Qué hace                                                                       | Estado                                       | Nota   |
| ---------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------- | ------ |
| `page.tsx`                                     | Dashboard admin (KPIs).                                                        | Completo                                     | —      |
| `layout.tsx` / `loading.tsx` / `error.tsx`     | Cascarón + loading + error boundary.                                           | Completo                                     | —      |
| `productos/*`, `categorias`                    | Listado, nuevo, editar producto; categorías.                                   | Completo                                     | —      |
| `pedidos/`, `pedidos/[id]`, `pedidos/importar` | Lista pedidos, detalle (con Acciones/borrado), **importar (en construcción)**. | Detalle completo; **importar = placeholder** | Doc 10 |
| `medida/`, `medida/[id]`                       | Bandeja a medida — **gateada "en construcción"**; `[id]` redirige a la lista.  | Gateado por flag                             | Doc 14 |
| `clientes/`, `clientes/[id]`                   | Fichas de cliente.                                                             | Completo                                     | —      |
| `filamentos/`, `fallas/`                       | Inventario + fallas.                                                           | Completo                                     | —      |
| `descuentos/`, `recompensas/`, `resenas/`      | Cupones, recompensas, moderación de reseñas.                                   | Completo                                     | —      |
| `ganancias/`, `reportes/`, `calculadora/`      | Ganancias/socios, reportes, calculadora.                                       | Completo                                     | —      |
| `produccion/`, `configuracion/`, `auditoria/`  | Cola, configuración, bitácora.                                                 | Completo                                     | —      |

### 6.2 Storefront (`(storefront)/*`)

| Ruta                                                      | Qué hace                                                                                      | Estado                     | Nota       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------- | ---------- |
| `page.tsx`                                                | Home (grande).                                                                                | Completo                   | Doc 12     |
| `catalogo/`, `producto/[slug]`                            | Catálogo + detalle de producto.                                                               | Completo                   | —          |
| `checkout/`, `checkout/exito`                             | Checkout + éxito.                                                                             | Completo                   | Cap. 10/11 |
| `cuenta/*`                                                | Perfil, pedidos, pedido `[numero]`, puntos, favoritos, cambiar-clave, **a-medida (gateada)**. | Completo (a-medida oculta) | Doc 14     |
| `ingresar/`, `registro/`, `recuperar/`                    | Auth storefront.                                                                              | Completo                   | —          |
| `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx` | Cascarón + estados.                                                                           | Completo                   | —          |

### 6.3 API + raíz

| Ruta                                       | Qué hace                                              | Estado                         | Nota                             |
| ------------------------------------------ | ----------------------------------------------------- | ------------------------------ | -------------------------------- |
| `api/webhooks/mercadopago/route.ts`        | Webhook de pago MP (verifica firma, confirma pedido). | Completo · **deep-read Doc 8** | Cap. 11 — secret en prod (Doc 5) |
| `api/health/route.ts`                      | Healthcheck.                                          | Completo                       | Cap. 17                          |
| `auth/callback/route.ts`                   | Callback de Supabase Auth.                            | Completo                       | Cap. 8                           |
| `layout.tsx` (root)                        | Layout raíz + providers.                              | Completo                       | —                                |
| `robots.ts`, `sitemap.ts`                  | SEO.                                                  | Completo                       | Cap. 16 (SEO) ✅                 |
| `global-error.tsx`, `not-found.tsx` (root) | Errores globales.                                     | Completo                       | Cap. 17                          |

---

## 7. Hallazgos del inventario (cosas notables)

1. **Borrado de pedidos rediseñado y completo:** `repository.deleteOrder` es
   **transaccional** y revierte cupón (`usedCount`) + puntos (`point_transactions`)
   antes de borrar; `deleteOrderAdmin` (cualquier estado) + `deleteOrdersAdmin`
   (masivo) en el service; action **solo admin**; test verde. Es un **desvío
   intencional** del criterio previo (borrado restringido) → Doc 14.
2. **Comentario desactualizado:** `deleteOrderAction` aún menciona "regla de qué
   estados son borrables" que ya no aplica → Doc 10 (deuda menor).
3. **Doble puerta de datos en 2 features:** `discounts` (`repository.ts` +
   `queries.ts`) e `inventory` (`repository.ts` + `queries.ts`). Revisar si es
   duplicación o separación lectura/escritura deliberada → Doc 2/10.
4. **Placeholders "en construcción":** `admin/pedidos/importar` (import Excel/CSV)
   y las pantallas **a medida** (por flag). Código presente, feature apagado.
5. **Rate limit en memoria** (`core/security/rate-limit.ts`): no distribuido —
   ⚠ para prod multi-instancia → Doc 7/10/15.
6. **Observabilidad = stub intencional** (sin Sentry) por decisión de Cap. 4.
7. **`components/layout` y `components/home`** no están listados en el Cap. 19
   como tal (Nivel 3/4) pero cumplen ese rol — verificar naming vs libro (Doc 12/14).

---

### Cobertura de este documento

Leídos línea por línea (deep-read): todo el subsistema de **borrado de pedidos**
(repo/service/action), `auth/permissions*`, `core/errors`, `orders/actions`,
`ui/button`. El resto se inventarió por encabezado + exports + rol arquitectónico.
Las áreas de dinero/stock (calculator, earnings/economics, inventory/service,
orderService, rewards/points) se deep-readean en el **Doc 9 (reglas de negocio)**;
seguridad/authz por ruta en **Doc 4 y 7**.

_Fin del Documento 1._
