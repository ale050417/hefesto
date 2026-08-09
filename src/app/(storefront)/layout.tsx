import { Suspense, type ReactNode } from "react";
import { SessionGuardMount } from "@/features/auth/components/session-guard-mount";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { ToTop } from "@/components/layout/to-top";
import { ScrollToTopOnNavigate } from "@/components/layout/scroll-to-top-on-navigate";
import { WhatsappFab } from "@/components/layout/whatsapp-fab";
import { TopBanner } from "@/components/layout/top-banner";
import { CartDrawer } from "@/features/cart/components/cart-drawer";
import { InquiryDrawer } from "@/features/cart/components/inquiry-drawer";
import { AuthModal } from "@/features/auth/components/auth-modal";
import { FavDrawer } from "@/features/wishlist/components/fav-drawer";
import { StoreSeasonDecoration } from "@/features/settings/components/store-season-decoration";
import { getBrandSettings } from "@/features/settings/service";

export default async function StorefrontLayout({
  children,
}: {
  children: ReactNode;
}) {
  const brand = await getBrandSettings();
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Carrito y favoritos son de QUIEN inició sesión: si cambia el usuario o
          se cierra sesión, se limpia todo lo guardado en el navegador. En
          Suspense para no frenar el resto del layout. */}
      <Suspense fallback={null}>
        <SessionGuardMount />
      </Suspense>
      {/* useSearchParams necesita Suspense en el layout (Next 15+). */}
      <Suspense fallback={null}>
        <ScrollToTopOnNavigate />
      </Suspense>
      <Header />
      <TopBanner />
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
      <InquiryDrawer whatsappPhone={brand.whatsapp} />
      <AuthModal />
      <FavDrawer />
      <ToTop />
      <WhatsappFab />
      <StoreSeasonDecoration />
    </div>
  );
}
