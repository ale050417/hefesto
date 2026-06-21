import type { ReactNode } from "react";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { ToTop } from "@/components/layout/to-top";
import { TopBanner } from "@/components/layout/top-banner";
import { CartDrawer } from "@/features/cart/components/cart-drawer";
import { WishlistLoader } from "@/features/wishlist/components/wishlist-loader";

export default function StorefrontLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBanner />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
      <WishlistLoader />
      <ToTop />
    </div>
  );
}
