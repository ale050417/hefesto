<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Deploy

Cada push a `master` publica en Vercel. Antes de subir y después de subir, seguir `docs/DEPLOY.md` (chequeo de tipos de TODO el repo, tests, y confirmar que el deploy quedó en `success`). No saltear el gancho `pre-push`.

# Arreglos del equipo

El operador carga en `/admin/arreglos` lo que hay que arreglar o mejorar (texto y fotos). Cuando Ale pida "leé los arreglos y arreglalos": `pnpm arreglos --fotos <carpeta>` lista los pendientes y baja las fotos para mirarlas; al terminar cada uno, `pnpm arreglos --resuelto <id> "qué se hizo"` lo cierra y le avisa a quien lo cargó (`--en-curso <id>` mientras se trabaja). Detalle en `scripts/arreglos.mts`.
