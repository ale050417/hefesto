# features/ — Módulos por dominio

El corazón del proyecto. Un módulo por dominio de negocio (Cap. 5).
La lógica de negocio vive acá (en `services/`), **nunca** en la UI.

## Anatomía de un feature (Cap. 5.3)

```
features/<dominio>/
├── components/     → UI conectada del dominio (ProductCard, OrdersTable…)
├── services/       → reglas de negocio puras (sin React, sin HTTP, sin DB directa)
├── repository.ts   → única puerta a la base de datos (Drizzle)
├── schemas.ts      → validación con Zod (cliente + servidor)
├── types.ts        → tipos del dominio
└── actions.ts      → Server Actions (puente UI ↔ service)
```

Recorrido de una operación:
`componente → action → service → repository → core/db`

> `products` es la plantilla de referencia (Cap. 19). Los demás features
> siguen la misma forma. Estos archivos se crean **a medida** que se construye
> cada feature; por ahora las carpetas están vacías.

## Reglas de dependencias (Cap. 5.4 / 19) — innegociables

- Las dependencias van **solo hacia abajo**: `app → features → core + components/ui → lib`.
- La UI **nunca** importa un `repository` directo.
- `core/` **nunca** importa de `features/`.
- Un feature **nunca** importa el `repository` de otro feature (solo su `service` público).
- Nada de lógica de negocio en `app/` ni en `components/`.
