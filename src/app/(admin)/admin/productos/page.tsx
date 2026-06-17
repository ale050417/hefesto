import Image from "next/image";
import Link from "next/link";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { listProductsAdmin } from "@/features/products/services/catalogService";
import type { ProductStatus } from "@/features/products/types";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const STATUSES: ProductStatus[] = ["draft", "published", "archived"];
const statusLabel: Record<ProductStatus, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};
const statusVariant: Record<ProductStatus, "warning" | "success" | "neutral"> =
  {
    draft: "warning",
    published: "success",
    archived: "neutral",
  };

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v !== "" ? v : undefined;
}

export default async function ProductosAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const search = first(sp.q);
  const statusParam = first(sp.status);
  const status = STATUSES.includes(statusParam as ProductStatus)
    ? (statusParam as ProductStatus)
    : undefined;
  const pageParam = Number(first(sp.page) ?? "1");
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const result = await listProductsAdmin({
    search,
    status,
    page,
    pageSize: 20,
  });

  const baseParams: Record<string, string> = {};
  if (search) baseParams.q = search;
  if (status) baseParams.status = status;

  const field =
    "rounded-md border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-fg";

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Catálogo</p>
          <h1 className="font-display text-fg mt-1 text-2xl">Productos</h1>
        </div>
        <Link
          href="/admin/productos/nuevo"
          className={buttonVariants({ size: "sm" })}
        >
          Nuevo producto
        </Link>
      </div>

      <form method="get" className="mt-6 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={search ?? ""}
          placeholder="Buscar por nombre..."
          className={`${field} min-w-48 flex-1`}
        />
        <select name="status" defaultValue={status ?? ""} className={field}>
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel[s]}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonVariants({ size: "sm" })}>
          Filtrar
        </button>
      </form>

      <p className="text-dim mt-4 text-sm">
        {result.total} {result.total === 1 ? "producto" : "productos"}
      </p>

      <div className="border-surface-2 mt-3 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-dim text-left text-xs">
            <tr>
              <th className="p-3 font-medium">Producto</th>
              <th className="p-3 font-medium">Categoría</th>
              <th className="p-3 font-medium">Precio</th>
              <th className="p-3 font-medium">Estado</th>
              <th className="p-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-dim p-6 text-center">
                  No hay productos.
                </td>
              </tr>
            ) : (
              result.items.map((p) => (
                <tr key={p.id} className="border-surface-2 border-t">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-surface-2 relative h-10 w-10 shrink-0 overflow-hidden rounded">
                        {p.primaryImage ? (
                          <Image
                            src={p.primaryImage}
                            alt={p.name}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <span className="text-fg">{p.name}</span>
                    </div>
                  </td>
                  <td className="text-dim p-3">{p.categoryName ?? "—"}</td>
                  <td className="text-fg p-3">{formatPrice(p.price)}</td>
                  <td className="p-3">
                    <Badge variant={statusVariant[p.status]}>
                      {statusLabel[p.status]}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/admin/productos/${p.id}/editar`}
                      className="text-primary text-sm hover:underline"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        params={baseParams}
        basePath="/admin/productos"
      />
    </div>
  );
}
