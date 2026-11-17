import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getStaffUser } from "@/core/auth/session";
import { countAllSalesByStatus } from "@/features/orders/repository";
import { listFilamentsView } from "@/features/inventory/queries";
import { countOpenFixes } from "@/features/arreglos/queries";
import { countOpenInquiries } from "@/features/consultas/queries";
import { safeLoad } from "@/lib/safe-load";

/**
 * Contadores del menú lateral (2026-10-21): pedidos pendientes de pago, en
 * producción, filamentos con stock bajo y arreglos por resolver. Cacheado 30 s para que abrir el
 * panel no sume queries (el pool de la DB es chico).
 */
export const dynamic = "force-dynamic";

const getCounts = unstable_cache(
  async () => {
    const [ordersR, lowR, fixesR, inquiriesR] = await Promise.all([
      safeLoad(
        "nav:orders",
        countAllSalesByStatus(),
        {} as Record<string, number>,
      ),
      safeLoad(
        "nav:lowStock",
        listFilamentsView().then((fs) => fs.filter((f) => f.lowStock).length),
        0,
      ),
      safeLoad("nav:openFixes", countOpenFixes(), 0),
      safeLoad("nav:openInquiries", countOpenInquiries(), 0),
    ]);
    const o = ordersR.value;
    return {
      pendingOrders: o.pending_payment ?? 0,
      inProduction: (o.confirmed ?? 0) + (o.in_production ?? 0),
      lowStock: lowR.value,
      openFixes: fixesR.value,
      openInquiries: inquiriesR.value,
    };
  },
  ["admin-nav-counts"],
  { revalidate: 30 },
);

export async function GET() {
  let staff;
  try {
    staff = await getStaffUser();
  } catch {
    return NextResponse.json({ error: "auth" }, { status: 503 });
  }
  if (!staff) return NextResponse.json({ error: "auth" }, { status: 401 });
  return NextResponse.json(await getCounts());
}
