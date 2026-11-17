# Deploy a Vercel: que no falle

Cada push a `master` publica en producción (hefesto3d.com.ar). Un deploy en
rojo no rompe la web (queda la versión anterior), pero lo nuevo no sale y hay
que volver a subir. Esto es lo que ya falló y cómo se evita.

## Qué falló

| Fecha      | Causa                                                                                                                                                                                                                                                                                                                       | Arreglo                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 2026-10-21 | `next/font/google` no podía bajar Sora / Orbitron durante el build.                                                                                                                                                                                                                                                         | Fuentes dentro del repo (`@fontsource-variable/*`).                                     |
| 2026-11-17 | Error de tipos en `scripts/crear-revisor-tiendas.mts` (`'role' is possibly 'undefined'`). El build de Vercel revisa los tipos de TODO el repo, también `scripts/*.mts`, no solo de `src/`. El script se subió sin correr el chequeo y dejó dos deploys seguidos en rojo: el suyo y el siguiente, que no tenía nada que ver. | Chequeo del valor en el script + gancho `pre-push` que corre el chequeo antes de subir. |

## Qué lo evita ahora

- **Gancho `pre-push`** (`.husky/pre-push`): antes de cada `git push` corre
  `pnpm typecheck` (el mismo chequeo de tipos del build, sobre todo el repo) y
  `pnpm test`. Si alguno falla, el push no sale.
- No saltearlo con `--no-verify`. Si molesta, se arregla el error.

## Regla para cada subida

1. `pnpm typecheck` y `pnpm test` en verde (el gancho lo hace solo).
2. Si el cambio toca layout, fuentes, variables de entorno o `next.config.ts`:
   correr también `pnpm build` local, porque esos errores solo aparecen al
   compilar.
3. Si hay migración nueva: `pnpm db:migrate` ANTES de subir el código que la
   usa (el código nuevo pidiendo una tabla que no existe rompe la página).
4. Después del push, esperar el resultado y confirmar que dice `success`:
   `gh api repos/ale050417/hefesto/commits/<sha>/status --jq .state`
5. Si dice `failure`, leer el motivo con
   `npx vercel inspect <dpl_id> --logs` (el id viene en la descripción del
   estado), arreglarlo y volver a subir. No se da por publicado sin ese verde.
