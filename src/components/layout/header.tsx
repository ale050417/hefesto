import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/core/auth/session";
import { getBrandSettings } from "@/features/settings/service";
import { CartButton } from "@/features/cart/components/cart-button";
import { logoutAction } from "@/features/auth/actions";
import { SearchBox } from "@/features/products/components/search-box";
import { AuthTrigger } from "@/features/auth/components/auth-trigger";
import { FavButton } from "@/features/wishlist/components/fav-button";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { BrandMark } from "./brand-mark";
import { StoreNav } from "./store-nav";
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

      <StoreNav />

      <div className="store-search-wrap hidden sm:block">
        <SearchBox />
      </div>

      <div className="store-actions ml-auto">
        <ThemeSwitcher />
        <FavButton />
        {user ? <NotificationBell /> : null}
        <CartButton />

        {isStaff ? (
          <Link
            href="/admin"
            className="store-nav-link"
            style={{ color: "var(--gold-bright)" }}
          >
            Panel
          </Link>
        ) : null}

        {user ? (
          <>
            <Link href="/cuenta" className="store-nav-link">
              Mi cuenta
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="store-nav-link">
                Salir
              </button>
            </form>
          </>
        ) : (
          <AuthTrigger />
        )}
      </div>
    </header>
  );
}
