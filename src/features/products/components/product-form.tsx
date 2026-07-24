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
  /** Costo de insumos del producto (vaso, argollas...). Baja la ganancia. */
  extrasCost: string;
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
  /** Tamaños (variantes): nombre, precio, material del tamaño (gramos por color
   * en multicolor / peso en color único) y matriz de precios por color. */
  variants: {
    label: string;
    price: string;
    colorGrams: Record<string, number>;
    weightGrams: string;
    colorPrices: Record<string, number>;
  }[];
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
  // La columna color_prices se reusa según el modo: MULTICOLOR = gramos por color
  // (para descontar stock); COLOR ÚNICO = precio exacto por color (opcional). Como
  // un producto es de un solo modo, cargamos el mismo dato en el estado que toca.
  const [colorGrams, setColorGrams] = useState<Record<string, number>>(
    defaultValues.colorPrices ?? {},
  );
  const [colorPricesSingle, setColorPricesSingle] = useState<
    Record<string, number>
  >(defaultValues.colorPrices ?? {});
  // DOS ejes independientes y combinables (como el wizard): tamaños y color.
  // Ambos activos = matriz tamaño × color. Se precargan según lo guardado.
  const [hasSizes, setHasSizes] = useState(
    (defaultValues.variants?.length ?? 0) > 0,
  );
  const [byColor, setByColor] = useState(
    (defaultValues.colorMode ?? "single") === "single" &&
      (Object.keys(defaultValues.colorPrices ?? {}).length > 0 ||
        (defaultValues.variants ?? []).some(
          (v) => Object.keys(v.colorPrices ?? {}).length > 0,
        )),
  );
  const distinctColorPrice = colorMode === "single" && byColor;
  // MULTICOLOR con varias combinaciones: se precarga si las variantes guardadas
  // son combos (labels "A + B"). Igual que en el wizard.
  const [multiCombos, setMultiCombosState] = useState(
    (defaultValues.colorMode ?? "single") === "multi" &&
      (defaultValues.variants ?? []).some((v) => v.label.includes(" + ")),
  );
  const setMultiCombos = (on: boolean) => {
    if (on === multiCombos) return;
    setMultiCombosState(on);
    setColors([]);
    setColorGrams({});
    setVariants([]);
  };
  // Tamaños O combinaciones (variantes): precargados. comboColors se deriva del
  // label guardado ("Negro + Rojo" → sus colores) para poder editar combos.
  const [variants, setVariants] = useState<
    {
      label: string;
      price: string;
      colorGrams: Record<string, number>;
      weightGrams: string;
      colorPrices: Record<string, number>;
      comboColors: string[];
    }[]
  >(
    (defaultValues.variants ?? []).map((v) => ({
      ...v,
      comboColors: v.label.includes(" + ")
        ? v.label.split(" + ").map((c) => c.trim())
        : [],
    })),
  );
  const setVariant = (i: number, k: "label" | "price", v: string) =>
    setVariants((vs) => vs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const setVariantGrams = (i: number, grams: Record<string, number>) =>
    setVariants((vs) =>
      vs.map((x, j) => (j === i ? { ...x, colorGrams: grams } : x)),
    );
  const setVariantWeight = (i: number, grams: number) =>
    setVariants((vs) =>
      vs.map((x, j) =>
        j === i ? { ...x, weightGrams: grams > 0 ? String(grams) : "" } : x,
      ),
    );
  // Matriz: precio de UN color dentro de UN tamaño; el price del tamaño queda
  // como el mínimo de sus colores (para el "desde").
  const setVariantColorPrice = (i: number, color: string, p: number) =>
    setVariants((vs) =>
      vs.map((x, j) => {
        if (j !== i) return x;
        const colorPrices = { ...x.colorPrices, [color]: p };
        const mins = Object.values(colorPrices).filter((n) => n > 0);
        return {
          ...x,
          colorPrices,
          price: mins.length ? String(Math.min(...mins)) : x.price,
        };
      }),
    );
  const addVariant = () =>
    setVariants((vs) => [
      ...vs,
      {
        label: "",
        price: "",
        colorGrams: {},
        weightGrams: "",
        colorPrices: {},
        comboColors: [],
      },
    ]);
  // Combos: alterna un color del combo; label autogenerado y gramos saneados.
  const toggleComboColor = (i: number, c: string) =>
    setVariants((vs) =>
      vs.map((x, j) => {
        if (j !== i) return x;
        const comboColors = x.comboColors.includes(c)
          ? x.comboColors.filter((n) => n !== c)
          : [...x.comboColors, c];
        const colorGramsNext = Object.fromEntries(
          Object.entries(x.colorGrams).filter(([k]) => comboColors.includes(k)),
        );
        return {
          ...x,
          comboColors,
          colorGrams: colorGramsNext,
          label: comboColors.join(" + "),
        };
      }),
    );
  const removeVariant = (i: number) =>
    setVariants((vs) => vs.filter((_, j) => j !== i));
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

  // Insumos vigentes al momento de calcular: se SUMAN a cada precio calculado
  // (la ganancia ya los descuenta como costo; sin esto se pierde plata).
  const extrasNow = () => Number(getValues("extrasCost")) || 0;

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
    // COMBOS (multicolor con varias combinaciones): variantes = combos; los
    // colores del producto = unión de los de todos los combos.
    const isCombos = colorMode === "multi" && multiCombos;
    const combos = isCombos
      ? variants.filter((v) => v.comboColors.length >= 2)
      : [];
    const effectiveColors = isCombos
      ? [...new Set(combos.flatMap((v) => v.comboColors))]
      : colors;
    if (isCombos && combos.length === 0) {
      setFormError("Agregá al menos una combinación (2 o más colores).");
      return;
    }
    const sizePrices = variants
      .filter((v) => (isCombos ? v.comboColors.length >= 2 : v.label.trim()))
      .map((v) => Number(v.price))
      .filter((n) => n > 0);
    const isDistinct = colorMode === "single" && distinctColorPrice;
    const colorPriceList = colors
      .map((c) => Number(colorPricesSingle[c]) || 0)
      .filter((n) => n > 0);
    if (isCombos && sizePrices.length === 0) {
      setFormError("Calculá el precio de al menos una combinación.");
      return;
    }
    if (!isCombos && hasSizes && sizePrices.length === 0) {
      setFormError(
        isDistinct
          ? "Agregá al menos un tamaño y calculá sus colores."
          : "Agregá al menos un tamaño y calculá su precio.",
      );
      return;
    }
    if (!hasSizes && isDistinct && colorPriceList.length === 0) {
      setFormError("Calculá el precio de al menos un color.");
      return;
    }
    // Precio base ("desde $"): con tamaños = el más barato; con precio distinto
    // por color = el color más barato; si no = el de la calculadora (values.price).
    const basePrice =
      (isCombos || hasSizes) && sizePrices.length
        ? String(Math.min(...sizePrices))
        : isDistinct && colorPriceList.length
          ? String(Math.min(...colorPriceList))
          : values.price;
    const payload: ProductFormValues = {
      ...values,
      // Slug automático desde el nombre al crear; en edición se conserva (no
      // romper URLs/SEO). El server garantiza que sea único.
      slug: mode === "create" ? slugify(values.name) : defaultValues.slug,
      // El precio de oferta se maneja desde Descuentos (Bloque 5): no se carga acá.
      salePrice: "",
      price: basePrice,
      // Insumos (bajan la ganancia): se guardan siempre.
      extrasCost: values.extrasCost,
      // Ficha técnica desde el estimador (fuente única).
      material: est.material,
      weightGrams: est.grams ? String(est.grams) : "",
      printTimeMinutes: est.printMinutes ? String(est.printMinutes) : "",
      layerHeight: est.layerHeight,
      colorMode,
      colors: effectiveColors,
      // color_prices reusada SOLO sin tamaños: multicolor = GRAMOS por color
      // (stock); color único con "precio distinto" = PRECIO por color. Con
      // tamaños, el material y el precio van por tamaño → vacío.
      colorPrices:
        !hasSizes && !isCombos && colorMode === "multi"
          ? Object.fromEntries(
              colors
                .filter((c) => colorGrams[c])
                .map((c) => [c, colorGrams[c]!]),
            )
          : !hasSizes && colorMode === "single" && distinctColorPrice
            ? Object.fromEntries(
                colors
                  .filter((c) => colorPricesSingle[c])
                  .map((c) => [c, colorPricesSingle[c]!]),
              )
            : {},
      // Tamaños desde el estado local (no RHF); se descartan los sin nombre.
      // colorPrices por tamaño = matriz (solo si el precio varía por color).
      variants: isCombos
        ? combos.map((v) => ({
            label: v.comboColors.join(" + "),
            price: v.price,
            colorGrams: v.colorGrams,
            weightGrams: "",
            colorPrices: {},
          }))
        : hasSizes
          ? variants
              .filter((v) => v.label.trim())
              .map((v) => ({
                label: v.label.trim(),
                price: v.price,
                colorGrams: v.colorGrams,
                weightGrams: v.weightGrams,
                colorPrices: isDistinct ? v.colorPrices : {},
              }))
          : [],
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

      {/* DOS ejes independientes y combinables: tamaños y color. Ambos = matriz.
          Con VARIAS combinaciones (multi) los ejes no aplican. */}
      {colorMode === "multi" && multiCombos ? null : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="field">
              <label>¿Varios tamaños?</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={cn(
                    "chip flex-1 justify-center",
                    !hasSizes && "active",
                  )}
                  onClick={() => setHasSizes(false)}
                >
                  No
                </button>
                <button
                  type="button"
                  className={cn(
                    "chip flex-1 justify-center",
                    hasSizes && "active",
                  )}
                  onClick={() => setHasSizes(true)}
                >
                  Sí
                </button>
              </div>
            </div>
            {colorMode === "single" && colors.length > 0 ? (
              <div className="field">
                <label>¿Precio distinto por color?</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={cn(
                      "chip flex-1 justify-center",
                      !byColor && "active",
                    )}
                    onClick={() => setByColor(false)}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "chip flex-1 justify-center",
                      byColor && "active",
                    )}
                    onClick={() => setByColor(true)}
                  >
                    Sí
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="text-faint -mt-2 text-[11.5px]">
            {hasSizes && distinctColorPrice
              ? "Matriz: cada tamaño con su precio POR color."
              : hasSizes
                ? "Cada tamaño con su precio (el más grande usa más material)."
                : distinctColorPrice
                  ? "Cada color con su precio; el cliente paga el que elija."
                  : "Un solo precio, el mismo para todos los colores."}
          </div>
        </>
      )}

      {colorMode === "multi" && multiCombos ? (
        /* ─── COMBINACIONES (multicolor): cada combo con sus colores + Calcular. ─── */
        <div className="field">
          <label className="mb-0">Combinaciones</label>
          <p className="text-faint text-[12px] leading-relaxed">
            Cada combinación (2 o más colores) con su “Calcular” (precio y
            gramos). El cliente elige cuál y ve su foto.
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {variants.map((v, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-xl border border-[var(--border)] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {colorList.map((fc) => (
                      <button
                        key={fc.n}
                        type="button"
                        className={cn(
                          "chip",
                          v.comboColors.includes(fc.n) && "active",
                        )}
                        onClick={() => toggleComboColor(i, fc.n)}
                      >
                        <span
                          style={{
                            width: 12,
                            height: 12,
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
                  <button
                    type="button"
                    className="btn-icon btn-ghost shrink-0"
                    onClick={() => removeVariant(i)}
                    aria-label="Quitar combinación"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-[13px]">
                    {v.comboColors.length >= 2
                      ? v.comboColors.join(" + ")
                      : "Elegí 2 o más colores…"}
                  </b>
                  <div className="ml-auto flex items-center gap-1">
                    <span className="text-faint text-[12px]">$</span>
                    <input
                      className="input"
                      style={{ width: 100 }}
                      type="number"
                      readOnly
                      placeholder="Calcular →"
                      value={v.price}
                    />
                  </div>
                  <EstimatorModalButton
                    estimator={estimator}
                    label="Calcular"
                    colors={
                      v.comboColors.length >= 2 ? v.comboColors : undefined
                    }
                    initial={{ colorGrams: v.colorGrams }}
                    onUse={(val) => {
                      if (val.price != null)
                        setVariant(i, "price", String(val.price + extrasNow()));
                      setEst(val);
                      setVariantGrams(i, val.colorGrams ?? {});
                    }}
                  />
                  {i > 0 && Number(variants[0]?.price) > 0 ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        const first = variants[0]!;
                        setVariant(i, "price", first.price);
                        const from = first.comboColors;
                        const to = v.comboColors;
                        if (from.length === to.length) {
                          const grams: Record<string, number> = {};
                          to.forEach((c, k) => {
                            const g = first.colorGrams[from[k]!] ?? 0;
                            if (g > 0) grams[c] = g;
                          });
                          setVariantGrams(i, grams);
                        }
                      }}
                    >
                      Igual a la 1ª
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addVariant}
            className="text-dim mt-2 w-full rounded-xl border border-dashed border-[var(--border-strong)] py-2.5 text-[13px] transition hover:border-[var(--gold)] hover:text-[var(--gold-bright)]"
          >
            + Agregar combinación
          </button>
        </div>
      ) : hasSizes ? (
        /* ─── VARIOS TAMAÑOS: cada uno con su Calcular (precio + gramos). Con
           precio por color, cada tamaño abre su MATRIZ. ─── */
        <div className="field">
          <label className="mb-0">Tamaños</label>
          <p className="text-faint text-[12px] leading-relaxed">
            {distinctColorPrice
              ? "Agregá los tamaños; dentro de cada uno, calculá el precio de cada color."
              : "Agregá los tamaños de a uno; cada uno con su “Calcular” (precio y gramos). El cliente elige el tamaño y paga ese precio."}
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {variants.map((v, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-xl border border-[var(--border)] p-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    style={{ minWidth: 120 }}
                    placeholder="Nombre del tamaño (ej: Chico 12 cm)"
                    value={v.label}
                    onChange={(ev) => setVariant(i, "label", ev.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-icon btn-ghost"
                    onClick={() => removeVariant(i)}
                    aria-label="Quitar tamaño"
                  >
                    ✕
                  </button>
                </div>
                {distinctColorPrice ? (
                  /* MATRIZ: fila por color dentro del tamaño. */
                  <div className="flex flex-col gap-1.5">
                    {colors.map((c) => (
                      <div
                        key={c}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <span className="flex w-28 items-center gap-1.5 text-[13px]">
                          <span
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              background:
                                colorList.find((x) => x.n === c)?.c ?? "#888",
                              border: "1px solid var(--border)",
                              flexShrink: 0,
                            }}
                          />
                          {c}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-faint text-[12px]">$</span>
                          <input
                            className="input"
                            style={{ width: 100 }}
                            type="number"
                            readOnly
                            placeholder="Calcular →"
                            value={v.colorPrices[c] || ""}
                          />
                        </div>
                        <EstimatorModalButton
                          estimator={estimator}
                          label="Calcular"
                          initial={{
                            grams: Number(v.weightGrams) || undefined,
                          }}
                          onUse={(val) => {
                            if (val.price != null)
                              setVariantColorPrice(
                                i,
                                c,
                                val.price + extrasNow(),
                              );
                            setEst(val);
                            setVariantWeight(i, val.grams);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-faint text-[12px]">$</span>
                      <input
                        className="input"
                        style={{ width: 110 }}
                        type="number"
                        readOnly
                        placeholder="Calcular →"
                        value={v.price}
                      />
                    </div>
                    <EstimatorModalButton
                      estimator={estimator}
                      label="Calcular precio y gramos"
                      colors={colorMode === "multi" ? colors : undefined}
                      initial={{
                        colorGrams: v.colorGrams,
                        grams: Number(v.weightGrams) || undefined,
                      }}
                      onUse={(val) => {
                        if (val.price != null)
                          setVariant(
                            i,
                            "price",
                            String(val.price + extrasNow()),
                          );
                        setEst(val);
                        if (colorMode === "multi")
                          setVariantGrams(i, val.colorGrams ?? {});
                        else setVariantWeight(i, val.grams);
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addVariant}
            className="text-dim mt-2 w-full rounded-xl border border-dashed border-[var(--border-strong)] py-2.5 text-[13px] transition hover:border-[var(--gold)] hover:text-[var(--gold-bright)]"
          >
            + Agregar tamaño
          </button>
        </div>
      ) : distinctColorPrice ? (
        /* ─── POR COLOR (color único): cada color su Calcular (precio + peso). ─── */
        <div className="field">
          <label className="mb-0">Precio por color</label>
          <p className="text-faint text-[12px] leading-relaxed">
            Calculá cada color (precio y gramos). El cliente paga el del color
            que elija.
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {colors.map((c) => (
              <div
                key={c}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] p-2.5"
              >
                <span className="flex flex-1 items-center gap-2 text-sm">
                  <span
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: "50%",
                      background: colorList.find((x) => x.n === c)?.c ?? "#888",
                      border: "1px solid var(--border)",
                      flexShrink: 0,
                    }}
                  />
                  {c}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-faint text-[12px]">$</span>
                  <input
                    type="number"
                    className="input"
                    style={{ width: 110 }}
                    readOnly
                    placeholder="Calcular →"
                    value={colorPricesSingle[c] || ""}
                  />
                </div>
                <EstimatorModalButton
                  estimator={estimator}
                  label="Calcular"
                  onUse={(val) => {
                    const p = val.price;
                    if (p != null)
                      setColorPricesSingle((prev) => ({
                        ...prev,
                        [c]: p + extrasNow(),
                      }));
                    setEst(val); // el peso va al stock
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ─── PRECIO ÚNICO: una calculadora (multicolor pide gramos por color). ─── */
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
            {colorMode === "multi"
              ? "La calculadora pide los gramos por color; se descuentan del stock."
              : "El precio se calcula con la calculadora (no se carga a mano). Las ofertas van por Descuentos."}
          </div>
          <div className="mt-1.5">
            <EstimatorModalButton
              estimator={estimator}
              label={
                colorMode === "multi"
                  ? "Calcular precio y gramos"
                  : "Calcular precio"
              }
              colors={colorMode === "multi" ? colors : undefined}
              onUse={(val) => {
                handleEstUse(val);
                if (colorMode === "multi") setColorGrams(val.colorGrams ?? {});
              }}
              initial={{
                material: defaultValues.material,
                grams: Number(defaultValues.weightGrams) || 0,
                printMinutes: Number(defaultValues.printTimeMinutes) || 0,
                layerHeight: defaultValues.layerHeight,
                colorGrams,
              }}
            />
          </div>
          {errors.price ? (
            <p className="text-danger text-xs">{errors.price.message}</p>
          ) : null}
        </div>
      )}

      {/* Insumos (siempre): bajan la ganancia; el precio al cliente no cambia. */}
      <div className="field">
        <label htmlFor="extrasCost">Insumos (costo)</label>
        <input
          id="extrasCost"
          type="number"
          step="0.01"
          min={0}
          className="input"
          placeholder="0"
          {...register("extrasCost")}
        />
        <div className="text-faint mt-1 text-[11.5px]">
          Costo de los insumos (vaso, argollas, etc.). Se SUMA a cada precio que
          calcules y se descuenta de la ganancia en cada venta. Cargalo ANTES de
          calcular; si lo cambiás, recalculá.
        </div>
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

        {/* Multicolor: ¿una combinación fija o varias a elección? */}
        {colorMode === "multi" ? (
          <div className="field mb-3.5">
            <label>¿Cuántas combinaciones?</label>
            <div className="flex gap-2">
              <button
                type="button"
                className={cn(
                  "chip flex-1 justify-center",
                  !multiCombos && "active",
                )}
                onClick={() => setMultiCombos(false)}
              >
                Una fija
              </button>
              <button
                type="button"
                className={cn(
                  "chip flex-1 justify-center",
                  multiCombos && "active",
                )}
                onClick={() => setMultiCombos(true)}
              >
                Varias (el cliente elige)
              </button>
            </div>
          </div>
        ) : null}

        {/* Colores (con varias combinaciones se eligen POR combo, arriba) */}
        {colorMode === "multi" && multiCombos ? null : (
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
        )}

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
          {mode === "create" ? "Crear producto" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
