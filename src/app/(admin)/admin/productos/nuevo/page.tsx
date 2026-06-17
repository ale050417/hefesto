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
