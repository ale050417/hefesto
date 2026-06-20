import Link from "next/link";
import { Pagination } from "@/components/shared/pagination";
import { FilterPanel } from "@/features/products/components/filter-panel";
import { SortSelect } from "@/features/products/components/sort-select";
import { ProductGrid } from "@/features/products/components/product-grid";
import { productFilterSchema } from "@/features/products/schemas";
import {
  listCategories,
  listMaterials,
  listProducts,
} from "@/features/products/services/catalogService";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

/** Deja solo strings no vacíos (sanitiza los query params). */
function clean(sp: SearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(sp)) {
    const val = Array.isArray(value) ? value[0] : value;
    if (typeof val === "string" && val !== "") out[key] = val;
  }
  return out;
}

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = clean(await searchParams);
  const parsed = productFilterSchema.safeParse(raw);
  const filter = parsed.success ? parsed.data : productFilterSchema.parse({});

  const [page, categories, materials] = await Promise.all([
    listProducts(filter),
    listCategories(),
    listMaterials(),
  ]);

  const baseParams = { ...raw };
  delete baseParams.page;

  return (
    <div className="store-wrap py-10">
      <nav className="text-dim text-sm">
        <Link href="/" className="hover:text-fg">
          Inicio
        </Link>{" "}
        / <span className="text-fg">Catálogo</span>
      </nav>
      <div className="sec-head mt-2">
        <div>
          <div className="eyebrow">Tienda</div>
          <h1 className="sec-title">Catálogo</h1>
          <div className="sec-sub">
            {page.total} {page.total === 1 ? "producto" : "productos"}
          </div>
        </div>
        <SortSelect sort={filter.sort} />
      </div>

      <div className="catalog-grid mt-2">
        <FilterPanel categories={categories} materials={materials} />
        <div>
          <ProductGrid products={page.items} />
          <Pagination
            page={page.page}
            totalPages={page.totalPages}
            params={baseParams}
          />
        </div>
      </div>
    </div>
  );
}
