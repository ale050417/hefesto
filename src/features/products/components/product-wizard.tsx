"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EstimatorModalButton } from "@/features/calculator/components/estimator-modal-button";
import type { EstimatorValue } from "@/features/calculator/components/price-estimator";
import type { EstimatorContext } from "@/features/calculator/service";
import {
  createProductAction,
  generateDescriptionAction,
  uploadProductImageAction,
} from "../actions";
import type { Category } from "../types";
import { runAction } from "@/lib/run-action";
import { compressImageToWebp } from "@/lib/image-compress";
import { useDragReframe } from "@/hooks/use-drag-reframe";
import { useFormErrors } from "@/hooks/use-form-errors";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");

const STEPS = ["Básicos e imagen", "Ficha y colores", "Precio y publicación"];

type Props = {
  categories: Category[];
  estimator: EstimatorContext;
  colorCatalog: Array<{ name: string; hex: string | null }>;
  /** Secciones del home activas: para habilitar los checks y marcar automáticas. */
  sections: { nuevos: boolean; destacados: boolean };
  /** En el modal: en vez de navegar, avisa al contenedor con el id creado. */
  onCreated?: (id: string) => void;
};

export function ProductWizard({
  categories,
  estimator,
  colorCatalog,
  sections,
  onCreated,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const fe = useFormErrors();

  // Paso 1
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  // Fotos adicionales (hasta 4) además de la principal → 5 en total.
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  // Miniaturas de las fotos extra; se revocan al cambiar para no filtrar memoria.
  const extraUrls = useMemo(
    () => extraFiles.map((f) => URL.createObjectURL(f)),
    [extraFiles],
  );
  useEffect(
    () => () => extraUrls.forEach((u) => URL.revokeObjectURL(u)),
    [extraUrls],
  );
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(50);
  // Reencuadre por arrastre sobre la vista previa (mouse y touch).
  const reframe = useDragReframe(posX, posY, (x, y) => {
    setPosX(x);
    setPosY(y);
  });

  // Paso 2
  const [colorMode, setColorMode] = useState<"single" | "multi">("single");
  const [colors, setColors] = useState<string[]>([]);
  // Multicolor: gramos de cada color que lleva la pieza (para descontar stock).
  const [colorGrams, setColorGrams] = useState<Record<string, number>>({});
  // Color único: precio EXACTO por color (opcional; vacío = precio de la
  // calculadora). El mismo producto en Dorado o Amarillo puede costar distinto
  // porque el filamento cuesta distinto.
  const [colorPricesSingle, setColorPricesSingle] = useState<
    Record<string, number>
  >({});
  const [dimensions, setDimensions] = useState("");
  const [productionTime, setProductionTime] = useState("");

  // Paso 3
  const [price, setPrice] = useState("");
  // Insumos adicionales (como en pedidos): nombre + costo × cantidad; su costo
  // se SUMA al precio final del producto.
  const [extras, setExtras] = useState<
    Array<{ name: string; cost: string; qty: string }>
  >([]);
  const [est, setEst] = useState<EstimatorValue>({
    filamentId: null,
    material: "",
    color: "",
    grams: 0,
    printMinutes: 0,
    layerHeight: "",
    presetId: "",
    price: null,
  });
  // Por defecto PUBLICADO: el producto se ve en la tienda apenas se crea (Ale
  // quiere que se publique solo; si no, lo pasa a Borrador a mano).
  const [status, setStatus] = useState<"draft" | "published">("published");
  const [isFeatured, setIsFeatured] = useState(false);
  const [isNew, setIsNew] = useState(false);

  const colorList = useMemo(
    () =>
      colorCatalog.length > 0
        ? colorCatalog.map((c) => ({ n: c.name, c: c.hex ?? "#888" }))
        : [
            { n: "Negro", c: "#1a1a1f" },
            { n: "Blanco", c: "#f4f4f0" },
          ],
    [colorCatalog],
  );
  const hexOf = (n: string) => colorList.find((c) => c.n === n)?.c ?? "#888";
  const catName =
    categories.find((c) => c.id === categoryId)?.name ?? "Sin categoría";
  // Insumos: costo total (costo × cantidad de cada uno).
  const extrasCost = extras.reduce(
    (a, e) => a + (Number(e.cost) || 0) * (Number(e.qty) || 0),
    0,
  );
  const setExtra = (i: number, k: "name" | "cost" | "qty", v: string) =>
    setExtras((es) => es.map((e, j) => (j === i ? { ...e, [k]: v } : e)));
  const addExtra = () =>
    setExtras((es) => [...es, { name: "", cost: "", qty: "1" }]);
  const removeExtra = (i: number) =>
    setExtras((es) => es.filter((_, j) => j !== i));
  // El precio final del producto = el de la calculadora + los insumos.
  const priceN = (Number(price) || 0) + extrasCost;

  function pickImage(file: File | null) {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageFile(file);
    setImageUrl(file ? URL.createObjectURL(file) : null);
    if (file) setTimeout(autoFrame, 60); // encuadra bien apenas se sube
  }

  // Auto-encuadre: analiza la imagen (canvas), encuentra el objeto (píxeles que
  // no son fondo blanco/transparente) y centra el recorte en él. Sin IA, rápido
  // y estable: la publicación queda prolija sin tocar nada.
  function autoFrame() {
    const url = imageUrl;
    if (!url) return;
    const img = new window.Image();
    img.onload = () => {
      const w = 96;
      const h = 96;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      let data: Uint8ClampedArray;
      try {
        data = ctx.getImageData(0, 0, w, h).data;
      } catch {
        return;
      }
      let minX = w;
      let minY = h;
      let maxX = 0;
      let maxY = 0;
      let found = false;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const r = data[i]!;
          const g = data[i + 1]!;
          const b = data[i + 2]!;
          const a = data[i + 3]!;
          const isBg = a < 20 || (r > 240 && g > 240 && b > 240);
          if (!isBg) {
            found = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (!found) {
        setPosX(50);
        setPosY(50);
        return;
      }
      setPosX(Math.round(((minX + maxX) / 2 / w) * 100));
      setPosY(Math.round(((minY + maxY) / 2 / h) * 100));
    };
    img.src = url;
  }
  function toggleColor(n: string) {
    setColors((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
  }
  function handleEstUse(v: EstimatorValue) {
    setEst(v);
    // La calculadora da UN precio para el producto (color único o multicolor).
    if (v.price != null) setPrice(String(v.price));
  }

  async function generateWithHefi() {
    if (!name.trim()) return setErr("Escribí primero el nombre del producto.");
    setErr(null);
    setGenBusy(true);
    const res = await runAction(() => generateDescriptionAction(name.trim()), {
      silent: true,
    });
    setGenBusy(false);
    if (!res.ok) {
      // Mostramos el error REAL (antes decía siempre "tardó", ocultando que la
      // IA no estaba configurada — la API key de Gemini/Anthropic falta).
      setErr(res.error.message);
      return;
    }
    setDescription(res.data.description);
  }

  function canAdvance(): string | null {
    if (step === 0) {
      if (!name.trim()) return "Ingresá el nombre del producto.";
      if (!categoryId) return "Elegí una categoría.";
    }
    if (step === 1) {
      if (colors.length === 0)
        return "Elegí al menos un color (es obligatorio).";
    }
    return null;
  }
  function next() {
    setErr(null);
    if (step === 0) {
      const ok = fe.check({
        name: !name.trim() ? "Ingresá el nombre del producto." : null,
        category: !categoryId ? "Elegí una categoría." : null,
      });
      if (!ok) return;
    } else {
      const problem = canAdvance();
      if (problem) return setErr(problem);
    }
    fe.clear();
    setStep((s) => Math.min(2, s + 1));
  }
  function back() {
    setErr(null);
    setStep((s) => Math.max(0, s - 1));
  }

  async function submit() {
    setErr(null);
    if (colors.length === 0) return setErr("Elegí al menos un color.");
    if (!(priceN > 0)) return setErr("Calculá el precio con la calculadora.");
    setBusy(true);
    const payload = {
      name: name.trim(),
      slug: slugify(name),
      description,
      categoryId,
      // Precio final = calculadora + insumos.
      price: String(priceN),
      salePrice: "",
      material: est.material,
      printTimeMinutes: est.printMinutes ? String(est.printMinutes) : "",
      weightGrams: est.grams ? String(est.grams) : "",
      dimensions,
      colorMode,
      colors,
      // La columna color_prices se reusa según el modo: en MULTICOLOR guarda los
      // GRAMOS por color (para descontar stock); en COLOR ÚNICO guarda el PRECIO
      // exacto por color (opcional). Un producto es de un solo modo → no chocan.
      colorPrices:
        colorMode === "multi"
          ? Object.fromEntries(
              colors
                .filter((c) => colorGrams[c])
                .map((c) => [c, colorGrams[c]!]),
            )
          : Object.fromEntries(
              colors
                .filter((c) => colorPricesSingle[c])
                .map((c) => [c, colorPricesSingle[c]!]),
            ),
      layerHeight: est.layerHeight,
      infillPercent: "",
      productionTime,
      isFeatured,
      isNew,
      status,
    };
    try {
      const res = await runAction(() => createProductAction(payload), {
        silent: true,
      });
      if (!res.ok) {
        setBusy(false);
        return setErr(res.error.message);
      }
      const id = res.data.id;
      if (imageFile) {
        const compact = await compressImageToWebp(imageFile, 1600);
        const fd = new FormData();
        fd.set("productId", id);
        fd.set("file", compact);
        fd.set("position", `${posX}% ${posY}%`);
        await runAction(() => uploadProductImageAction(fd), { silent: true });
      }
      // Fotos adicionales (van después de la principal; sortOrder/isPrimary los
      // resuelve addProductImage por orden de subida). Se comprimen igual que la
      // principal para que una foto de celular no falle por tamaño.
      for (const extra of extraFiles) {
        const compact = await compressImageToWebp(extra, 1600);
        const efd = new FormData();
        efd.set("productId", id);
        efd.set("file", compact);
        efd.set("position", "50% 50%");
        await runAction(() => uploadProductImageAction(efd), { silent: true });
      }
      setBusy(false);
      if (onCreated) {
        onCreated(id);
      } else {
        router.push(`/admin/productos/${id}/editar`);
      }
    } catch {
      setBusy(false);
      setErr("No se pudo crear el producto. Intentá de nuevo.");
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      {/* Columna del formulario por pasos */}
      <div className="flex flex-col gap-4">
        {/* Stepper */}
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
                  i === step
                    ? "bg-[var(--gold)] text-black"
                    : i < step
                      ? "bg-[rgba(var(--gold-rgb),.2)] text-[var(--gold-bright)]"
                      : "text-dim bg-[var(--surface-2)]",
                )}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span
                className={cn(
                  "text-[12.5px]",
                  i === step ? "text-fg font-medium" : "text-faint",
                )}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {err ? (
          <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
            {err}
          </p>
        ) : null}

        {/* PASO 1 — Básicos + imagen */}
        {step === 0 ? (
          <div className="flex flex-col gap-4">
            <div className={cn("field", fe.errors.name && "invalid")}>
              <label htmlFor="w-name">Nombre del producto</label>
              <input
                id="w-name"
                className="input"
                placeholder="Ej: Lámpara Lunar Levitante"
                aria-invalid={!!fe.errors.name}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {fe.errors.name ? (
                <p className="field-error">{fe.errors.name}</p>
              ) : null}
            </div>
            <div className={cn("field", fe.errors.category && "invalid")}>
              <label htmlFor="w-cat">Categoría</label>
              <select
                id="w-cat"
                className="select"
                aria-invalid={!!fe.errors.category}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Elegí una categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {fe.errors.category ? (
                <p className="field-error">{fe.errors.category}</p>
              ) : null}
            </div>
            <div className="field">
              <div className="mb-1 flex items-center justify-between gap-2">
                <label htmlFor="w-desc" className="mb-0">
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
                id="w-desc"
                rows={4}
                className="textarea"
                placeholder="Describí la pieza... o generala con Hefi"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Imagen</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="input"
                onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
              />
              {imageUrl ? (
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={autoFrame}
                    >
                      ✨ Auto-encuadre
                    </Button>
                    <span className="text-faint text-[11.5px]">
                      Centra el objeto para que quede prolijo en la publicación.
                    </span>
                  </div>
                  <div className="text-faint text-[11.5px]">
                    Arrastrá la imagen en la vista previa para acomodar el
                    encuadre.
                  </div>
                </div>
              ) : (
                <div className="text-faint text-[11.5px]">
                  Imagen principal (opcional). Abajo podés sumar más.
                </div>
              )}
            </div>
            <div className="field">
              <label>
                Más fotos{" "}
                <span className="text-faint font-normal">
                  (opcional, hasta 4)
                </span>
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="input"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  setExtraFiles((prev) => [...prev, ...picked].slice(0, 4));
                  e.currentTarget.value = "";
                }}
              />
              {extraUrls.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {extraUrls.map((u, i) => (
                    <div key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={u}
                        alt=""
                        className="h-16 w-16 rounded-md object-cover"
                      />
                      <button
                        type="button"
                        aria-label="Quitar foto"
                        onClick={() =>
                          setExtraFiles((prev) =>
                            prev.filter((_, j) => j !== i),
                          )
                        }
                        className="bg-surface-1 border-surface-3 text-fg absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="text-faint mt-1 text-[11.5px]">
                La foto principal es la de arriba (hasta 5 en total).
                Recomendado: cuadrada, 1000×1000 px o más.
              </div>
            </div>
          </div>
        ) : null}

        {/* PASO 2 — Ficha + colores */}
        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <div className="field">
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
            </div>
            <div className="field">
              <label>
                {colorMode === "multi"
                  ? "Colores que lleva la pieza"
                  : "Colores disponibles"}{" "}
                <span className="text-danger">*</span>
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
              <div className="text-faint text-[11.5px]">
                Obligatorio: elegí al menos un color.
              </div>
            </div>
            <div className="field">
              <label htmlFor="w-time">
                Tiempo de producción / entrega{" "}
                <span className="text-faint font-normal">
                  (lo que ve el cliente)
                </span>
              </label>
              <input
                id="w-time"
                className="input"
                placeholder="Ej: 24-48 hs · 2-3 días hábiles"
                value={productionTime}
                onChange={(e) => setProductionTime(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="w-dim">
                Dimensiones{" "}
                <span className="text-faint font-normal">(opcional)</span>
              </label>
              <input
                id="w-dim"
                className="input"
                placeholder="Ej: 10 × 8 × 12 cm"
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        {/* PASO 3 — Precio + publicación */}
        {step === 2 ? (
          <div className="flex flex-col gap-4">
            <div className="field">
              <label htmlFor="w-price">Precio</label>
              <input
                id="w-price"
                type="number"
                className="input"
                readOnly
                placeholder="Calculalo con la calculadora"
                value={price}
              />
              <div className="mt-1.5">
                <EstimatorModalButton
                  estimator={estimator}
                  onUse={handleEstUse}
                />
              </div>
              <div className="text-faint mt-1 text-[11.5px]">
                El precio se calcula con la calculadora. Los insumos de abajo se
                suman. Las ofertas van por Descuentos.
              </div>
            </div>

            {/* Insumos adicionales (como en pedidos): se suman al precio final. */}
            <div className="field">
              <label>
                Insumos adicionales{" "}
                <span className="text-faint font-normal">(opcional)</span>
              </label>
              <p className="text-faint text-[12px] leading-relaxed">
                Argollas, vaso, polímero, etc. Su costo se suma al precio final
                del producto.
              </p>
              {extras.map((e, i) => (
                <div key={i} className="mt-2 flex items-center gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Ej: argollas, vaso"
                    value={e.name}
                    onChange={(ev) => setExtra(i, "name", ev.target.value)}
                  />
                  <input
                    className="input"
                    style={{ width: 100 }}
                    type="number"
                    min={0}
                    placeholder="Costo"
                    value={e.cost}
                    onChange={(ev) => setExtra(i, "cost", ev.target.value)}
                  />
                  <span className="text-faint text-[12px]">×</span>
                  <input
                    className="input"
                    style={{ width: 64 }}
                    type="number"
                    min={1}
                    placeholder="Cant."
                    value={e.qty}
                    onChange={(ev) => setExtra(i, "qty", ev.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-icon btn-ghost"
                    onClick={() => removeExtra(i)}
                    aria-label="Quitar insumo"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={addExtra}
                >
                  + Agregar insumo
                </button>
                {extrasCost > 0 ? (
                  <span className="text-faint ml-auto text-[12px]">
                    Insumos: {money(extrasCost)}
                  </span>
                ) : null}
              </div>
              {extrasCost > 0 ? (
                <div
                  className="ui-card mt-2 flex items-center justify-between"
                  style={{ padding: "10px 13px" }}
                >
                  <span className="text-[12.5px] font-semibold">
                    Precio final (calculadora + insumos)
                  </span>
                  <b
                    className="price text-[15px]"
                    style={{ color: "var(--gold-bright)" }}
                  >
                    {money(priceN)}
                  </b>
                </div>
              ) : null}
            </div>

            {/* MULTICOLOR: gramos de cada color, SOLO para descontar el stock de
                filamento al vender (no cambia el precio). */}
            {colorMode === "multi" && colors.length > 0 ? (
              <div className="field">
                <label className="mb-0">Gramos por color</label>
                <div className="text-faint text-[11.5px] leading-relaxed">
                  Cuántos gramos de cada color lleva la pieza. Sirve para
                  descontar el stock de filamento al vender; no cambia el
                  precio.
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  {colors.map((c) => (
                    <div key={c} className="flex items-center gap-2">
                      <span className="flex w-32 items-center gap-2 text-sm">
                        <span
                          style={{
                            width: 13,
                            height: 13,
                            borderRadius: "50%",
                            background: hexOf(c),
                            border: "1px solid var(--border)",
                            flexShrink: 0,
                          }}
                        />
                        {c}
                      </span>
                      <input
                        type="number"
                        className="input"
                        style={{ maxWidth: 120 }}
                        placeholder="0"
                        value={colorGrams[c] ?? ""}
                        onChange={(e) =>
                          setColorGrams((prev) => ({
                            ...prev,
                            [c]: Number(e.target.value) || 0,
                          }))
                        }
                      />
                      <span className="text-faint text-[12px]">g</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* COLOR ÚNICO: precio por color (opcional). El cliente paga el precio
                del color que elige; vacío = precio de la calculadora. */}
            {colorMode === "single" && colors.length > 0 ? (
              <div className="field">
                <label className="mb-0">Precio por color (opcional)</label>
                <div className="text-faint text-[11.5px] leading-relaxed">
                  Si un color cuesta distinto (ej. Dorado vs Amarillo), poné su
                  precio acá y el cliente paga ese al elegirlo. Vacío = el
                  precio de la calculadora ({money(priceN)}).
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  {colors.map((c) => (
                    <div key={c} className="flex items-center gap-2">
                      <span className="flex w-32 items-center gap-2 text-sm">
                        <span
                          style={{
                            width: 13,
                            height: 13,
                            borderRadius: "50%",
                            background: hexOf(c),
                            border: "1px solid var(--border)",
                            flexShrink: 0,
                          }}
                        />
                        {c}
                      </span>
                      <span className="text-faint text-[12px]">$</span>
                      <input
                        type="number"
                        className="input"
                        style={{ maxWidth: 140 }}
                        placeholder={String(priceN || 0)}
                        value={colorPricesSingle[c] ?? ""}
                        onChange={(e) =>
                          setColorPricesSingle((prev) => ({
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

            <div className="field">
              <label>Estado</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={cn("chip", status === "published" && "active")}
                  onClick={() => setStatus("published")}
                >
                  Publicado
                </button>
                <button
                  type="button"
                  className={cn("chip", status === "draft" && "active")}
                  onClick={() => setStatus("draft")}
                >
                  Borrador
                </button>
              </div>
              <div className="text-faint text-[11.5px]">
                {status === "published"
                  ? "Visible en la tienda apenas se cree."
                  : "Queda oculto hasta que lo publiques."}
              </div>
            </div>

            <div className="field">
              <label>Secciones del home</label>
              <div className="flex flex-col gap-2">
                <label
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    !sections.destacados && "opacity-50",
                  )}
                  title={
                    sections.destacados
                      ? undefined
                      : "Activá “Destacados” en Configuración › Apariencia"
                  }
                >
                  <input
                    type="checkbox"
                    className="accent-[var(--gold)]"
                    disabled={!sections.destacados}
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                  />
                  Destacado
                </label>
                <label
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    !sections.nuevos && "opacity-50",
                  )}
                  title={
                    sections.nuevos
                      ? undefined
                      : "Activá “Nuevos lanzamientos” en Configuración › Apariencia"
                  }
                >
                  <input
                    type="checkbox"
                    className="accent-[var(--gold)]"
                    disabled={!sections.nuevos}
                    checked={isNew}
                    onChange={(e) => setIsNew(e.target.checked)}
                  />
                  Nuevos lanzamientos
                </label>
                <div className="text-faint mt-1 text-[11.5px] leading-relaxed">
                  <b>Ofertas de la semana</b> es automática: aparece cuando el
                  producto tiene un descuento (sección Descuentos).{" "}
                  <b>Más vendidos</b> es automática por las ventas. No se
                  asignan a mano.
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Navegación */}
        <div className="flex justify-between gap-2 border-t border-[var(--border)] pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={back}
            disabled={step === 0 || busy}
          >
            ← Atrás
          </Button>
          {step < 2 ? (
            <Button type="button" onClick={next}>
              Siguiente →
            </Button>
          ) : (
            <Button type="button" onClick={submit} loading={busy}>
              {busy ? "Creando..." : "Crear producto"}
            </Button>
          )}
        </div>
      </div>

      {/* Preview en vivo */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <div className="text-faint mb-2 text-[12px]">Vista previa</div>
        <div className="ui-card overflow-hidden" style={{ padding: 0 }}>
          <div
            {...(imageUrl ? reframe.handlers : {})}
            style={{
              aspectRatio: "1 / 1",
              background: "var(--surface-2)",
              position: "relative",
              touchAction: imageUrl ? "none" : undefined,
              cursor: imageUrl
                ? reframe.dragging
                  ? "grabbing"
                  : "grab"
                : undefined,
            }}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: `${posX}% ${posY}%`,
                }}
              />
            ) : (
              <div className="text-faint flex h-full items-center justify-center text-[12px]">
                Sin imagen
              </div>
            )}
            <div
              className="absolute top-2 left-2 flex gap-1"
              style={{ pointerEvents: "none" }}
            >
              {isNew ? (
                <span className="rounded bg-[var(--gold)] px-2 py-0.5 text-[10px] font-semibold text-black">
                  Nuevo
                </span>
              ) : null}
              {isFeatured ? (
                <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Destacado
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-1 p-3">
            <div className="text-faint text-[11px]">{catName}</div>
            <div className="text-fg text-[14px] font-semibold">
              {name || "Nombre del producto"}
            </div>
            <div style={{ color: "var(--gold-bright)" }} className="font-bold">
              {priceN > 0 ? money(priceN) : "— calculá el precio"}
            </div>
            {colors.length > 0 ? (
              <div className="mt-1 flex gap-1">
                {colors.slice(0, 6).map((c) => (
                  <span
                    key={c}
                    title={c}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: hexOf(c),
                      border: "1px solid var(--border)",
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="text-faint mt-2 text-[11px]">
          {status === "published" ? "Se publicará" : "Quedará en borrador"} ·{" "}
          {colorMode === "multi" ? "Multicolor" : "Un color a elección"}
        </div>
      </div>
    </div>
  );
}
