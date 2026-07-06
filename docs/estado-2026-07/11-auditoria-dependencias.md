# Documento 11 — Auditoría de dependencias

**Proyecto:** Hefesto 3D · **Fecha:** 2026-07-06 · **Doc 11 de 15.**
**Fuente:** `package.json`. Contraste contra el stack del Cap. 4.

## Dependencias de producción

| Paquete                                   | Versión        | Justificación (Cap. 4)             | Estado                            |
| ----------------------------------------- | -------------- | ---------------------------------- | --------------------------------- |
| `next`                                    | 16.2.9         | Framework (App Router)             | ✅ (Cap. dice 14+; va adelantado) |
| `react` / `react-dom`                     | 19.2.4         | UI                                 | ✅                                |
| `drizzle-orm`                             | ^0.45.2        | ORM                                | ✅                                |
| `postgres`                                | ^3.4.9         | Driver Postgres (Supabase)         | ✅                                |
| `@supabase/ssr` / `@supabase/supabase-js` | ^0.12 / ^2.108 | Auth/Storage/DB                    | ✅                                |
| `mercadopago`                             | ^3.1.0         | Pagos                              | ✅                                |
| `resend`                                  | ^6.14.0        | Emails                             | ✅                                |
| `zod`                                     | ^4.4.3         | Validación                         | ✅ (v4, major reciente)           |
| `zustand`                                 | ^5.0.14        | Estado cliente (cart/wishlist)     | ✅                                |
| `react-hook-form`                         | ^7.79.0        | Formularios                        | ✅                                |
| `tailwindcss` + `@tailwindcss/postcss`    | ^4.3.1         | Estilos                            | ✅ (Tailwind v4)                  |
| `class-variance-authority`                | ^0.7.1         | Variantes de UI                    | ✅ (estilo shadcn)                |
| `clsx` / `tailwind-merge`                 | ^2.1 / ^3.6    | Merge de clases (`cn`)             | ✅                                |
| `sharp`                                   | ^0.35.1        | Optimización de imágenes (Storage) | ✅ justificado                    |
| `postcss`                                 | ^8.5.15        | Build CSS                          | ✅                                |

## Dependencias de desarrollo

| Paquete                                                    | Uso                      | Estado       |
| ---------------------------------------------------------- | ------------------------ | ------------ |
| `vitest`                                                   | Unit tests               | ✅ (Cap. 15) |
| `@playwright/test`                                         | E2E                      | ✅ (Cap. 15) |
| `drizzle-kit`                                              | Migraciones              | ✅           |
| `eslint` + `eslint-config-next` + `eslint-config-prettier` | Lint                     | ✅           |
| `prettier` + `prettier-plugin-tailwindcss`                 | Formato                  | ✅           |
| `husky` + `lint-staged`                                    | Hooks de commit          | ✅           |
| `tsx`                                                      | Correr scripts TS (seed) | ✅           |
| `dotenv`                                                   | Env en scripts/drizzle   | ✅           |
| `typescript` ^5 + `@types/*`                               | Tipos                    | ✅           |

## Desvíos respecto del stack del Cap. 4

1. 🟡 **TanStack Query — declarado en el stack pero NO instalado.** La app usa
   **React Server Components + Server Actions** para datos, y Zustand para estado
   de cliente (cart/wishlist). En ese patrón, TanStack Query **no hace falta**. Es
   una **omisión justificada por la arquitectura**, pero contradice la letra del
   Cap. 4 → registrar en Doc 14 (decisión: quitarlo del stack o sumarlo si se
   agrega fetching de cliente).
2. 🟡 **shadcn/ui — no está el paquete.** El Cap. 4 dice "Tailwind + shadcn/ui",
   pero el proyecto usa el **patrón shadcn hecho a mano** (`components/ui/*` con
   `cva` + `clsx` + `tailwind-merge`) sin el registry/CLI de shadcn. Es una
   decisión razonable (menos acoplamiento), pero es un desvío nominal.

## Paquetes que "sobran"

- **Ninguno evidente.** Cada dependencia mapea a una necesidad real del stack. No
  hay librerías duplicadas (una sola de fechas: ninguna extra; formato AR es
  nativo `Intl`), ni utilidades redundantes.

## Actualización / riesgo de versiones

- Stack **moderno y adelantado**: Next 16, React 19, Tailwind v4, Zod v4. Ventaja:
  al día. Riesgo: son majors recientes; vale fijar versiones y correr `pnpm
audit`/`outdated` antes de prod.
- No se detectaron dependencias abandonadas ni con vulnerabilidades conocidas
  desde el `package.json` (un `pnpm audit` en Windows lo confirma; no ejecutable
  desde el sandbox).

## Recomendaciones

1. Decidir formalmente sobre **TanStack Query**: quitarlo del Cap. 4 (la
   arquitectura RSC no lo necesita) o sumarlo si aparece fetching de cliente.
2. Aclarar en el Cap. 4 que shadcn/ui es **"estilo shadcn, implementación propia"**.
3. Correr `pnpm outdated` + `pnpm audit` como paso del checklist de Fase 11.

_Fin del Documento 11._
