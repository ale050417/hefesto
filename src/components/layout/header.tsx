import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/core/auth/session";
import { getBrandSettings } from "@/features/settings/service";
import { CartButton } from "@/features/cart/components/cart-button";
import { SearchBox } from "@/features/products/components/search-box";
import { AuthTrigger } from "@/features/auth/components/auth-trigger";
import { UserMenu } from "@/features/auth/components/user-menu";
import { getBalance } from "@/features/rewards/service";
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
  const isClient = !!user && !isStaff;
  const points = user && isClient ? await getBalance(user.id) : null;

  // Nombre a mostrar: nombre real si existe; si no, el email. En cualquier caso
  // recortamos todo lo que venga desde el "@" (cuando el "nombre" es en realidad
  // un email guardado completo) para no romper el chip.
  const rawName = user?.profile?.fullName?.trim() || user?.email || "Usuario";
  const displayName = rawName.split("@")[0] || "Usuario";

  return (
    <>
      <header className="topbar store-topbar">
        <Link href="/" className="brand">
          {brand.logoUrl ? (
            <Image
              src={brand.logoUrl}
              alt="Hefesto 3D"
              width={40}
              height={40}
              className="h-9 w-9 object-contain"
              priority
            />
          ) : (
            <BrandMark size={38} />
          )}
          <span className="brand-col">
            <span className="brand-name" data-preview-name>
              HEFESTO<b> 3D</b>
            </span>
            <span className="brand-sub" data-preview-slogan>
              {brand.slogan || "Forjado en capas"}
            </span>
          </span>
        </Link>

        <div className="store-search-wrap">
          <SearchBox />
        </div>

        <div className="store-actions">
          <span className="store-theme">
            <ThemeSwitcher compact />
          </span>
          {/* Secundarias: en mobile viven dentro de Mi cuenta (CSS las oculta) */}
          <span className="store-extra-actions">
            <FavButton />
            {user ? <NotificationBell /> : null}
          </span>
          <CartButton />

          {user ? (
            <UserMenu
              name={displayName}
              email={user.email}
              points={points}
              isClient={isClient}
              isStaff={isStaff}
            />
          ) : (
            <AuthTrigger />
          )}
        </div>
      </header>

      <div className="store-subnav">
        <div className="store-wrap">
          <StoreNav />
        </div>
      </div>
    </>
  );
}
