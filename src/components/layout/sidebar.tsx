"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";
import { ThemeSwitcher } from "./theme-switcher";
import { AdminNotificationBell } from "@/features/notifications/components/admin-notification-bell";

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
  filamentos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  ),
  produccion: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9V3h12v6M6 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1" />
      <rect x="7" y="14" width="10" height="7" rx="1" />
    </svg>
  ),
  fallas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  ),
  descuentos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 9h.01M15 15h.01M16 8 8 16" />
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4z" />
    </svg>
  ),
  calculadora: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8M8 10h2M12 10h2M16 10h0M8 14h2M12 14h2M16 14h0M8 18h2M12 18h2M16 18h0" />
    </svg>
  ),
  reportes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 3 3 5-6" />
    </svg>
  ),
  resenas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
    </svg>
  ),
  medida: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9h18M9 21V9" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  ),
  clientes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  auditoria: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13l2 2 4-4" />
    </svg>
  ),
  config: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.81 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15H4.5a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 6 9.4 1.65 1.65 0 0 0 5.67 7.6l-.06-.06A2 2 0 1 1 8.44 4.7l.06.06A1.65 1.65 0 0 0 11 4.6V4.5a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 19 9.4l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 15z" />
    </svg>
  ),
  ganancias: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  recompensas: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  ),
};

type NavLink = {
  href: string;
  label: string;
  icon: React.ReactNode;
  group: string;
  exact?: boolean;
  /** Módulo con permiso fino. Si el usuario no lo puede ver, se oculta. */
  module?: string;
};

const links: NavLink[] = [
  {
    href: "/admin",
    label: "Panel",
    icon: icons.panel,
    exact: true,
    group: "Principal",
  },
  {
    href: "/admin/pedidos",
    label: "Pedidos",
    icon: icons.pedidos,
    group: "Ventas",
    module: "pedidos",
  },
  {
    href: "/admin/medida",
    label: "A medida",
    icon: icons.medida,
    group: "Ventas",
    module: "medida",
  },
  {
    href: "/admin/clientes",
    label: "Clientes",
    icon: icons.clientes,
    group: "Ventas",
    module: "clientes",
  },
  {
    href: "/admin/produccion",
    label: "Cola de impresión",
    icon: icons.produccion,
    group: "Producción",
    module: "produccion",
  },
  {
    href: "/admin/filamentos",
    label: "Filamentos",
    icon: icons.filamentos,
    group: "Producción",
    module: "filamentos",
  },
  {
    href: "/admin/fallas",
    label: "Impresiones fallidas",
    icon: icons.fallas,
    group: "Producción",
    module: "fallas",
  },
  {
    href: "/admin/productos",
    label: "Productos",
    icon: icons.productos,
    group: "Catálogo",
    module: "productos",
  },
  {
    href: "/admin/categorias",
    label: "Categorías",
    icon: icons.categorias,
    group: "Catálogo",
    module: "productos",
  },
  {
    href: "/admin/descuentos",
    label: "Descuentos",
    icon: icons.descuentos,
    group: "Crecimiento",
    module: "descuentos",
  },
  {
    href: "/admin/recompensas",
    label: "Recompensas",
    icon: icons.recompensas,
    group: "Crecimiento",
    module: "recompensas",
  },
  {
    href: "/admin/resenas",
    label: "Reseñas",
    icon: icons.resenas,
    group: "Crecimiento",
    module: "resenas",
  },
  {
    href: "/admin/reportes",
    label: "Reportes",
    icon: icons.reportes,
    group: "Análisis",
    module: "reportes",
  },
  {
    href: "/admin/ganancias",
    label: "Ganancias y socios",
    icon: icons.ganancias,
    group: "Análisis",
    module: "ganancias",
  },
  {
    href: "/admin/calculadora",
    label: "Calculadora 3D",
    icon: icons.calculadora,
    group: "Análisis",
    module: "calculadora",
  },
  {
    href: "/admin/configuracion",
    label: "Configuración",
    icon: icons.config,
    group: "Sistema",
    module: "config",
  },
  {
    href: "/admin/auditoria",
    label: "Auditoría",
    icon: icons.auditoria,
    group: "Sistema",
    module: "auditoria",
  },
];

export function Sidebar({
  perms,
  open,
  onNavigate,
}: {
  perms?: Record<string, boolean>;
  /** Drawer abierto (móvil). En desktop se ignora (CSS lo fija). */
  open?: boolean;
  /** Se llama al tocar un link (para cerrar el drawer en móvil). */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  // Oculta los ítems de módulos con permiso fino que el usuario no puede ver.
  const visible = links.filter((l) => !l.module || perms?.[l.module] !== false);
  const groups = [...new Set(visible.map((l) => l.group))];

  return (
    <aside className={cn("admin-sidebar", open && "open")}>
      <div className="mb-2 flex items-center justify-between gap-1">
        <Link href="/admin" className="brand px-2 py-1" onClick={onNavigate}>
          <BrandMark size={30} />
          <span className="brand-name text-[15px]">
            HEFESTO<b> Admin</b>
          </span>
        </Link>
        {/* Campana del negocio: en desktop vive acá (en móvil está en la topbar). */}
        <span className="hidden md:inline-flex">
          <AdminNotificationBell />
        </span>
      </div>

      <nav className="admin-nav">
        {groups.map((g) => (
          <div key={g}>
            <span className="nav-section-label">{g}</span>
            {visible
              .filter((l) => l.group === g)
              .map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  // Sin prefetch: el panel tiene ~15 links force-dynamic y Next
                  // los prefetcheaba TODOS al entrar → ráfaga de RSC que agotaba
                  // el pooler de la DB (cada uno pega a la base). Se navegan al
                  // click, de a uno.
                  prefetch={false}
                  onClick={onNavigate}
                  className={cn(
                    "nav-item",
                    isActive(l.href, l.exact) && "active",
                  )}
                >
                  {l.icon}
                  <span>{l.label}</span>
                </Link>
              ))}
          </div>
        ))}
      </nav>

      <div className="mt-auto flex items-center justify-between gap-2 px-3 pt-4">
        <Link
          href="/"
          onClick={onNavigate}
          className="text-faint hover:text-fg text-xs transition-colors"
        >
          ← Volver a la tienda
        </Link>
        {/* Tema claro / oscuro / cálido (igual que en la tienda) */}
        <ThemeSwitcher />
      </div>
    </aside>
  );
}
