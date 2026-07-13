import Link from "next/link";
import { requirePermissionPage } from "@/core/auth/permissions";
import { ProductWizard } from "@/features/products/components/product-wizard";
import { listCategories } from "@/features/products/services/catalogService";
import { getEstimatorContext } from "@/features/calculator/service";
import { listColorCatalog } from "@/features/inventory/queries";
import { getBrandSettings } from "@/features/settings/service";
import { sectionOn } from "@/features/settings/home-sections";
import { loadOrThrow } from "@/lib/safe-load";

export const dynamic = "force-dynamic";

export default async function NuevoProductoPage() {
  await requirePermissionPage("productos", "crear");
  // Carga etiquetada y con deadline: error claro + log [admin:productos/nuevo]
  // en vez de un cuelgue de 30 s si la DB no responde (2026-07-11).
  const [categories, estimator, colorCatalog, brand] = await loadOrThrow(
    "productos/nuevo",
    Promise.all([
      listCategories(),
      getEstimatorContext(),
      listColorCatalog(),
      getBrandSettings(),
    ]),
  );
  const sections = {
    nuevos: sectionOn(brand.homeSections, "nuevos"),
    destacados: true, // "Destacado" no depende de una sección togglable del home
  };
  if (categories.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-fg mt-2 text-2xl">Nuevo producto</h1>
        <p className="text-dim mt-3">
          Primero creá una categoría: todo producto debe tener una.
        </p>
        <Link
          href="/admin/categorias"
          className="text-primary mt-4 inline-block text-sm hover:underline"
        >
          Ir a categorías →
        </Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/productos" className="text-dim hover:text-fg text-sm">
        ← Productos
      </Link>
      <div className="page-head mt-2">
        <div>
          <div className="eyebrow">Catálogo</div>
          <h1 className="page-title">Nuevo producto</h1>
          <div className="page-sub">
            Creá el producto; después podrás subir imágenes y publicarlo.
          </div>
        </div>
      </div>
      <div className="mt-2">
        <ProductWizard
          categories={categories}
          estimator={estimator}
          colorCatalog={colorCatalog}
          sections={sections}
        />
      </div>
    </div>
  );
}
