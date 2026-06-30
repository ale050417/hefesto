import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermissionPage } from "@/core/auth/permissions";
import { ImageUpload } from "@/features/products/components/image-upload";
import {
  ProductForm,
  type ProductFormValues,
} from "@/features/products/components/product-form";
import { ProductStatusActions } from "@/features/products/components/product-status-actions";
import {
  getProductAdmin,
  listCategories,
} from "@/features/products/services/catalogService";

export const dynamic = "force-dynamic";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermissionPage("productos", "editar");
  const { id } = await params;
  const [data, categories] = await Promise.all([
    getProductAdmin(id),
    listCategories(),
  ]);
  if (!data) notFound();
  const { product, images } = data;

  const defaults: ProductFormValues = {
    name: product.name,
    slug: product.slug,
    description: product.description ?? "",
    categoryId: product.categoryId ?? "",
    price: product.price,
    salePrice: product.salePrice ?? "",
    material: product.material ?? "",
    printTimeMinutes: product.printTimeMinutes?.toString() ?? "",
    weightGrams: product.weightGrams?.toString() ?? "",
    dimensions: product.dimensions ?? "",
    colorMode: product.colorMode === "multi" ? "multi" : "single",
    colors: product.colors ?? [],
    colorPrices: product.colorPrices ?? {},
    layerHeight: product.layerHeight ?? "",
    infillPercent: product.infillPercent?.toString() ?? "",
    productionTime: product.productionTime ?? "",
    isFeatured: product.isFeatured,
    isNew: product.isNew,
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/productos" className="text-dim hover:text-fg text-sm">
        ← Productos
      </Link>
      <div className="page-head mt-2">
        <div>
          <div className="eyebrow">Catálogo</div>
          <h1 className="page-title">Editar producto</h1>
          <div className="page-sub">{product.name}</div>
        </div>
      </div>

      <div className="ui-card p-4">
        <ProductStatusActions productId={product.id} status={product.status} />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-fg mb-3 text-lg">Datos</h2>
          <ProductForm
            mode="edit"
            productId={product.id}
            categories={categories}
            defaultValues={defaults}
          />
        </div>
        <div>
          <h2 className="font-display text-fg mb-3 text-lg">Imágenes</h2>
          <ImageUpload productId={product.id} images={images} />
        </div>
      </div>
    </div>
  );
}
