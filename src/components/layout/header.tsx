import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/core/auth/session";
import { getBrandSettings } from "@/features/settings/service";
import { CartButton } from "@/features/cart/components/cart-button";
import { logoutAction } from "@/features/auth/actions";
import { SearchBox } from "@/features/products/components/search-box";
import { BrandMark } from "./brand-mark";
import { ThemeSwitcher } from "./theme-switcher";

export async function Header() {
  const [user, brand] = await Promise.all([
    getCurrentUser(),
    getBrandSettings(),
  ]);
  const role = user?.profile?.role;
  const isStaff = role === "admin" || role === "operator";

  return (
    <header className="topbar">
      <Link href="/" className="brand">
        {brand.logoUrl ? (
          <Image
            src={brand.logoUrl}
            alt="Hefesto 3D"
            width={150}
            height={40}
            className="h-9 w-auto object-contain"
            priority
          />
        ) : (
          <>
            <BrandMark size={38} />
            <span className="flex flex-col leading-tight">
              <span className="brand-name">
                HEFESTO<b> 3D</b>
              </span>
              <span className="brand-sub">Impresión 3D a pedido</span>
            </span>
          </>
        )}
      </Link>

      <div className="mx-2 hidden flex-1 justify-center sm:flex">
        <div className="w-full max-w-md">
          <SearchBox />
        </div>
      </div>

      <nav className="ml-auto flex items-center gap-4 sm:gap-5">
        <Link href="/" className="nav-link hidden sm:inline">
          Inicio
        </Link>
        <Link href="/catalogo" className="nav-link">
          Catálogo
        </Link>
        <CartButton />
        <ThemeSwitcher />
        {isStaff ? (
          <Link
            href="/admin"
            className="nav-link"
            style={{ color: "var(--gold-bright)" }}
          >
            Panel
          </Link>
        ) : null}
        {user ? (
          <>
            <Link href="/cuenta" className="nav-link">
              Mi cuenta
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="nav-link">
                Salir
              </button>
            </form>
          </>
        ) : (
          <Link href="/ingresar" className="nav-link">
            Ingresar
          </Link>
        )}
      </nav>
    </header>
  );
}
