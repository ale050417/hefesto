import Link from "next/link";
import { getCurrentUser } from "@/core/auth/session";
import { CartButton } from "@/features/cart/components/cart-button";
import { logoutAction } from "@/features/auth/actions";

const navLinks = [
  { href: "/", label: "Inicio" },
  { href: "/catalogo", label: "Catálogo" },
];

export async function Header() {
  const user = await getCurrentUser();
  const role = user?.profile?.role;
  const isStaff = role === "admin" || role === "operator";

  return (
    <header className="border-surface-2 bg-bg/80 sticky top-0 z-[200] border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="font-display text-primary text-xl font-bold tracking-wide"
        >
          HEFESTO<span className="text-fg"> 3D</span>
        </Link>
        <nav className="flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-dim hover:text-fg text-sm transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <CartButton />
          {isStaff ? (
            <Link
              href="/admin"
              className="text-primary hover:text-primary-strong text-sm transition-colors"
            >
              Panel
            </Link>
          ) : null}
          {user ? (
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-dim hover:text-fg text-sm transition-colors"
              >
                Salir
              </button>
            </form>
          ) : (
            <Link
              href="/ingresar"
              className="text-dim hover:text-fg text-sm transition-colors"
            >
              Ingresar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
