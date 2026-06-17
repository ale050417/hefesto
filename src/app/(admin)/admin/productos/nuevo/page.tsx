import Link from "next/link";
import {
  ProductForm,
  type ProductFormValues,
} from "@/features/products/components/product-form";
import { listCategories } from "@/features/products/services/catalogService";

export const dynamic = "force-dynamic";

const emptyDefaults: ProductFormValues = {
  name: "",
  slug: "",
  description: "",
  categoryId: "",
  price: "",
  salePrice: "",
  material: "",
  printTimeMinutes: "",
  weightGrams: "",
  dimensions: "",
  isFeatured: false,
  isNew: false,
};

export default async function NuevoProductoPage() {
  const categories = await listCategories();
  return (
    <div className="mx-auto max-w-2xl">
      <nav className="text-dim text-sm">
        <Link href="/admin/productos" className="hover:text-fg">
          Productos
        </Link>{" "}
        / <span className="text-fg">Nuevo</span>
      </nav>
      <h1 className="font-display text-fg mt-2 text-2xl">Nuevo producto</h1>
      <p className="text-dim mt-1 text-sm">
        Creá el producto; después podrás subir imágenes y publicarlo.
      </p>
      <div className="mt-6">
        <ProductForm
          mode="create"
          categories={categories}
          defaultValues={emptyDefaults}
        />
      </div>
    </div>
  );
}
