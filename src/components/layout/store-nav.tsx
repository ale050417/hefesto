"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavLink = {
  href: string;
  label: string;
  exact?: boolean;
  variant?: "gold";
  push?: boolean;
  icon: ReactNode;
};

const links: NavLink[] = [
  {
    href: "/",
    label: "Inicio",
    exact: true,
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    ),
  },
  {
    href: "/catalogo",
    label: "Catálogo",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/cuenta/a-medida",
    label: "A medida",
    variant: "gold",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="m12 3 2.1 4.6L19 8.7l-3.5 3.4.9 5L12 14.8 7.6 17l.9-5L5 8.7l4.9-1.1z" />
      </svg>
    ),
  },
  {
    href: "/cuenta/pedidos",
    label: "Mis pedidos",
    push: true,
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="m7.5 4.27 9 5.15M21 8.5v7l-9 5-9-5v-7l9-5z" />
        <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
      </svg>
    ),
  },
  {
    href: "/cuenta",
    label: "Mi cuenta",
    exact: true,
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M20 21a8 8 0 1 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export function StoreNav() {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);
  return (
    <nav className="store-nav" aria-label="Principal">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "store-nav-link",
            l.variant === "gold" && "gold",
            l.push && "push",
            isActive(l.href, l.exact) && "active",
          )}
        >
          {l.icon}
          <span>{l.label}</span>
        </Link>
      ))}
    </nav>
  );
}
