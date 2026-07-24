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
import { useActionOverlayStore } from "@/stores/actionOverlayStore";
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

// Imágenes va DESPUÉS de Precio: las combinaciones/colores se definen antes y
// recién ahí se asigna la imagen de cada uno (fila por color → "Elegir imagen").
const STEPS = ["Básicos", "Detalle", "Precio", "Imágenes", "Publicación"];

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
  // Foto POR color/combinación: una imagen elegida para cada color (single) o
  // combo (multi). La tienda salta a ella al elegirlo. Clave = color o combo.
  const [colorImages, setColorImages] = useState<Record<string, File>>({});
  const colorImageUrls = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, f] of Object.entries(colorImages))
      out[k] = URL.createObjectURL(f);
    return out;
  }, [colorImages]);
  useEffect(
    () => () =>
      Object.values(colorImageUrls).forEach((u) => URL.revokeObjectURL(u)),
    [colorImageUrls],
  );
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(50);
  // Reencuadre por arrastre sobre la vista previa (mouse y touch).
  const reframe = useDragReframe(posX, posY, (x, y) => {
    setPosX(x);
    setPosY(y);
  });

  // Paso 2
  const [colorMode, setColorModeState] = useState<"single" | "multi">("single");
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
  // El precio varía por DOS ejes INDEPENDIENTES y combinables (pedido de Ale:
  // "el tamaño cambia los gramos Y el color cambia el costo del filamento"):
  // - hasSizes: ¿se vende en varios tamaños?
  // - byColor: ¿cada color cuesta distinto? (solo color único)
  // Ambos activos = MATRIZ tamaño × color (cada celda su precio).
  const [hasSizes, setHasSizes] = useState(false);
  const [byColor, setByColor] = useState(false);
  const distinctColorPrice = colorMode === "single" && byColor;
  // MULTICOLOR: ¿una combinación fija o VARIAS? (mariposas: 4 combos de 2
  // colores, cada uno con su foto). Los combos viajan como variantes (label
  // autogenerado "Negro + Rojo" + gramos por color del combo) → el stock y el
  // cobro reusan TODO el circuito de variantes. Excluyente con tamaños en multi.
  const [multiCombos, setMultiCombosState] = useState(false);
  // Cambiar de modo REINICIA lo que depende del modo: colores, precios por
  // color, combos y variantes. Sin esto, volver atrás y cambiar de modo dejaba
  // estados sucios (p. ej. un producto "single" con TODOS los colores tocados).
  const setColorMode = (m: "single" | "multi") => {
    if (m === colorMode) return;
    setColorModeState(m);
    setColors([]);
    setColorGrams({});
    setColorPricesSingle({});
    setByColor(false);
    setMultiCombosState(false);
    setVariants([]);
    setColorImages({});
  };
  const setMultiCombos = (on: boolean) => {
    if (on === multiCombos) return;
    setMultiCombosState(on);
    // Los combos definen sus colores; el modo fijo los elige en Detalle.
    setColors([]);
    setColorGrams({});
    setVariants([]);
    setColorImages({});
  };
  // Tamaños o combinaciones (variantes): nombre + precio + material (gramos por
  // color multi / peso single) + matriz por color (byColor). comboColors = los
  // colores elegidos del combo (solo UI; el label y colorGrams derivan de ahí).
  const [variants, setVariants] = useState<
    Array<{
      label: string;
      price: string;
      colorGrams: Record<string, number>;
      weightGrams: string;
      colorPrices: Record<string, number>;
      comboColors: string[];
    }>
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
  // Etiquetas de color disponibles para las FOTOS: en color único, los colores;
  // en multicolor con varias combinaciones, los combos ("Negro + Rojo").
  const photoColorOptions =
    colorMode === "single"
      ? colors
      : multiCombos
        ? variants
            .filter((v) => v.comboColors.length >= 2)
            .map((v) => v.comboColors.join(" + "))
        : [];
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
  // Matriz: setea el precio de UN color dentro de UN tamaño; el precio del
  // tamaño (price) queda como el más barato de sus colores (para el "desde").
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
  // Combos: alterna un color dentro de una combinación; el label se autogenera
  // ("Negro + Rojo") y los gramos de colores sacados se limpian.
  const toggleComboColor = (i: number, c: string) =>
    setVariants((vs) =>
      vs.map((x, j) => {
        if (j !== i) return x;
        const comboColors = x.comboColors.includes(c)
          ? x.comboColors.filter((n) => n !== c)
          : [...x.comboColors, c];
        const colorGrams = Object.fromEntries(
          Object.entries(x.colorGrams).filter(([k]) => comboColors.includes(k)),
        );
        return {
          ...x,
          comboColors,
          colorGrams,
          label: comboColors.join(" + "),
        };
      }),
    );
  const removeVariant = (i: number) =>
    setVariants((vs) => vs.filter((_, j) => j !== i));
  // El precio final del producto = el de la calculadora + los insumos.
  const priceN = (Number(price) || 0) + extrasCost;
  // Precio a mostrar en la vista previa: con tamaños o precio distinto por color,
  // el más barato ("desde $"); si no, calculadora + insumos.
  const sizeMin = variants
    .filter((v) => v.label.trim() && Number(v.price) > 0)
    .reduce((m, v) => Math.min(m, Number(v.price)), Infinity);
  const colorMin = colors
    .map((c) => Number(colorPricesSingle[c]) || 0)
    .filter((n) => n > 0)
    .reduce((m, n) => Math.min(m, n), Infinity);
  const isDistinctPreview = colorMode === "single" && distinctColorPrice;
  const isCombosPreview = colorMode === "multi" && multiCombos;
  const displayPrice =
    hasSizes || isCombosPreview
      ? Number.isFinite(sizeMin)
        ? sizeMin
        : 0
      : isDistinctPreview
        ? Number.isFinite(colorMin)
          ? colorMin
          : 0
        : priceN;

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
    if (step === 1) {
      // Con varias combinaciones, los colores se eligen POR combo (paso Precio).
      if (!(colorMode === "multi" && multiCombos) && colors.length === 0)
        return "Elegí al menos un color (es obligatorio).";
      if (!productionTime.trim())
        return "Ingresá el tiempo de producción / entrega.";
    }
    if (step === 3) {
      // Alcanza con UNA imagen: la principal O al menos una foto por color /
      // combinación (la primera subida queda como portada automáticamente).
      if (!imageFile && Object.keys(colorImages).length === 0)
        return "Subí al menos una imagen (principal o de un color).";
    }
    if (step === 2) {
      if (colorMode === "multi" && multiCombos) {
        const combos = variants.filter((v) => v.comboColors.length >= 2);
        if (combos.length === 0)
          return "Agregá al menos una combinación (2 o más colores).";
        const noPrice = combos.find((v) => !(Number(v.price) > 0));
        if (noPrice)
          return `Calculá el precio de "${noPrice.comboColors.join(" + ")}".`;
        return null;
      }
      if (hasSizes && distinctColorPrice) {
        // Matriz: cada tamaño con nombre necesita al menos un color calculado.
        const named = variants.filter((v) => v.label.trim());
        if (named.length === 0)
          return "Agregá al menos un tamaño y calculá sus colores.";
        const incomplete = named.find(
          (v) => !Object.values(v.colorPrices).some((p) => p > 0),
        );
        if (incomplete)
          return `Calculá al menos un color para "${incomplete.label.trim()}".`;
      } else if (hasSizes) {
        const ok = variants.some((v) => v.label.trim() && Number(v.price) > 0);
        if (!ok) return "Agregá al menos un tamaño y calculá su precio.";
      } else if (distinctColorPrice) {
        const ok = colors.some((c) => (colorPricesSingle[c] || 0) > 0);
        if (!ok) return "Calculá el precio de al menos un color.";
      } else if (!(priceN > 0)) {
        return "Calculá el precio con la calculadora.";
      }
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
    setStep((s) => Math.min(4, s + 1));
  }
  function back() {
    setErr(null);
    setStep((s) => Math.max(0, s - 1));
  }

  async function submit() {
    setErr(null);
    // COMBOS (multicolor con varias combinaciones): las variantes son los
    // combos; los colores del producto = la unión de los de todos los combos.
    const isCombos = colorMode === "multi" && multiCombos;
    const combos = isCombos
      ? variants.filter((v) => v.comboColors.length >= 2)
      : [];
    const effectiveColors = isCombos
      ? [...new Set(combos.flatMap((v) => v.comboColors))]
      : colors;
    if (effectiveColors.length === 0)
      return setErr(
        isCombos
          ? "Agregá al menos una combinación (2 o más colores)."
          : "Elegí al menos un color.",
      );
    // El precio del tamaño ya incorpora la matriz (price = min de sus colores,
    // lo mantiene setVariantColorPrice), así que sizePrices sirve para ambos.
    const sizePrices = variants
      .filter((v) => (isCombos ? v.comboColors.length >= 2 : v.label.trim()))
      .map((v) => Number(v.price))
      .filter((n) => n > 0);
    const isDistinct = distinctColorPrice;
    const colorPriceList = colors
      .map((c) => Number(colorPricesSingle[c]) || 0)
      .filter((n) => n > 0);
    if (isCombos) {
      if (sizePrices.length === 0)
        return setErr("Calculá el precio de al menos una combinación.");
    } else if (hasSizes) {
      if (sizePrices.length === 0)
        return setErr(
          isDistinct
            ? "Agregá al menos un tamaño y calculá sus colores."
            : "Agregá al menos un tamaño y calculá su precio.",
        );
    } else if (isDistinct) {
      if (colorPriceList.length === 0)
        return setErr("Calculá el precio de al menos un color.");
    } else if (!(priceN > 0)) {
      return setErr("Calculá el precio con la calculadora.");
    }
    // Precio base ("desde $"): con tamaños/combos = el más barato (el del tamaño
    // ya es el mínimo de su matriz); por color = el color más barato; si no =
    // calculadora + insumos.
    const basePrice =
      isCombos || hasSizes
        ? Math.min(...sizePrices)
        : isDistinct
          ? Math.min(...colorPriceList)
          : priceN;
    setBusy(true);
    // UN solo overlay para toda la publicación (crear + N imágenes): sin esto,
    // cada runAction prendía y apagaba el overlay global → "parpadeo".
    const overlay = useActionOverlayStore.getState();
    overlay.begin("Publicando producto…");
    const payload = {
      name: name.trim(),
      slug: slugify(name),
      description,
      categoryId,
      price: String(basePrice),
      // Insumos (bajan la ganancia): se guardan siempre. En "precio único"
      // además ya están sumados al precio base (priceN).
      extrasCost: String(extrasCost),
      salePrice: "",
      material: est.material,
      printTimeMinutes: est.printMinutes ? String(est.printMinutes) : "",
      weightGrams: est.grams ? String(est.grams) : "",
      dimensions,
      colorMode,
      colors: effectiveColors,
      // color_prices reusada SOLO sin tamaños/combos: MULTICOLOR = gramos por
      // color (stock); COLOR ÚNICO con "precio distinto" = precio por color.
      // Con tamaños/combos, material y precio van por variante → acá vacío.
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
      layerHeight: est.layerHeight,
      infillPercent: "",
      productionTime,
      isFeatured,
      isNew,
      // Variantes = tamaños O combinaciones: nombre (combo autogenerado) +
      // precio + material (gramos por color / peso) + matriz (byColor).
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
      status,
    };
    try {
      const res = await runAction(() => createProductAction(payload), {
        silent: true,
        overlay: false,
      });
      if (!res.ok) {
        overlay.end();
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
        await runAction(() => uploadProductImageAction(fd), {
          silent: true,
          overlay: false,
        });
      }
      // Foto POR color/combinación: se sube etiquetada → la galería de la
      // tienda salta a ella al elegir ese color/combo.
      for (const [label, file] of Object.entries(colorImages)) {
        const compact = await compressImageToWebp(file, 1600);
        const cfd = new FormData();
        cfd.set("productId", id);
        cfd.set("file", compact);
        cfd.set("position", "50% 50%");
        cfd.set("color", label);
        await runAction(() => uploadProductImageAction(cfd), {
          silent: true,
          overlay: false,
        });
      }
      // Fotos adicionales (van después de la principal; sortOrder/isPrimary los
      // resuelve addProductImage por orden de subida). Se comprimen igual que la
      // principal para que una foto de celular no falle por tamaño.
      for (let i = 0; i < extraFiles.length; i++) {
        const compact = await compressImageToWebp(extraFiles[i]!, 1600);
        const efd = new FormData();
        efd.set("productId", id);
        efd.set("file", compact);
        efd.set("position", "50% 50%");
        await runAction(() => uploadProductImageAction(efd), {
          silent: true,
          overlay: false,
        });
      }
      overlay.end();
      setBusy(false);
      if (onCreated) {
        onCreated(id);
      } else {
        router.push(`/admin/productos/${id}/editar`);
      }
    } catch {
      overlay.end();
      setBusy(false);
      setErr("No se pudo crear el producto. Intentá de nuevo.");
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      {/* Columna del formulario por pasos. min-w-0: sin esto, el track 1fr no
          puede achicarse y el contenido desborda el modal (se veía recortado). */}
      <div className="flex min-w-0 flex-col gap-4">
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
                  "hidden text-[12.5px] sm:inline",
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
                {categories
                  .filter((c) => !c.parentId)
                  .map((p) => {
                    const kids = categories.filter((c) => c.parentId === p.id);
                    return kids.length > 0 ? (
                      <optgroup key={p.id} label={p.name}>
                        <option value={p.id}>{p.name} (toda)</option>
                        {kids.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    );
                  })}
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
          </div>
        ) : null}

        {/* PASO 4 — Imágenes (después de Precio: los colores/combinaciones ya
            están definidos → una fila por cada uno con su "Elegir imagen") */}
        {step === 3 ? (
          <div className="flex flex-col gap-4">
            <div className="field">
              <label>
                Imagen principal <span className="text-danger">*</span>
              </label>
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
                  Obligatoria. Abajo podés sumar más (hasta 5 en total).
                </div>
              )}
            </div>
            {/* FOTO POR COLOR / COMBINACIÓN: una fila por cada uno con su
                "Elegir imagen" (la tienda salta a esa foto al elegirlo). */}
            {photoColorOptions.length > 0 ? (
              <div className="field">
                <label>
                  {colorMode === "multi"
                    ? "Foto de cada combinación"
                    : "Foto de cada color"}{" "}
                  <span className="text-faint font-normal">(opcional)</span>
                </label>
                <p className="text-faint text-[12px] leading-relaxed">
                  Al elegir{" "}
                  {colorMode === "multi" ? "la combinación" : "el color"} en la
                  tienda, la galería muestra su foto. Sin foto propia, se ve la
                  principal.
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {photoColorOptions.map((opt) => (
                    <div
                      key={opt}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] p-2.5"
                    >
                      <span className="flex flex-1 items-center gap-2 text-sm">
                        {colorMode === "single" ? (
                          <span
                            style={{
                              width: 13,
                              height: 13,
                              borderRadius: "50%",
                              background: hexOf(opt),
                              border: "1px solid var(--border)",
                              flexShrink: 0,
                            }}
                          />
                        ) : null}
                        {opt}
                      </span>
                      {colorImageUrls[opt] ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={colorImageUrls[opt]}
                            alt={opt}
                            className="h-12 w-12 rounded-md object-cover"
                          />
                          <button
                            type="button"
                            className="btn-icon btn-ghost"
                            aria-label={`Quitar foto de ${opt}`}
                            onClick={() =>
                              setColorImages((prev) => {
                                const next = { ...prev };
                                delete next[opt];
                                return next;
                              })
                            }
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <label className="btn btn-secondary btn-sm cursor-pointer">
                          Elegir imagen
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f)
                                setColorImages((prev) => ({
                                  ...prev,
                                  [opt]: f,
                                }));
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="field">
              <label>
                Más fotos generales{" "}
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
                Fotos de ambiente o detalle, sin color asignado.
              </div>
            </div>
          </div>
        ) : null}

        {/* PASO 2 — Detalle: colores y ficha (antes que Imágenes) */}
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
                  Multicolor (combinación de colores)
                </button>
              </div>
            </div>

            {/* Multicolor: ¿UNA combinación fija o VARIAS a elección? (mariposas:
                4 combos de 2 colores; el cliente elige cuál y ve su foto). */}
            {colorMode === "multi" ? (
              <div className="field">
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
                {multiCombos ? (
                  <div className="text-faint mt-1 text-[11.5px]">
                    Las combinaciones (y sus colores) se cargan en el paso
                    Precio; cada una puede tener su foto.
                  </div>
                ) : null}
              </div>
            ) : null}

            {colorMode === "multi" && multiCombos ? null : (
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
            )}

            <div className="field">
              <label htmlFor="w-time">
                Tiempo de producción / entrega{" "}
                <span className="text-danger">*</span>
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

        {/* PASO 3 — Precio */}
        {step === 2 ? (
          <div className="flex flex-col gap-4">
            {/* DOS ejes independientes y COMBINABLES: tamaños (los grandes usan
                más gramos) y color (un filamento cuesta más que otro). Ambos
                activos = matriz tamaño × color. Con VARIAS combinaciones
                (multi), los ejes no aplican: cada combo es la variante. */}
            {colorMode === "multi" && multiCombos ? null : (
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
            )}
            {colorMode === "multi" && multiCombos ? null : (
              <div className="text-faint -mt-2 text-[11.5px]">
                {hasSizes && distinctColorPrice
                  ? "Matriz: cada tamaño con su precio POR color (el 10 cm morado puede costar más que el 10 cm azul)."
                  : hasSizes
                    ? "Cada tamaño con su precio (el más grande usa más material)."
                    : distinctColorPrice
                      ? "Cada color con su precio; el cliente paga el que elija."
                      : "Un solo precio, el mismo para todos los colores."}
              </div>
            )}

            {colorMode === "multi" && multiCombos ? (
              /* ─── COMBINACIONES (multicolor): cada combo elige SUS colores
                 (label autogenerado "Negro + Rojo"), con su Calcular (precio +
                 gramos por color del combo). El cliente elige la combinación y
                 cada una puede tener su foto (paso Imágenes). ─── */
              <div className="field">
                <label className="mb-0">Combinaciones</label>
                <p className="text-faint text-[12px] leading-relaxed">
                  Agregá cada combinación (2 o más colores) con su “Calcular”.
                  Si todas valen lo mismo, calculá el mismo precio en cada una.
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
                            v.comboColors.length >= 2
                              ? v.comboColors
                              : undefined
                          }
                          initial={{ colorGrams: v.colorGrams }}
                          onUse={(val) => {
                            // Insumos: se SUMAN al precio (la ganancia ya los
                            // descuenta como costo; sin esto se pierde plata).
                            if (val.price != null)
                              setVariant(
                                i,
                                "price",
                                String(val.price + extrasCost),
                              );
                            setEst(val);
                            setVariantGrams(i, val.colorGrams ?? {});
                          }}
                        />
                        {/* Mariposas: mismo precio en todas → copia el precio de
                            la 1ª combinación calculada (y sus gramos, mapeados
                            por posición si tienen la misma cantidad de colores). */}
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
              /* ─── POR TAMAÑO: cada uno con su Calcular (precio + gramos). Si
                 además el precio varía por color, cada tamaño abre su MATRIZ:
                 una fila por color con su Calcular. ─── */
              <div className="field">
                <label className="mb-0">Tamaños</label>
                <p className="text-faint text-[12px] leading-relaxed">
                  {distinctColorPrice
                    ? "Agregá los tamaños; dentro de cada uno, calculá el precio de cada color (el filamento cambia el costo)."
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
                          onChange={(ev) =>
                            setVariant(i, "label", ev.target.value)
                          }
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
                        /* MATRIZ: fila por color dentro del tamaño. El peso del
                           tamaño (stock) lo trae el primer Calcular. */
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
                                    background: hexOf(c),
                                    border: "1px solid var(--border)",
                                    flexShrink: 0,
                                  }}
                                />
                                {c}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="text-faint text-[12px]">
                                  $
                                </span>
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
                                      val.price + extrasCost,
                                    );
                                  setEst(val);
                                  // El peso del tamaño (stock): mismo para todos
                                  // los colores, lo trae cualquier Calcular.
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
                                  String(val.price + extrasCost),
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
              /* ─── POR COLOR (color único): cada color con su Calcular (precio +
                 peso). El "desde $" usa el más barato. ─── */
              <div className="field">
                <label className="mb-0">Precio por color</label>
                <p className="text-faint text-[12px] leading-relaxed">
                  Calculá cada color (precio y gramos). El cliente paga el del
                  color que elija.
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
                            background: hexOf(c),
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
                              [c]: p + extrasCost,
                            }));
                          setEst(val); // el peso va al stock
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* ─── PRECIO ÚNICO: una calculadora (en multicolor pide los gramos
                 por color → van al stock). ─── */
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
                    label={
                      colorMode === "multi"
                        ? "Calcular precio y gramos"
                        : "Calcular precio"
                    }
                    colors={colorMode === "multi" ? colors : undefined}
                    initial={{ colorGrams, grams: est.grams || undefined }}
                    onUse={(val) => {
                      handleEstUse(val);
                      if (colorMode === "multi")
                        setColorGrams(val.colorGrams ?? {});
                    }}
                  />
                </div>
                <div className="text-faint mt-1 text-[11.5px]">
                  {colorMode === "multi"
                    ? "La calculadora pide los gramos por color; se descuentan del stock. Los insumos de abajo se suman."
                    : "El precio se calcula con la calculadora. Los insumos de abajo se suman. Las ofertas van por Descuentos."}
                </div>
              </div>
            )}

            {/* Insumos adicionales (siempre): su costo se descuenta de la
                ganancia; en "precio único" además se suma al precio. */}
            <div className="field">
              <label>
                Insumos adicionales{" "}
                <span className="text-faint font-normal">(opcional)</span>
              </label>
              <p className="text-faint text-[12px] leading-relaxed">
                Argollas, vaso, polímero, etc. Se SUMAN a cada precio que
                calcules y se descuentan de la ganancia. Cargalos ANTES de
                calcular; si los cambiás, recalculá.
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
            </div>
          </div>
        ) : null}

        {/* PASO 5 — Publicación */}
        {step === 4 ? (
          <div className="flex flex-col gap-4">
            <div className="field">
              <label>¿Cómo se publica?</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setStatus("published")}
                  className={cn(
                    "rounded-xl border p-3 text-left transition",
                    status === "published"
                      ? "border-[var(--gold)] bg-[rgba(var(--gold-rgb),.08)]"
                      : "border-[var(--border)] hover:border-[var(--border-strong)]",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        status === "published"
                          ? "border-[var(--gold)]"
                          : "border-[var(--border-strong)]",
                      )}
                    >
                      {status === "published" ? (
                        <span className="h-2 w-2 rounded-full bg-[var(--gold)]" />
                      ) : null}
                    </span>
                    <span className="text-fg text-[13.5px] font-semibold">
                      Publicado
                    </span>
                  </span>
                  <span className="text-faint mt-1 block text-[11.5px] leading-snug">
                    Visible en la tienda apenas lo creás.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("draft")}
                  className={cn(
                    "rounded-xl border p-3 text-left transition",
                    status === "draft"
                      ? "border-[var(--gold)] bg-[rgba(var(--gold-rgb),.08)]"
                      : "border-[var(--border)] hover:border-[var(--border-strong)]",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        status === "draft"
                          ? "border-[var(--gold)]"
                          : "border-[var(--border-strong)]",
                      )}
                    >
                      {status === "draft" ? (
                        <span className="h-2 w-2 rounded-full bg-[var(--gold)]" />
                      ) : null}
                    </span>
                    <span className="text-fg text-[13.5px] font-semibold">
                      Borrador
                    </span>
                  </span>
                  <span className="text-faint mt-1 block text-[11.5px] leading-snug">
                    Queda oculto hasta que lo publiques.
                  </span>
                </button>
              </div>
            </div>

            <div className="field">
              <label>Mostrar en el inicio</label>
              <div className="flex flex-col gap-2">
                <label
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3",
                    sections.destacados ? "cursor-pointer" : "opacity-50",
                  )}
                  title={
                    sections.destacados
                      ? undefined
                      : "Activá “Destacados” en Configuración › Apariencia"
                  }
                >
                  <span>
                    <span className="text-fg block text-[13.5px] font-semibold">
                      Destacado
                    </span>
                    <span className="text-faint block text-[11.5px] leading-snug">
                      Aparece en la sección Destacados del inicio.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-[var(--gold)]"
                    disabled={!sections.destacados}
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                  />
                </label>
                <label
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3",
                    sections.nuevos ? "cursor-pointer" : "opacity-50",
                  )}
                  title={
                    sections.nuevos
                      ? undefined
                      : "Activá “Nuevos lanzamientos” en Configuración › Apariencia"
                  }
                >
                  <span>
                    <span className="text-fg block text-[13.5px] font-semibold">
                      Nuevo lanzamiento
                    </span>
                    <span className="text-faint block text-[11.5px] leading-snug">
                      Aparece en Nuevos lanzamientos del inicio.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-[var(--gold)]"
                    disabled={!sections.nuevos}
                    checked={isNew}
                    onChange={(e) => setIsNew(e.target.checked)}
                  />
                </label>
              </div>
              <div className="text-faint mt-2 rounded-lg bg-[var(--surface-2)] p-2.5 text-[11.5px] leading-relaxed">
                <b className="text-dim">Ofertas de la semana</b> y{" "}
                <b className="text-dim">Más vendidos</b> son automáticas (por
                descuentos y por ventas). No se asignan a mano.
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
          {step < 4 ? (
            <Button type="button" onClick={next}>
              Siguiente →
            </Button>
          ) : (
            <Button type="button" onClick={submit} loading={busy}>
              Crear producto
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
              {displayPrice > 0
                ? `${hasSizes || isDistinctPreview || isCombosPreview ? "desde " : ""}${money(displayPrice)}`
                : "— calculá el precio"}
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
