"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  package:
    '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
  user: '<path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="7" r="4"/>',
  sparkles:
    '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  truck:
    '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
};

function NavIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="18"
      height="18"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: ICONS[name]! }}
    />
  );
}

const tabs = [
  { href: "/cuenta/perfil", label: "Perfil y direcciones", icon: "user" },
  { href: "/a-medida", label: "A medida", icon: "sparkles" },
  { href: "/cuenta/favoritos", label: "Favoritos", icon: "heart" },
  { href: "/cuenta/puntos", label: "Puntos", icon: "star" },
];

export function AccountNav() {
  const pathname = usePathname();

  return (
    <aside className="ui-card acc-nav">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn("acc-navitem", pathname.startsWith(t.href) && "active")}
        >
          <NavIcon name={t.icon} />
          <span>{t.label}</span>
        </Link>
      ))}
      <div className="my-2 h-px bg-[var(--border)]" />
      <Link href="/cuenta/pedidos" className="acc-navitem">
        <NavIcon name="truck" />
        <span>Seguir mis pedidos</span>
      </Link>
    </aside>
  );
}
