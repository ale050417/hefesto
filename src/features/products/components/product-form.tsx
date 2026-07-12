"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EstimatorModalButton } from "@/features/calculator/components/estimator-modal-button";
import type { EstimatorValue } from "@/features/calculator/components/price-estimator";
import type { EstimatorContext } from "@/features/calculator/service";
import {
  createProductAction,
  generateDescriptionAction,
  updateProductAction,
} from "../actions";
import type { Category } from "../types";
import { runAction } from "@/lib/run-action";

export type ProductFormValues = {
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  price: string;
  salePrice: string;
  material: string;
  printTimeMinutes: string;
  weightGrams: string;
  dimensions: string;
  colorMode: "single" | "multi";
  colors: string[];
  colorPrices: Record<string, number>;
  layerHeight: string;
  infillPercent: string;
  productionTime: string;
  isFeatured: boolean;
  isNew: boolean;
  status: "draft" | "published";
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ProductForm({
  mode,
  productId,
  categories,
  defaultValues,
  estimator,
  colorCatalog = [],
  newsSectionActive = true,
  onSaved,
}: {
  mode: "create" | "edit";
  productId?: string;
  categories: Category[];
  defaultValues: ProductFormValues;
  /** Contexto de la calculadora embebida (config, filamentos, tipos, isAdmin). */
  estimator: EstimatorContext;
  /** Colores del catálogo (Bloque 1) para elegir los del producto. */
  colorCatalog?: Array<{ name: string; hex: string | null }>;
  /** ¿Está activa la sección "Nuevos" del home? (para habilitar el check). */
  newsSectionActive?: boolean;
  /** Si se pasa, en vez de navegar avisa al contenedor (uso en modal). */
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [colorMode, setColorMode] = useState<"single" | "multi">(
    defaultValues.colorMode ?? "single",
  );
  const [colors, setColors] = useState<string[]>(defaultValues.colors ?? []);
  const [colorPrices, setColorPrices] = useState<Record<string, number>>(
    defaultValues.colorPrices ?? {},
  );
  // Ficha técnica (material/peso/tiempo/altura) la maneja el PriceEstimator;
  // acá guardamos su último valor para el payload.
  const [est, setEst] = useState<EstimatorValue>({
    filamentId: null,
    material: defaultValues.material ?? "",
    color: "",
    grams: Number(defaultValues.weightGrams) || 0,
    printMinutes: Number(defaultValues.printTimeMinutes) || 0,
    layerHeight: defaultValues.layerHeight ?? "",
    presetId: "",
    price: null,
  });
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({ defaultValues });

  const infill = useWatch({ control, name: "infillPercent" });
  const colorList =
    colorCatalog.length > 0
      ? colorCatalog.map((c) => ({ n: c.name, c: c.hex ?? "#888" }))
      : [
          { n: "Negro", c: "#1a1a1f" },
          { n: "Blanco", c: "#f4f4f0" },
        ];

  function toggleColor(name: string) {
    setColors((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
    );
  }

  // La calculadora flotante es opcional: al "Usar precio" copia el precio y
  // guarda la ficha técnica (material/peso/tiempo/altura) para costos/reportes.
  function handleEstUse(v: EstimatorValue) {
    setEst(v);
    if (v.price != null) setValue("price", String(v.price));
  }

  async function generateWithHefi() {
    const name = getValues("name").trim();
    if (!name) {
      setFormError("Escribí primero el nombre del producto.");
      return;
    }
    setFormError(null);
    setGenBusy(true);
    const res = await runAction(() => generateDescriptionAction(name), {
      silent: true,
    });
    setGenBusy(false);
    if (!res.ok) {
      setFormError(res.error.message);
      return;
    }
    setValue("description", res.data.description);
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const payload: ProductFormValues = {
      ...values,
      // Slug automático desde el nombre al crear; en edición se conserva (no
      // romper URLs/SEO). El server garantiza que sea único.
      slug: mode === "create" ? slugify(values.name) : defaultValues.slug,
      // El precio de oferta se maneja desde Descuentos (Bloque 5): no se carga acá.
      salePrice: "",
      // Ficha técnica desde el estimador (fuente única).
      material: est.material,
      weightGrams: est.grams ? String(est.grams) : "",
      printTimeMinutes: est.printMinutes ? String(est.printMinutes) : "",
      layerHeight: est.layerHeight,
      colorMode,
      colors,
      colorPrices:
        colorMode === "single"
          ? Object.fromEntries(
              colors
                .filter((c) => colorPrices[c])
                .map((c) => [c, colorPrices[c]!]),
            )
          : {},
    };
    const result =
      mode === "create"
        ? await runAction(() => createProductAction(payload), { silent: true })
        : await runAction(() => updateProductAction(productId ?? "", payload), {
            silent: true,
          });

    if (!result.ok) {
      setFormError(result.error.message);
      const fields = result.error.fields;
      if (fields) {
        for (const [key, message] of Object.entries(fields)) {
          if (key in values) {
            setError(key as keyof ProductFormValues, { message });
          }
        }
      }
      return;
    }
    const savedId = mode === "create" ? result.data.id : (productId ?? "");
    if (onSaved) {
      onSaved(savedId);
      return;
    }
    if (mode === "create") {
      router.push(`/admin/productos/${result.data.id}/editar`);
    } else {
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {formError ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {formError}
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="name">Nombre del producto</label>
        <input
          id="name"
          className="input"
          placeholder="Ej: Lámpara Lunar Levitante"
          {...register("name")}
        />
        {errors.name ? (
          <p className="text-danger text-xs">{errors.name.message}</p>
        ) : null}
      </div>

      <div className="field">
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor="description" className="mb-0">
            Descripción
          </label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={generateWithHefi}
            loading={genBusy}
          >
            ✨ Generar con Hefi
          </Button>
        </div>
        <textarea
          id="description"
          rows={4}
          className="textarea"
          placeholder="Describí la pieza, su uso y detalles... o generala con Hefi"
          {...register("description")}
        />
      </div>

      <div className="field">
        <label htmlFor="categoryId">Categoría</label>
        <select id="categoryId" className="select" {...register("categoryId")}>
          <option value="" disabled>
            Elegí una categoría
          </option>
          {[...categories]
            .sort((a, b) => {
              // Raíces primero (por nombre) con sus hijas debajo (Fase 6).
              const ka = a.parentId
                ? `${categories.find((x) => x.id === a.parentId)?.name ?? ""}›${a.name}`
                : a.name;
              const kb = b.parentId
                ? `${categories.find((x) => x.id === b.parentId)?.name ?? ""}›${b.name}`
                : b.name;
              return ka.localeCompare(kb);
            })
            .map((c) => {
              const parent = c.parentId
                ? categories.find((x) => x.id === c.parentId)?.name
                : null;
              return (
                <option key={c.id} value={c.id}>
                  {parent ? `${parent} › ${c.name}` : c.name}
                </option>
              );
            })}
        </select>
        {errors.categoryId ? (
          <p className="text-danger text-xs">{errors.categoryId.message}</p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="price">Precio</label>
        <input
          id="price"
          type="number"
          step="0.01"
          className="input"
          readOnly
          placeholder="Calculalo con la calculadora"
          {...register("price")}
        />
        <div className="text-faint mt-1 text-[11.5px]">
          El precio se calcula con la calculadora (no se carga a mano). Las
          ofertas van por Descuentos.
        </div>
        <div className="mt-1.5">
          <EstimatorModalButton
            estimator={estimator}
            onUse={handleEstUse}
            initial={{
              material: defaultValues.material,
              grams: Number(defaultValues.weightGrams) || 0,
              printMinutes: Number(defaultValues.printTimeMinutes) || 0,
              layerHeight: defaultValues.layerHeight,
            }}
          />
        </div>
        {errors.price ? (
          <p className="text-danger text-xs">{errors.price.message}</p>
        ) : null}
      </div>

      {/* Ficha técnica de impresión 3D */}
      <div
        className="ui-card"
        style={{
          padding: 16,
          background:
            "linear-gradient(150deg, rgba(var(--gold-rgb),.07), transparent)",
        }}
      >
        <div
          className="mb-4 flex items-center gap-2"
          style={{ color: "var(--gold-bright)" }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="17"
            height="17"
            aria-hidden
          >
            <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <path d="M6 14h12v8H6z" />
          </svg>
          <b className="text-[13.5px]">Ficha técnica de impresión 3D</b>
        </div>

        {/* Modo de color */}
        <div className="field mb-3.5">
          <label>Modo de color</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn("chip", colorMode === "single" && "active")}
              onClick={() => setColorMode("single")}
            >
              El cliente elige un color
            </button>
            <button
              type="button"
              className={cn("chip", colorMode === "multi" && "active")}
              onClick={() => setColorMode("multi")}
            >
              Multicolor (combinación fija)
            </button>
          </div>
          <div className="text-faint text-[11.5px]">
            {colorMode === "multi"
              ? "La pieza se imprime con TODOS los colores seleccionados a la vez."
              : "El cliente elige uno de los colores disponibles al comprar."}
          </div>
        </div>

        {/* Colores */}
        <div className="field mb-3.5">
          <label>
            {colorMode === "multi"
              ? "Colores que lleva la pieza"
              : "Colores disponibles"}
          </label>
          <div className="flex flex-wrap gap-2">
            {colorList.map((fc) => (
              <button
                key={fc.n}
                type="button"
                className={cn("chip", colors.includes(fc.n) && "active")}
                onClick={() => toggleColor(fc.n)}
              >
                <span
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: "50%",
                    background: fc.c,
                    border: "1px solid rgba(255,255,255,.25)",
                    display: "inline-block",
                  }}
                />
                {fc.n}
              </button>
            ))}
          </div>
        </div>

        {/* Ajuste de precio por color (single) */}
        {colorMode === "single" && colors.length > 0 ? (
          <div className="field mb-3.5">
            <label>
              Ajuste de precio por color{" "}
              <span className="text-faint font-normal">
                (opcional · + más caro / − más barato)
              </span>
            </label>
            <div className="flex flex-col gap-2">
              {colors.map((c) => (
                <div key={c} className="flex items-center gap-3">
                  <span className="w-28 text-sm">{c}</span>
                  <input
                    type="number"
                    step="1"
                    className="input"
                    style={{ maxWidth: 140 }}
                    placeholder="0"
                    value={colorPrices[c] ?? ""}
                    onChange={(e) =>
                      setColorPrices((prev) => ({
                        ...prev,
                        [c]: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="field mb-3.5">
          <label htmlFor="infillPercent">Relleno (infill)</label>
          <div className="flex items-center gap-2">
            <input
              id="infillPercent"
              type="range"
              min={0}
              max={100}
              step={5}
              className="range"
              {...register("infillPercent")}
            />
            <b
              className="min-w-[42px] text-right"
              style={{ color: "var(--gold-bright)" }}
            >
              {infill || 0}%
            </b>
          </div>
        </div>

        <div className="field mb-3.5">
          <label htmlFor="productionTime">
            Tiempo de producción / entrega{" "}
            <span className="text-faint font-normal">
              (lo que ve el cliente)
            </span>
          </label>
          <input
            id="productionTime"
            className="input"
            placeholder="Ej: 24-48 hs · 2-3 días hábiles"
            {...register("productionTime")}
          />
        </div>

        <div className="field">
          <label htmlFor="dimensions">Dimensiones</label>
          <input
            id="dimensions"
            className="input"
            placeholder="Ej: 10 × 8 × 12 cm"
            {...register("dimensions")}
          />
        </div>
      </div>

      {mode === "create" ? (
        <div className="field">
          <label htmlFor="status">Estado</label>
          <select id="status" className="select" {...register("status")}>
            <option value="draft">Borrador (no visible en la tienda)</option>
            <option value="published">Publicado (visible)</option>
          </select>
        </div>
      ) : null}

      <div className="flex gap-6">
        <label className="text-fg flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-[var(--gold)]"
            {...register("isFeatured")}
          />{" "}
          Destacado
        </label>
        <label
          className={cn(
            "text-fg flex items-center gap-2 text-sm",
            !newsSectionActive && "opacity-50",
          )}
          title={
            newsSectionActive
              ? undefined
              : "Activá la sección “Nuevos lanzamientos” en Configuración › Apariencia"
          }
        >
          <input
            type="checkbox"
            className="accent-[var(--gold)]"
            disabled={!newsSectionActive}
            {...register("isNew")}
          />{" "}
          Nuevo
        </label>
      </div>

      <div className="pt-1">
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting
            ? "Guardando..."
            : mode === "create"
              ? "Crear producto"
              : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
