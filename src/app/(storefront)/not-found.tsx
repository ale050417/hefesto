import Link from "next/link";

export default function StorefrontNotFound() {
  return (
    <div className="store-wrap flex min-h-[50vh] flex-col items-center justify-center gap-4 py-20 text-center">
      <p className="font-display text-accent text-5xl">404</p>
      <h1 className="font-display text-fg text-2xl">Página no encontrada</h1>
      <p className="text-dim max-w-md text-sm">
        El producto o la página que buscás no existe o fue movida.
      </p>
      <div className="mt-4 flex gap-3">
        <Link href="/" className="btn btn-primary">
          Ir al inicio
        </Link>
        <Link href="/catalogo" className="btn btn-ghost">
          Ver el catálogo
        </Link>
      </div>
    </div>
  );
}
