import Link from "next/link";
import { requireUser } from "@/core/auth/session";
import { AccountShell } from "@/features/customers/components/account-shell";
import { ProductGrid } from "@/features/products/components/product-grid";
import { getWishlist } from "@/features/wishlist/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Favoritos" };

function Heart({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      aria-hidden
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

export default async function WishlistPage() {
  const user = await requireUser("/cuenta/favoritos");
  const products = await getWishlist(user.id);

  return (
    <AccountShell>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display flex items-center gap-2 text-xl font-bold">
            <span className="text-[var(--danger)]">
              <Heart />
            </span>
            Mis favoritos
          </h2>
          {products.length > 0 ? (
            <span className="text-faint text-[12.5px]">
              {products.length}{" "}
              {products.length === 1 ? "producto" : "productos"}
            </span>
          ) : null}
        </div>

        {products.length === 0 ? (
          <div className="ui-card flex flex-col items-center px-5 py-12 text-center">
            <span className="text-faint">
              <Heart size={36} />
            </span>
            <div className="text-fg mt-3 font-semibold">
              Tu lista de favoritos está vacía
            </div>
            <div className="text-faint mt-1 max-w-sm text-[13px]">
              Tocá el ♥ en cualquier producto del catálogo para guardarlo acá y
              encontrarlo rápido.
            </div>
            <Link href="/catalogo" className="btn btn-primary mt-5">
              Explorar catálogo
            </Link>
          </div>
        ) : (
          <ProductGrid products={products} />
        )}
      </div>
    </AccountShell>
  );
}
