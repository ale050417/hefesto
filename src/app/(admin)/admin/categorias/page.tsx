import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { DeleteCategoryButton } from "@/features/products/components/delete-category-button";
import { listCategoriesAdmin } from "@/features/products/services/catalogService";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const categories = await listCategoriesAdmin();

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Catálogo</p>
          <h1 className="font-display text-fg mt-1 text-2xl">Categorías</h1>
        </div>
        <Link
          href="/admin/categorias/nueva"
          className={buttonVariants({ size: "sm" })}
        >
          Nueva categoría
        </Link>
      </div>

      {categories.length === 0 ? (
        <p className="text-dim mt-8">Todavía no hay categorías.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <div
              key={c.id}
              className="border-surface-2 bg-surface-1 rounded-lg border p-4"
            >
              <div className="flex items-center gap-3">
                <span
                  className="border-surface-3 h-6 w-6 shrink-0 rounded-full border"
                  style={{ backgroundColor: c.color ?? "transparent" }}
                />
                <div className="min-w-0">
                  <p className="text-fg truncate font-medium">{c.name}</p>
                  <p className="text-faint truncate text-xs">/{c.slug}</p>
                </div>
              </div>
              <p className="text-dim mt-3 text-sm">
                {c.productCount}{" "}
                {c.productCount === 1 ? "producto" : "productos"}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <Link
                  href={`/admin/categorias/${c.id}/editar`}
                  className="text-primary text-sm hover:underline"
                >
                  Editar
                </Link>
                <DeleteCategoryButton id={c.id} productCount={c.productCount} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
