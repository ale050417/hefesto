import { apiOk, PUBLIC_CACHE, withApi } from "@/core/api/respond";
import { getHomeData } from "@/features/products/services/catalogService";
import {
  getActiveBanners,
  getBrandSettings,
} from "@/features/settings/service";
import { getHomeStats } from "@/features/orders/services/publicStats";
import { safeLoad } from "@/lib/safe-load";

/**
 * GET /api/v1/home — vidriera de la app (2026-10-31, pedido de Ale: app
 * Android/iOS). Misma data que la home web: banners, marca, categorías con
 * cantidad, destacados / nuevos / ofertas y estadísticas.
 *
 * Los productos son los `ProductView` del catálogo (precio real ya calculado):
 * la app NUNCA recalcula precios, solo los muestra.
 */
export const dynamic = "force-dynamic";

export const GET = withApi("home", async () => {
  const [home, bannersR, brandR, statsR] = await Promise.all([
    getHomeData(),
    safeLoad("api:banners", getActiveBanners(), []),
    safeLoad("api:brand", getBrandSettings(), null),
    safeLoad("api:stats", getHomeStats(), { pieces: 0, customers: 0 }),
  ]);
  const brand = brandR.value;

  return apiOk(
    {
      brand: brand && {
        storeName: brand.storeName,
        slogan: brand.slogan,
        logoUrl: brand.logoUrl,
        whatsapp: brand.whatsapp,
        instagram: brand.instagram,
        facebook: brand.facebook,
        contactEmail: brand.contactEmail,
        businessMode: brand.businessMode,
        accentColor: brand.accentColor,
        bannerIntervalSec: brand.bannerIntervalSec,
        trustBar: brand.trustBar,
      },
      banners: bannersR.value.map((b) => ({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        imageUrl: b.imageUrl,
        position: b.position,
        align: b.align,
        ctaText: b.ctaText,
        ctaHref: b.ctaHref,
      })),
      stats: statsR.value,
      categories: home.categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        color: c.color,
        imageUrl: c.imageUrl,
        parentId: c.parentId,
        productCount: c.productCount,
      })),
      featured: home.featured,
      latest: home.latest,
      onSale: home.onSale,
    },
    PUBLIC_CACHE,
  );
});
