import Link from "next/link";
import { requireUser } from "@/core/auth/session";
import { buttonVariants } from "@/components/ui/button";
import { ProductGrid } from "@/features/products/components/product-grid";
import { getWishlist } from "@/features/wishlist/service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Favoritos" };

export default async function WishlistPage() {
  const user = await requireUser("/cuenta/favoritos");
  const products = await getWishlist(user.id);

  if (products.length === 0) {
    return (
      <div className="ui-card p-10 text-center">
        <p className="text-dim">Todavía no guardaste favoritos.</p>
        <Link
          href="/catalogo"
          className={cn(buttonVariants({ variant: "primary" }), "mt-4")}
        >
          Explorar catálogo
        </Link>
      </div>
    );
  }

  return <ProductGrid products={products} />;
}
