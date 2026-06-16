import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRODUCT_SORTS, type ProductFilter } from "../schemas";
import type { Category } from "../types";

const sortLabels: Record<(typeof PRODUCT_SORTS)[number], string> = {
  newest: "Más nuevos",
  price_asc: "Precio: menor a mayor",
  price_desc: "Precio: mayor a menor",
  name: "Nombre (A-Z)",
};

const fieldClass =
  "w-full rounded-md border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-fg";
const labelClass = "mb-1 block text-xs font-medium text-dim";

export function FilterPanel({
  categories,
  materials,
  filter,
}: {
  categories: Category[];
  materials: string[];
  filter: ProductFilter;
}) {
  return (
    <form
      method="get"
      action="/catalogo"
      className="border-surface-2 bg-surface-1 space-y-4 rounded-lg border p-4"
    >
      {/* Al filtrar, volvemos a la página 1 */}
      <input type="hidden" name="page" value="1" />

      <div>
        <label className={labelClass} htmlFor="f-category">
          Categoría
        </label>
        <select
          id="f-category"
          name="category"
          defaultValue={filter.category ?? ""}
          className={fieldClass}
        >
          <option value="">Todas</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="f-material">
          Material
        </label>
        <select
          id="f-material"
          name="material"
          defaultValue={filter.material ?? ""}
          className={fieldClass}
        >
          <option value="">Todos</option>
          {materials.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="f-sort">
          Ordenar por
        </label>
        <select
          id="f-sort"
          name="sort"
          defaultValue={filter.sort}
          className={fieldClass}
        >
          {PRODUCT_SORTS.map((s) => (
            <option key={s} value={s}>
              {sortLabels[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className={labelClass} htmlFor="f-min">
            Precio mín.
          </label>
          <input
            id="f-min"
            name="minPrice"
            type="number"
            min="0"
            defaultValue={filter.minPrice ?? ""}
            className={fieldClass}
          />
        </div>
        <div className="flex-1">
          <label className={labelClass} htmlFor="f-max">
            Precio máx.
          </label>
          <input
            id="f-max"
            name="maxPrice"
            type="number"
            min="0"
            defaultValue={filter.maxPrice ?? ""}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-fg flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="onSale"
            value="true"
            defaultChecked={filter.onSale ?? false}
          />
          Solo ofertas
        </label>
        <label className="text-fg flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isNew"
            value="true"
            defaultChecked={filter.isNew ?? false}
          />
          Solo novedades
        </label>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button type="submit" className={buttonVariants({ size: "sm" })}>
          Aplicar
        </button>
        <Link
          href="/catalogo"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Limpiar
        </Link>
      </div>
    </form>
  );
}
