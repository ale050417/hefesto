import Link from "next/link";
import {
  CategoryForm,
  type CategoryFormValues,
} from "@/features/products/components/category-form";

const emptyDefaults: CategoryFormValues = {
  name: "",
  slug: "",
  icon: "",
  color: "",
  sortOrder: "0",
};

export default function NuevaCategoriaPage() {
  return (
    <div className="mx-auto max-w-xl">
      <nav className="text-dim text-sm">
        <Link href="/admin/categorias" className="hover:text-fg">
          Categorías
        </Link>{" "}
        / <span className="text-fg">Nueva</span>
      </nav>
      <h1 className="font-display text-fg mt-2 text-2xl">Nueva categoría</h1>
      <div className="mt-6">
        <CategoryForm mode="create" defaultValues={emptyDefaults} />
      </div>
    </div>
  );
}
