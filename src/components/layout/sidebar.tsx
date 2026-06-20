"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";

const icons: Record<string, React.ReactNode> = {
  panel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  productos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.3 7 12 12l8.7-5M12 22V12" />
    </svg>
  ),
  categorias: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.6 13.4 11 3.8a2 2 0 0 0-1.4-.6H4a1 1 0 0 0-1 1v5.6a2 2 0 0 0 .6 1.4l9.6 9.6a2 2 0 0 0 2.8 0l4.6-4.6a2 2 0 0 0 0-2.8z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </svg>
  ),
  pedidos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  auditoria: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13l2 2 4-4" />
    </svg>
  ),
  apariencia: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </svg>
  ),
};

const links = [
  { href: "/admin", label: "Panel", icon: icons.panel, exact: true },
  { href: "/admin/productos", label: "Productos", icon: icons.productos },
  { href: "/admin/categorias", label: "Categorías", icon: icons.categorias },
  { href: "/admin/pedidos", label: "Pedidos", icon: icons.pedidos },
  { href: "/admin/apariencia", label: "Apariencia", icon: icons.apariencia },
  { href: "/admin/auditoria", label: "Auditoría", icon: icons.auditoria },
];

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="admin-sidebar">
      <Link href="/admin" className="brand mb-1 px-2 py-1">
        <BrandMark size={30} />
        <span className="brand-name text-[15px]">
          HEFESTO<b> Admin</b>
        </span>
      </Link>

      <span className="nav-section-label">Gestión</span>
      <nav className="admin-nav">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn("nav-item", isActive(l.href, l.exact) && "active")}
          >
            {l.icon}
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>

      <Link
        href="/"
        className="text-faint hover:text-fg mt-auto hidden px-3 pt-4 text-xs transition-colors md:block"
      >
        ← Volver a la tienda
      </Link>
    </aside>
  );
}
