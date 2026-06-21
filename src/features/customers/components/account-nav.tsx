"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/cuenta/pedidos", label: "Mis pedidos" },
  { href: "/cuenta/perfil", label: "Perfil y direcciones" },
  { href: "/cuenta/a-medida", label: "A medida" },
  { href: "/cuenta/favoritos", label: "Favoritos" },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav className="account-nav">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(pathname.startsWith(t.href) && "active")}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
