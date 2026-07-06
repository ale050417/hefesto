import Link from "next/link";

// El 404 global se renderiza dentro del layout raíz, que incluye <ThemeApplier/>
// (lee tema/marca de la base). Lo hacemos dinámico para que no se pre-renderice
// en el build y no dependa de la base. (Cap. 16)
export const dynamic = "force-dynamic";

/** Fallback global de 404 (rutas fuera del storefront). */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <p className="font-display text-accent text-5xl">404</p>
      <h1 className="font-display text-fg text-2xl">Página no encontrada</h1>
      <p className="text-dim max-w-md text-sm">
        La página que buscás no existe o fue movida.
      </p>
      <Link href="/" className="btn btn-primary mt-4">
        Ir al inicio
      </Link>
    </div>
  );
}
