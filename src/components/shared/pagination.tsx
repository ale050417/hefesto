import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  totalPages,
  params,
  basePath = "/catalogo",
}: {
  page: number;
  totalPages: number;
  params: Record<string, string>;
  basePath?: string;
}) {
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => {
    const sp = new URLSearchParams(params);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };

  const disabled = "pointer-events-none opacity-50";

  return (
    <nav className="mt-10 flex items-center justify-center gap-4">
      {page <= 1 ? (
        <span
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            disabled,
          )}
        >
          Anterior
        </span>
      ) : (
        <Link
          href={hrefFor(page - 1)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Anterior
        </Link>
      )}

      <span className="text-dim text-sm">
        Página {page} de {totalPages}
      </span>

      {page >= totalPages ? (
        <span
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            disabled,
          )}
        >
          Siguiente
        </span>
      ) : (
        <Link
          href={hrefFor(page + 1)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Siguiente
        </Link>
      )}
    </nav>
  );
}
