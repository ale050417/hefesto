import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-surface-2 bg-surface-1 border-t">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
          <div>
            <p className="font-display text-primary text-lg font-bold">
              HEFESTO 3D
            </p>
            <p className="text-dim mt-2 max-w-xs text-sm">
              Productos impresos en 3D, hechos a pedido.
            </p>
          </div>
          <nav className="flex flex-col gap-2 text-sm">
            <Link href="/" className="text-dim hover:text-fg transition-colors">
              Inicio
            </Link>
            <Link
              href="/catalogo"
              className="text-dim hover:text-fg transition-colors"
            >
              Catálogo
            </Link>
          </nav>
        </div>
        <p className="text-faint mt-8 text-xs">
          © {year} Hefesto 3D. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
