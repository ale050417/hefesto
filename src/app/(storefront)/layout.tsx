import type { ReactNode } from "react";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { ToTop } from "@/components/layout/to-top";
import { WhatsappFab } from "@/components/layout/whatsapp-fab";
import { TopBanner } from "@/components/layout/top-banner";
import { CartDrawer } from "@/features/cart/components/cart-drawer";
import { AuthModal } from "@/features/auth/components/auth-modal";
import { FavDrawer } from "@/features/wishlist/components/fav-drawer";
import { WishlistLoader } from "@/features/wishlist/components/wishlist-loader";
import { StoreSeasonDecoration } from "@/features/settings/components/store-season-decoration";

// El layout de tienda renderiza el Header y la decoración de temporada, que leen
// configuración de la base (marca/tema). Forzamos render dinámico (por request)
// para NO pre-renderizar en el build: así un deploy nunca depende de que la base
// esté arriba, y además la tienda muestra siempre datos vivos. (Cap. 16)
export const dynamic = "force-dynamic";

export default function StorefrontLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <TopBanner />
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
      <AuthModal />
      <FavDrawer />
      <WishlistLoader />
      <ToTop />
      <WhatsappFab />
      <StoreSeasonDecoration />
    </div>
  );
}
