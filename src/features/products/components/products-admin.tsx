"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/stores/toastStore";
import { formatPrice } from "@/lib/format";
import { archiveProductAction, getProductFormDataAction } from "../actions";
import type {
  AdminProductRow,
  Category,
  ProductImage,
  ProductStatus,
} from "../types";
import type { EstimatorContext } from "@/features/calculator/service";
import { ProductForm, type ProductFormValues } from "./product-form";
import { ImageUpload } from "./image-upload";
import { ProductStatusActions } from "./product-status-actions";

const EMPTY_DEFAULTS: ProductFormValues = {
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
  colorMode: "single",
  colors: [],
  colorPrices: {},
  layerHeight: "",
  infillPercent: "",
  productionTime: "",
  isFeatured: false,
  isNew: false,
};

type View = "grid" | "list";
type ModalState =
  | { open: false }
  | { open: true; mode: "create" }
  | {
      open: true;
      mode: "edit";
      productId: string;
      name: string;
      status: ProductStatus;
      defaults: ProductFormValues;
      images: ProductImage[];
    };

const Icon = {
  plus: (
    <svg
      viewBox="0 0 24 24"
      width={17}
      height={17}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  edit: (
    <svg
      viewBox="0 0 24 24"
      width={15}
      height={15}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  trash: (
    <svg
      viewBox="0 0 24 24"
      width={15}
      height={15}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
    </svg>
  ),
  layers: (
    <svg
      viewBox="0 0 24 24"
      width={13}
      height={13}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2 2 7l10 5 10-5z" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
};

export function ProductsAdmin({
  products,
  categories,
  estimator,
}: {
  products: AdminProductRow[];
  categories: Category[];
  estimator: EstimatorContext;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [view, setView] = useState<View>("grid");
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [pendingId, setPendingId] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (catFilter !== "all" && p.categoryId !== catFilter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, catFilter]);

  const published = products.filter((p) => p.status === "published").length;

  async function openEdit(id: string) {
    setPendingId(id);
    const res = await getProductFormDataAction(id);
    setPendingId(null);
    if (!res.ok) return toast(res.error.message, "danger");
    setModal({
      open: true,
      mode: "edit",
      productId: id,
      name: res.data.name,
      status: res.data.status,
      defaults: res.data.defaults,
      images: res.data.images,
    });
  }

  // Tras crear, pasamos el mismo modal a edición (para subir imágenes).
  async function handleSaved(id: string) {
    const res = await getProductFormDataAction(id);
    if (!res.ok) {
      setModal({ open: false });
      router.refresh();
      return;
    }
    setModal({
      open: true,
      mode: "edit",
      productId: id,
      name: res.data.name,
      status: res.data.status,
      defaults: res.data.defaults,
      images: res.data.images,
    });
  }

  async function reloadEdit() {
    if (!modal.open || modal.mode !== "edit") return;
    const res = await getProductFormDataAction(modal.productId);
    if (res.ok) {
      setModal({
        open: true,
        mode: "edit",
        productId: modal.productId,
        name: res.data.name,
        status: res.data.status,
        defaults: res.data.defaults,
        images: res.data.images,
      });
    }
  }

  async function archive(p: AdminProductRow) {
    if (
      !window.confirm(
        `¿Archivar "${p.name}"? Dejará de mostrarse en la tienda.`,
      )
    )
      return;
    setPendingId(p.id);
    const res = await archiveProductAction(p.id);
    setPendingId(null);
    if (res.ok) {
      toast("Producto archivado", "danger");
      router.refresh();
    } else {
      toast(res.error.message, "danger");
    }
  }

  const off = (p: AdminProductRow) =>
    p.salePrice ? Math.round((1 - p.salePrice / p.price) * 100) : 0;

  return (
    <div className="view grid gap-5">
      <div className="page-head">
        <div>
          <div className="eyebrow">Catálogo</div>
          <h1 className="page-title">Productos</h1>
          <div className="page-sub">
            {products.length} productos · {published} publicados · todo hecho a
            pedido
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setModal({ open: true, mode: "create" })}
        >
          {Icon.plus} Nuevo producto
        </button>
      </div>

      <div className="toolbar">
        <div className="search" style={{ width: 260 }}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            className="input"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          className={`chip${catFilter === "all" ? "active" : ""}`}
          onClick={() => setCatFilter("all")}
        >
          Todas
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`chip${catFilter === c.id ? "active" : ""}`}
            onClick={() => setCatFilter(c.id)}
          >
            {c.name}
          </button>
        ))}
        <div className="grow" />
        <div className="mode-switch">
          <button
            className={view === "grid" ? "active" : ""}
            onClick={() => setView("grid")}
            title="Grilla"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
          <button
            className={view === "list" ? "active" : ""}
            onClick={() => setView("list")}
            title="Lista"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="ui-card section-card flex flex-col items-center gap-2 p-10 text-center">
          <div className="text-dim">No se encontraron productos.</div>
        </div>
      ) : view === "grid" ? (
        <div className="grid-4">
          {list.map((p) => (
            <div
              key={p.id}
              className="prod-card cursor-pointer"
              onClick={() => openEdit(p.id)}
            >
              <div className="prod-media">
                {p.primaryImage ? (
                  <Image
                    src={p.primaryImage}
                    alt={p.name}
                    fill
                    sizes="240px"
                    className="object-cover"
                  />
                ) : (
                  <div className="ph" />
                )}
                <div className="prod-badges">
                  {p.isNew ? (
                    <span className="badge badge-gold">Nuevo</span>
                  ) : null}
                  {off(p) ? (
                    <span className="badge badge-danger">-{off(p)}%</span>
                  ) : null}
                  {p.status !== "published" ? (
                    <span className="badge badge-neutral">Oculto</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="grid place-items-center rounded-full border border-[var(--border)] text-[var(--text-dim)] backdrop-blur transition-colors hover:text-[var(--gold-bright)]"
                  title="Editar"
                  style={{
                    position: "absolute",
                    bottom: 10,
                    right: 10,
                    zIndex: 3,
                    width: 34,
                    height: 34,
                    background:
                      "color-mix(in srgb, var(--surface-1) 80%, transparent)",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(p.id);
                  }}
                >
                  {Icon.edit}
                </button>
              </div>
              <div className="prod-body">
                <div className="prod-cat">{p.categoryName ?? "—"}</div>
                <div className="prod-name">{p.name}</div>
                <div
                  className="flex items-center gap-2"
                  style={{ fontSize: "11.5px", color: "var(--text-faint)" }}
                >
                  <span className="flex items-center gap-1">
                    {Icon.layers}
                    {p.material ?? "—"}
                  </span>
                </div>
                <div className="prod-price">
                  {p.salePrice ? (
                    <>
                      <span className="now gold">
                        {formatPrice(p.salePrice)}
                      </span>
                      <span className="strike price">
                        {formatPrice(p.price)}
                      </span>
                    </>
                  ) : (
                    <span className="now">{formatPrice(p.price)}</span>
                  )}
                </div>
                <div className="mt-1">
                  <span className="badge badge-gold">A pedido</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="ui-card">
          <div className="table-wrap" style={{ border: "none" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Material</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span
                          className="bg-surface-2 relative block shrink-0 overflow-hidden rounded"
                          style={{ width: 40, height: 40 }}
                        >
                          {p.primaryImage ? (
                            <Image
                              src={p.primaryImage}
                              alt={p.name}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : null}
                        </span>
                        <b>{p.name}</b>
                      </div>
                    </td>
                    <td className="muted">{p.categoryName ?? "—"}</td>
                    <td className="muted">{p.material ?? "—"}</td>
                    <td className="price">
                      {p.salePrice ? (
                        <>
                          <b style={{ color: "var(--gold-bright)" }}>
                            {formatPrice(p.salePrice)}
                          </b>{" "}
                          <span className="strike" style={{ fontSize: 12 }}>
                            {formatPrice(p.price)}
                          </span>
                        </>
                      ) : (
                        <b>{formatPrice(p.price)}</b>
                      )}
                    </td>
                    <td>
                      {p.status === "published" ? (
                        <span className="badge badge-success">Activo</span>
                      ) : (
                        <span className="badge badge-neutral">Oculto</span>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          className="btn-icon btn-ghost"
                          title="Editar"
                          disabled={pendingId === p.id}
                          onClick={() => openEdit(p.id)}
                        >
                          {Icon.edit}
                        </button>
                        <button
                          className="btn-icon btn-ghost"
                          title="Archivar"
                          disabled={pendingId === p.id}
                          onClick={() => archive(p)}
                        >
                          {Icon.trash}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        title={
          modal.open && modal.mode === "edit"
            ? `Editar · ${modal.name}`
            : "Nuevo producto"
        }
        size="lg"
      >
        {modal.open && modal.mode === "create" ? (
          <ProductForm
            mode="create"
            categories={categories}
            defaultValues={EMPTY_DEFAULTS}
            estimator={estimator}
            onSaved={handleSaved}
          />
        ) : modal.open && modal.mode === "edit" ? (
          <div className="flex flex-col gap-5">
            <div className="ui-card p-4">
              <ProductStatusActions
                productId={modal.productId}
                status={modal.status}
              />
            </div>
            <ProductForm
              mode="edit"
              productId={modal.productId}
              categories={categories}
              defaultValues={modal.defaults}
              estimator={estimator}
              onSaved={() => {
                toast("Producto guardado", "success");
                router.refresh();
              }}
            />
            <div>
              <h2 className="font-display text-fg mb-3 text-lg">Imágenes</h2>
              <ImageUpload
                productId={modal.productId}
                images={modal.images}
                onChanged={reloadEdit}
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
