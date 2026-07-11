import { requirePermissionPage } from "@/core/auth/permissions";
import { RewardsAdmin } from "@/features/rewards/components/rewards-admin";
import { getRewardsStats, listRewards } from "@/features/rewards/service";
import { listProductsAdmin } from "@/features/products/services/catalogService";
import { loadOrThrow } from "@/lib/safe-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recompensas" };

export default async function RecompensasPage() {
  await requirePermissionPage("recompensas", "ver");
  // Carga etiquetada y con deadline: si la DB no responde, error claro en el
  // boundary y log [admin:recompensas] — nunca un cuelgue de 30 s (2026-07-11).
  const [rewards, stats, productsPage] = await loadOrThrow(
    "recompensas",
    Promise.all([
      listRewards(),
      getRewardsStats(),
      listProductsAdmin({ page: 1, pageSize: 500 }),
    ]),
  );

  const products = productsPage.items
    .filter((p) => p.status === "published")
    .map((p) => ({ id: p.id, name: p.name }));

  return <RewardsAdmin rewards={rewards} stats={stats} products={products} />;
}
