import Link from "next/link";

const adminLinks = [
  { href: "/admin", label: "Panel" },
  { href: "/admin/productos", label: "Productos" },
  { href: "/admin/categorias", label: "Categorías" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/apariencia", label: "Apariencia" },
];

export function Sidebar() {
  return (
    <aside className="border-surface-2 bg-surface-1 flex shrink-0 flex-col border-b md:min-h-dvh md:w-60 md:border-r md:border-b-0">
      <div className="p-4">
        <Link
          href="/admin"
          className="font-display text-primary text-lg font-bold"
        >
          HEFESTO <span className="text-fg">Admin</span>
        </Link>
      </div>
      <nav className="flex gap-1 px-2 pb-3 md:flex-col md:px-3">
        {adminLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-dim hover:bg-surface-2 hover:text-fg rounded-md px-3 py-2 text-sm transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto hidden p-3 md:block">
        <Link
          href="/"
          className="text-faint hover:text-fg text-xs transition-colors"
        >
          ← Volver a la tienda
        </Link>
      </div>
    </aside>
  );
}
