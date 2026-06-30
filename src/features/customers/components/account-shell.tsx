import type { ReactNode } from "react";
import { requireUser } from "@/core/auth/session";
import { AccountNav } from "@/features/customers/components/account-nav";
import { logoutAction } from "@/features/auth/actions";
import { getMyOrders } from "@/features/orders/services/orderQueries";
import { getBalance } from "@/features/rewards/service";
import { getWishlistIds } from "@/features/wishlist/service";
import { compactPrice } from "@/lib/format";

const ICONS = {
  package:
    '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
  dollar:
    '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  sparkles:
    '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
};

function Ic({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: d }}
    />
  );
}

export async function AccountShell({ children }: { children: ReactNode }) {
  const user = await requireUser("/cuenta");
  const [orders, points, favIds] = await Promise.all([
    getMyOrders(user.id),
    getBalance(user.id),
    getWishlistIds(user.id),
  ]);
  const name = user.profile?.fullName?.trim() || user.email || "Cliente";
  const initial = name.trim()[0]?.toUpperCase() ?? "?";
  const spent = orders
    .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
    .reduce((a, o) => a + o.total, 0);
  const since = user.profile?.createdAt
    ? new Date(user.profile.createdAt).toLocaleDateString("es-AR", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <>
      <div className="ui-card acc-hero">
        <div className="acc-hero-bg" />
        <div className="relative z-[2] flex items-center gap-4">
          <span
            className="avatar"
            style={{
              width: 72,
              height: 72,
              fontSize: 28,
              boxShadow: "0 6px 20px rgba(var(--gold-rgb),.3)",
            }}
          >
            {initial}
          </span>
          <div className="grow">
            <h1 className="font-display text-2xl font-bold">{name}</h1>
            <div className="text-faint mt-1 text-sm">
              {user.email}
              {since ? ` · Cliente desde ${since}` : ""}
            </div>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-secondary">
              <Ic d={ICONS.logout} size={16} /> Cerrar sesión
            </button>
          </form>
        </div>

        <div className="acc-stats">
          <div className="acc-stat">
            <span className="as-ic">
              <Ic d={ICONS.package} />
            </span>
            <div>
              <div className="as-n">{orders.length}</div>
              <div className="as-l">Pedidos</div>
            </div>
          </div>
          <div className="acc-stat">
            <span className="as-ic">
              <Ic d={ICONS.dollar} />
            </span>
            <div>
              <div className="as-n">{compactPrice(spent)}</div>
              <div className="as-l">Total gastado</div>
            </div>
          </div>
          <div className="acc-stat">
            <span className="as-ic">
              <Ic d={ICONS.heart} />
            </span>
            <div>
              <div className="as-n">{favIds.length}</div>
              <div className="as-l">Favoritos</div>
            </div>
          </div>
          <div className="acc-stat">
            <span className="as-ic">
              <Ic d={ICONS.sparkles} />
            </span>
            <div>
              <div className="as-n" style={{ color: "var(--gold-bright)" }}>
                {points}
              </div>
              <div className="as-l">Puntos</div>
            </div>
          </div>
        </div>
      </div>

      <div className="acc-layout">
        <AccountNav />
        <div className="acc-panel">{children}</div>
      </div>
    </>
  );
}
