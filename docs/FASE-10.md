# Fase 10 — Endurecimiento (hardening)

> Cap. 18, pasos 62–68. Cierra el camino "producto profesional" en lo que toca a
> robustez, SEO, accesibilidad, seguridad y observabilidad. **No** agrega
> features de negocio: solo endurece lo ya construido.

## Resumen

La Fase 10 toma el MVP completo (Fases 0–9) y lo prepara para producción:
configuración de marca con RLS, estados de carga/vacío/error en toda la app,
optimización de imágenes, SEO completo con datos estructurados, accesibilidad
básica, cabeceras de seguridad, auditoría extendida a productos/categorías y un
punto único de observabilidad listo para cablear Sentry en el deploy.

---

## Paso 62 — Configuración + RLS de `business_settings`

**Qué se construyó:** migración `0012_rls_settings.sql` que activa Row Level
Security sobre `business_settings` (singleton de marca: logo + hero) con una
política de **lectura pública** (`business_settings_public_read … USING (true)`).

**Para qué:** el logo y el hero se muestran en el storefront, así que la lectura
es pública; en cambio **nadie escribe por la API pública de Supabase** — la
configuración solo la cambia el servidor con Drizzle (rol `postgres`,
`BYPASSRLS`), desde `/admin/apariencia`. Cierra una deuda marcada en el
relevamiento de la Fase 4 (la tabla 0007 no tenía RLS).

**Cómo se conecta:** misma estrategia que `0004_rls_initial` y `0006_rls_orders`
— las políticas son la "red final" para el acceso público; la app las atraviesa
con Drizzle.

**Cómo probar:** `pnpm db:migrate` la aplica. Validada en pglite
(`pgcheck/check-0012.mjs`): RLS activo, política presente, lectura OK (3/3).

## Paso 63 — Estados de carga / vacío / error

**Qué se construyó:**

- `app/(storefront)/loading.tsx` y `app/(admin)/admin/loading.tsx` — spinner
  accesible (`role="status"`, `aria-live="polite"`).
- `app/(storefront)/error.tsx` y `app/(admin)/admin/error.tsx` — error
  boundaries de cliente con botón "Reintentar" (`reset()`) y enlace de salida.
- `app/global-error.tsx` — boundary catastrófico que renderiza su propio
  `<html>/<body>` (reemplaza al layout raíz).
- `app/not-found.tsx` (fallback global) y `app/(storefront)/not-found.tsx`
  (404 dentro del layout del storefront, con header/footer).

**Para qué:** UX consistente ante navegación lenta, errores de runtime o rutas
inexistentes; antes la app no tenía ninguno de estos archivos. El `EmptyState`
(estado vacío) ya existía y se reutiliza en catálogo/listados.

**Cómo probar:** visitar una URL inexistente (404), forzar un throw en una page
para ver el boundary, o navegar con red lenta para ver el `loading`.

## Paso 64 — Optimización de imágenes + Web Vitals

**Qué se construyó:** en `next.config.ts`, `images.formats = ["image/avif",
"image/webp"]` y `poweredByHeader: false`.

**Para qué:** servir AVIF/WebP mejora peso y LCP (Core Web Vitals). `next/image`
ya se usa en todo el catálogo con `remotePatterns` para picsum y Supabase.

## Paso 65 — SEO completo

**Qué se construyó:**

- `layout.tsx`: metadata enriquecida (`keywords`, `authors`, `creator`,
  `alternates.canonical`, `twitter` card, `formatDetection`, `robots.googleBot`)
  - **JSON-LD de Organización** inyectado en el `<body>`.
- Página de producto: **JSON-LD `Product`** con `offers` (precio efectivo,
  `ARS`, disponibilidad, URL canónica).

**Para qué:** rich results en buscadores y previews correctos al compartir.
Complementa el `sitemap.ts`/`robots.ts` y `metadataBase` de la Fase 1.

## Paso 66 — Accesibilidad

**Qué se construyó:** enlace **"Saltar al contenido"** (`.skip-link`, visible al
recibir foco) en el layout raíz, apuntando a `id="main"` (agregado a los `main`
de storefront y admin); utilidades `.sr-only` y refuerzo de `:focus-visible`
(ya existía la base). `lang="es"` ya estaba en el `<html>`. Los controles
ícono/texto del header ya tenían `aria-label`/texto.

**Para qué:** navegación con teclado y lectores de pantalla.

## Paso 67 — Auditoría de seguridad

**Qué se construyó:**

- **Cabeceras de seguridad** en `next.config.ts` (`headers()` para `/:path*`):
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-DNS-Prefetch-Control`,
  `Permissions-Policy` (camera/mic/geo deshabilitados) y
  `Strict-Transport-Security` (HSTS).
- **Auditoría extendida a productos y categorías:** las actions de crear /
  actualizar / publicar / archivar producto y crear / actualizar / borrar
  categoría ahora registran en `audit_log` (`product.created`, `product.updated`,
  `product.published`, `product.archived`, `category.created`,
  `category.updated`, `category.deleted`). Para conservar la identidad del actor
  sin una segunda consulta se agregó el guard `getStaffUser()` en
  `core/auth/session.ts`.

**Para qué:** las acciones sensibles del catálogo quedan trazadas (antes solo se
auditaban transiciones de pedidos). Las cabeceras reducen superficie de ataque.

**Deuda consciente:** no se define **CSP estricta** acá para no romper los
scripts inline de Next ni el checkout de MercadoPago; queda documentada en el
relevamiento (CSP con nonce como próximo paso de seguridad).

## Paso 68 — Observabilidad + Analytics

**Qué se construyó:** `core/observability/index.ts` — punto único
(`captureException`, `captureMessage`, `isObservabilityEnabled`), **best-effort**
y seguro de importar desde cliente y servidor (lee solo `NEXT_PUBLIC_*`, no
depende de `core/config/env`). Cableado en los tres error boundaries. Variables
opcionales en `env.ts` / `.env.example`: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`,
`NEXT_PUBLIC_ANALYTICS_ID`.

**Decisión de stack (Cap. 4):** **no** se agrega el SDK de Sentry todavía como
dependencia (no se usa hasta el deploy). El wrapper centraliza los call sites
para que, en la Fase 11, cablear Sentry sea un cambio de un solo archivo sin
tocar el resto del código. Mismo criterio para Analytics (Vercel/Plausible), que
se activa con `NEXT_PUBLIC_ANALYTICS_ID` en el deploy.

**Test:** `core/observability/observability.test.ts` (2 tests) verifica que
`captureException`/`captureMessage` loguean y nunca relanzan.

---

## Control (verificación)

- `tsc --noEmit`: OK
- `eslint . --max-warnings=0`: OK
- `prettier --check .`: OK (se agregó `index.html` —demo de referencia— a
  `.prettierignore`)
- `vitest run`: **63/63** (se sumaron 2 de observabilidad)
- `build` (con font-stub en el sandbox): OK
- pglite migración 0012: 3/3

## Próximo

Fase 11 (lanzamiento): dominio + variables de prod, aplicar todas las
migraciones (incluida 0009 pendiente en Supabase) y cablear Sentry/Analytics
reales; definir CSP con nonce. Ver `docs/RELEVAMIENTO-2026-06.md`.
