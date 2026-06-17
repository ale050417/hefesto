import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CategoryForm,
  type CategoryFormValues,
} from "@/features/products/components/category-form";
import { getCategoryAdmin } from "@/features/products/services/catalogService";

export const dynamic = "force-dynamic";

export default async function EditarCategoriaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = await getCategoryAdmin(id);
  if (!category) notFound();

  const defaults: CategoryFormValues = {
    name: category.name,
    slug: category.slug,
    icon: category.icon ?? "",
    color: category.color ?? "",
    sortOrder: category.sortOrder.toString(),
  };

  return (
    <div className="mx-auto max-w-xl">
      <nav className="text-dim text-sm">
        <Link href="/admin/categorias" className="hover:text-fg">
          Categorías
        </Link>{" "}
        / <span className="text-fg">{category.name}</span>
      </nav>
      <h1 className="font-display text-fg mt-2 text-2xl">Editar categoría</h1>
      <div className="mt-6">
        <CategoryForm
          mode="edit"
          categoryId={category.id}
          defaultValues={defaults}
        />
      </div>
    </div>
  );
}
