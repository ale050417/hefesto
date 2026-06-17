import Link from "next/link";
import { notFound } from "next/navigation";
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
    isFeatured: product.isFeatured,
    isNew: product.isNew,
  };

  return (
    <div className="mx-auto max-w-3xl">
      <nav className="text-dim text-sm">
        <Link href="/admin/productos" className="hover:text-fg">
          Productos
        </Link>{" "}
        / <span className="text-fg">{product.name}</span>
      </nav>
      <h1 className="font-display text-fg mt-2 text-2xl">Editar producto</h1>

      <div className="border-surface-2 bg-surface-1 mt-6 rounded-lg border p-4">
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
