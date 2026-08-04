"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EstimatorModalButton } from "@/features/calculator/components/estimator-modal-button";
import type { EstimatorValue } from "@/features/calculator/components/price-estimator";
import type { EstimatorContext } from "@/features/calculator/service";
import type { ProductForSale } from "@/features/products/services/catalogService";
import { saleUnitPrice } from "@/features/products/pricing";
import { ColorSwatches } from "@/components/shared/color-swatches";
import { cn } from "@/lib/utils";
import { createManualSaleAction } from "../actions";
import { ORDER_STATUS_LABEL } from "../constants";
import type { OrderStatus } from "../types";
import { runAction } from "@/lib/run-action";
import { useFormErrors } from "@/hooks/use-form-errors";

const PAYS = [
  { v: "cash", l: "Efectivo" },
  { v: "transfer", l: "Transferencia" },
  { v: "mercadopago", l: "MercadoPago" },
] as const;

// Los 8 estados de un pedido, en el orden de la máquina de estados (Cap. 11).
// Se derivan de ORDER_STATUS_LABEL para no desincronizar con la sección Pedidos.
const STATUS_ORDER = [
  "pending_payment",
  "confirmed",
  "in_production",
  "ready",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const satisfies readonly OrderStatus[];

const STATUSES = STATUS_ORDER.map((v) => ({ v, l: ORDER_STATUS_LABEL[v] }));

const today = () => new Date().toISOString().slice(0, 10);

export function ManualSaleForm({
  estimator,
  products = [],
  categories = [],
  colorHex = {},
  onDone,
  onCancel,
}: {
  partners?: Array<{ name: string; pct: number }>;
  estimator: EstimatorContext;
  products?: ProductForSale[];
  categories?: string[];
  /** Nombre del color → su hex REAL del catálogo de Filamentos. */
  colorHex?: Record<string, string>;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    saleDate: today(),
    customerName: "",
    detail: "",
    category: "",
    quantity: "1",
    paymentMethod: "cash" as (typeof PAYS)[number]["v"],
    status: "pending_payment" as (typeof STATUSES)[number]["v"],
  });
  // Datos de la calculadora para que el servidor calcule la amortización.
  // `filamentId` identifica el filamento EXACTO (dos PLA pueden costar distinto).
  const [estData, setEstData] = useState<{
    filamentId: string | null;
    material: string;
    grams: number;
    printMinutes: number;
  } | null>(null);
  // Precio UNITARIO que dio la calculadora: el total = unitario × cantidad
  // (editable a mano igual).
  const [unitPrice, setUnitPrice] = useState<number | null>(null);
  const [extras, setExtras] = useState<
    Array<{ name: string; cost: string; qty: string }>
  >([]);
  const [prodSearch, setProdSearch] = useState("");
  const [prodCat, setProdCat] = useState("all");
  const [colorLines, setColorLines] = useState<
    Array<{ filamentId: string; grams: string }>
  >([{ filamentId: "", grams: "" }]);

  const qtyN = Math.max(1, Math.floor(Number(form.quantity) || 1));
  const extrasCost = extras.reduce(
    (a, e) => a + (Number(e.cost) || 0) * (Number(e.qty) || 0),
    0,
  );
  // El total COBRADO es solo el precio × cantidad. Los insumos NO se cobran:
  // son un costo (van a la amortización y bajan la ganancia), no al total.
  const total = Math.round((unitPrice ?? 0) * qtyN * 100) / 100;
  const setExtra = (i: number, k: "name" | "cost" | "qty", v: string) =>
    setExtras((es) => es.map((e, j) => (j === i ? { ...e, [k]: v } : e)));
  const addExtra = () =>
    setExtras((es) => [...es, { name: "", cost: "", qty: "1" }]);
  const removeExtra = (i: number) =>
    setExtras((es) => es.filter((_, j) => j !== i));
  const setColorLine = (i: number, k: "filamentId" | "grams", v: string) =>
    setColorLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const addColorLine = () =>
    setColorLines((ls) => [...ls, { filamentId: "", grams: "" }]);
  const removeColorLine = (i: number) =>
    setColorLines((ls) => (ls.length <= 1 ? ls : ls.filter((_, j) => j !== i)));
  const colorGramsTotal = colorLines.reduce(
    (a, l) => a + (Number(l.grams) || 0),
    0,
  );
  const calcGrams = estData?.grams ?? null;
  const gramsMismatch =
    calcGrams != null &&
    calcGrams > 0 &&
    colorGramsTotal > 0 &&
    Math.abs(colorGramsTotal - calcGrams) > 0.5;
  const prodCategories = [
    ...new Set(
      products.map((p) => p.categoryName).filter((c): c is string => !!c),
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));
  const filteredProducts = products.filter((p) => {
    if (prodCat !== "all" && p.categoryName !== prodCat) return false;
    const q = prodSearch.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q);
  });

  // Calculadora flotante (obligatoria): al "Usar precio" copia el total
  // (unitario × cantidad) y guarda gramos/horas/filamento para la amortización.
  function handleEstUse(v: EstimatorValue) {
    setEstData({
      filamentId: v.filamentId,
      material: v.material,
      grams: v.grams,
      printMinutes: v.printMinutes,
    });
    if (v.price != null) setUnitPrice(v.price);
    // La calculadora eligió un filamento: lo dejo como primera línea de color.
    if (v.filamentId) {
      setColorLines([{ filamentId: v.filamentId, grams: String(v.grams) }]);
    }
  }

  // Si cambia la cantidad y hay precio unitario de la calculadora, el total se
  // recalcula solo (sigue siendo editable a mano después).
  function handleQtyChange(value: string) {
    setForm((f) => ({ ...f, quantity: value }));
  }

  // "Cargar desde la tienda": autocompleta detalle, material, gramos, minutos
  // y precio desde un producto publicado. La amortización la calcula el
  // servidor con esos datos (igual que la calculadora, modo material).
  /** Nombre del color de un carrete (para pintarle su círculo). */
  function filamentColorName(id: string): string {
    return estimator.filaments.find((x) => x.id === id)?.color ?? "";
  }

  function matchFilamentId(material: string, color: string): string | null {
    const m = material.trim().toLowerCase();
    const c = color.trim().toLowerCase();
    return (
      estimator.filaments.find(
        (x) =>
          x.material.trim().toLowerCase() === m &&
          x.color.trim().toLowerCase() === c,
      )?.id ?? null
    );
  }

  // Producto elegido de la tienda + variante (tamaño/combinación) + color:
  // task #188 — el chihuahua tiene 2 tamaños y antes se tomaba uno solo.
  const [picked, setPicked] = useState<ProductForSale | null>(null);
  const [saleVariant, setSaleVariant] = useState<string | null>(null);
  const [saleColor, setSaleColor] = useState<string | null>(null);
  // Derivados del muestrario: la variante elegida y el precio "del resto" (el
  // que se cobra cuando el color no tiene precio propio). Un círculo solo
  // anuncia precio si es DISTINTO de ese; repetir el mismo número en 18
  // círculos es ruido (misma regla que la tienda).
  const pickedVariant =
    picked?.variants.find((v) => v.label === saleVariant) ?? null;
  const basePriceForPicked = picked
    ? saleUnitPrice({
        basePrice: picked.price,
        colorMode: picked.colorMode,
        productColorPrices: picked.colorPrices,
        variant: pickedVariant,
        color: null,
      })
    : 0;

  /** Aplica el producto + variante + color: precio ESPEJO del cobro online
   * (saleUnitPrice, testeado), gramos del tamaño/combo elegido para el stock
   * y detalle con lo vendido. Todo sigue editable a mano después. */
  function applySelection(
    p: ProductForSale,
    variantLabel: string | null,
    color: string | null,
  ) {
    const variant = p.variants.find((v) => v.label === variantLabel) ?? null;
    const isMulti = p.colorMode === "multi";
    const unit = saleUnitPrice({
      basePrice: p.price,
      colorMode: p.colorMode,
      productColorPrices: p.colorPrices,
      variant,
      color,
    });
    let lines: Array<{ filamentId: string; grams: string }> = [];
    let weight = 0;
    if (isMulti) {
      // Gramos por color: los del tamaño/combo elegido; si no tiene, los del
      // producto (en multi la columna colorPrices guarda GRAMOS por color).
      const vg = variant?.colorGrams ?? {};
      const source = Object.values(vg).some((g) => g > 0) ? vg : p.colorPrices;
      const entries = Object.entries(source).filter(([, g]) => g > 0);
      lines = entries.map(([c, g]) => ({
        filamentId: matchFilamentId(p.material ?? "", c) ?? "",
        grams: String(g),
      }));
      weight = entries.reduce((a, [, g]) => a + g, 0);
      if (lines.length === 0 && (p.weightGrams ?? 0) > 0) {
        weight = p.weightGrams ?? 0;
        lines = [{ filamentId: "", grams: String(weight) }];
      }
    } else {
      // Color único: el peso del tamaño elegido (o del producto) va TODO al
      // color vendido (antes se repartía entre todos los colores: mal).
      weight =
        variant?.weightGrams && variant.weightGrams > 0
          ? variant.weightGrams
          : (p.weightGrams ?? 0);
      lines = [
        {
          filamentId: color
            ? (matchFilamentId(p.material ?? "", color) ?? "")
            : "",
          grams: weight > 0 ? String(weight) : "",
        },
      ];
    }
    setColorLines(lines.length > 0 ? lines : [{ filamentId: "", grams: "" }]);
    setEstData({
      filamentId: lines.find((l) => l.filamentId)?.filamentId || null,
      material: p.material ?? "",
      grams: weight,
      printMinutes: p.printMinutes ?? 0,
    });
    setUnitPrice(unit);
    setForm((f) => ({
      ...f,
      detail: [
        p.name,
        variantLabel,
        !isMulti && color && p.colors.length > 1 ? color : null,
      ]
        .filter(Boolean)
        .join(" · "),
      category: p.categoryName ?? f.category,
    }));
  }

  function pickProduct(id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const firstVariant = p.variants[0]?.label ?? null;
    const firstColor = p.colorMode === "single" ? (p.colors[0] ?? null) : null;
    setPicked(p);
    setSaleVariant(firstVariant);
    setSaleColor(firstColor);
    applySelection(p, firstVariant, firstColor);
  }
  // El reparto de la ganancia lo resuelve Ganancias (socios actuales); esta venta
  // ya no lleva un reparto propio (se sacó "Personalizar").
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const fe = useFormErrors();
  // El pedido valida por sección (precio/colores/socios): banner + toast visible
  // en cualquier paso del wizard.
  const fail = (msg: string) => {
    setErr(msg);
    fe.fromAction({ message: msg });
  };

  async function submit() {
    setErr(null);
    if (!estData) {
      return fail(
        "Calculá el precio con la calculadora (la amortización es obligatoria).",
      );
    }
    if (
      colorLines.filter((l) => l.filamentId && Number(l.grams) > 0).length === 0
    ) {
      return fail(
        "Elegí al menos un color/carrete y sus gramos (se descuenta del stock).",
      );
    }
    setBusy(true);
    try {
      const validLines = colorLines
        .filter((l) => l.filamentId && Number(l.grams) > 0)
        .map((l) => ({ filamentId: l.filamentId, grams: Number(l.grams) }));
      const gramsFinal = validLines.length
        ? validLines.reduce((a, l) => a + l.grams, 0)
        : estData.grams;
      const filamentFinal = validLines.length
        ? validLines[0]!.filamentId
        : (estData.filamentId ?? "");
      const res = await runAction(
        () =>
          createManualSaleAction({
            ...form,
            total,
            extrasCost,
            quantity: qtyN,
            filamentId: filamentFinal,
            material: estData.material,
            grams: gramsFinal,
            printMinutes: estData.printMinutes,
            colorLines: validLines.length ? validLines : undefined,
          }),
        { silent: true },
      );
      if (!res.ok) return fe.fromAction(res.error);
      if (onDone) {
        onDone();
      } else {
        router.push("/admin/pedidos");
      }
    } catch {
      setErr("No se pudo registrar la venta. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={
        onDone
          ? "flex flex-col gap-4"
          : "ui-card flex max-w-2xl flex-col gap-4 p-6"
      }
    >
      <div className="flex items-center gap-2">
        {["Producto y cliente", "Precio e insumos", "Estado"].map(
          (label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${
                  i === step
                    ? "bg-[var(--gold)] text-black"
                    : i < step
                      ? "bg-[rgba(var(--gold-rgb),.2)] text-[var(--gold-bright)]"
                      : "text-dim bg-[var(--surface-2)]"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span
                className={`text-[12px] ${i === step ? "text-fg font-medium" : "text-faint"}`}
              >
                {label}
              </span>
            </div>
          ),
        )}
      </div>
      {err ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {err}
        </p>
      ) : null}

      {step === 0 && (
        <>
          <p className="text-faint text-[12.5px] leading-relaxed">
            Registrá una venta ya realizada (por ejemplo, ventas anteriores al
            sistema). Queda en el historial y suma a la facturación.
          </p>

          {products.length > 0 ? (
            <div className="field">
              <label>Cargar desde un producto de la tienda (opcional)</label>
              <div className="flex flex-wrap gap-2">
                <input
                  className="input flex-1"
                  style={{ minWidth: 160 }}
                  placeholder="Buscar producto…"
                  value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                />
                <select
                  className="select"
                  style={{ maxWidth: 190 }}
                  value={prodCat}
                  onChange={(e) => setProdCat(e.target.value)}
                >
                  <option value="all">Todas las categorías</option>
                  {prodCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              {!prodSearch.trim() ? (
                <div className="text-faint mt-2 text-[11.5px]">
                  Escribí arriba para buscar un producto de la tienda.
                </div>
              ) : (
                <div className="mt-2 max-h-48 overflow-auto rounded-md border border-[var(--border)]">
                  {filteredProducts.length === 0 ? (
                    <div className="text-faint p-3 text-[12.5px]">
                      Sin resultados.
                    </div>
                  ) : (
                    filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="hover:bg-surface-2 flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
                        onClick={() => {
                          pickProduct(p.id);
                          setProdSearch("");
                        }}
                      >
                        <span className="truncate">
                          {p.name}
                          {p.categoryName ? (
                            <span className="text-faint">
                              {" "}
                              · {p.categoryName}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-faint text-[12px]">
                          ${p.price.toLocaleString("es-AR")}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
              {/* Producto elegido: variante (tamaño/combinación) + color. El
                  precio y los gramos siguen lo elegido, igual que la tienda. */}
              {picked ? (
                <div className="mt-2 flex flex-col gap-2.5 rounded-xl border border-[var(--border)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-[13px]">{picked.name}</b>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setPicked(null);
                        setSaleVariant(null);
                        setSaleColor(null);
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                  {picked.variants.length > 0 ? (
                    <div>
                      <div className="text-dim mb-1.5 text-[12px] font-medium">
                        {picked.variants.some((v) => v.label.includes(" + "))
                          ? "¿Qué combinación se vendió?"
                          : "¿Qué tamaño se vendió?"}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {picked.variants.map((v) => (
                          <button
                            key={v.label}
                            type="button"
                            className={cn(
                              "chip",
                              saleVariant === v.label && "active",
                            )}
                            onClick={() => {
                              setSaleVariant(v.label);
                              applySelection(picked, v.label, saleColor);
                            }}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {picked.colorMode === "single" && picked.colors.length > 0 ? (
                    <div>
                      <div className="text-dim mb-1.5 text-[12px] font-medium">
                        ¿De qué color?
                        {saleColor ? (
                          <span className="text-primary ml-1.5 font-semibold">
                            {saleColor}
                          </span>
                        ) : null}
                      </div>
                      {/* MISMO muestrario que ve el cliente en la tienda y que
                          se usa al cargar un producto: un solo control en toda
                          la app (2026-08-03). El punto dorado marca los colores
                          que cuestan distinto. */}
                      <ColorSwatches
                        size="sm"
                        options={picked.colors.map((c) => {
                          const price = saleUnitPrice({
                            basePrice: picked.price,
                            colorMode: picked.colorMode,
                            productColorPrices: picked.colorPrices,
                            variant: pickedVariant,
                            color: c,
                          });
                          const distinto = price !== basePriceForPicked;
                          return {
                            name: c,
                            hex: colorHex[c] ?? "#888",
                            flag: distinto,
                            ...(distinto
                              ? { note: `$${price.toLocaleString("es-AR")}` }
                              : {}),
                          };
                        })}
                        selected={saleColor ? [saleColor] : []}
                        onSelect={(c) => {
                          setSaleColor(c);
                          applySelection(picked, saleVariant, c);
                        }}
                      />
                    </div>
                  ) : null}
                  {unitPrice != null ? (
                    <div className="text-faint text-[11.5px]">
                      Precio unitario:{" "}
                      <b className="text-fg">
                        ${unitPrice.toLocaleString("es-AR")}
                      </b>{" "}
                      (el mismo que cobra la tienda para esa elección) · gramos
                      cargados abajo en “Colores usados”.
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="text-faint text-[11.5px]">
                Autocompleta detalle, material, gramos y precio. Ajustá lo que
                haga falta.
              </div>
            </div>
          ) : null}

          <div className="grid-2">
            <div className="field">
              <label htmlFor="ms-date">Fecha</label>
              <input
                id="ms-date"
                type="date"
                className="input"
                value={form.saleDate}
                onChange={(e) => set("saleDate", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ms-cust">Cliente</label>
              <input
                id="ms-cust"
                className="input"
                placeholder="Nombre del cliente"
                value={form.customerName}
                onChange={(e) => set("customerName", e.target.value)}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="ms-det">Detalle / producto</label>
              <input
                id="ms-det"
                className="input"
                placeholder="Ej: llavero personalizado"
                value={form.detail}
                onChange={(e) => set("detail", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ms-qty">Cantidad</label>
              <input
                id="ms-qty"
                type="number"
                min={1}
                max={9999}
                className="input"
                value={form.quantity}
                onChange={(e) => handleQtyChange(e.target.value)}
              />
              {unitPrice != null && qtyN > 1 ? (
                <div className="text-faint text-[11.5px]">
                  {qtyN} × ${unitPrice.toLocaleString("es-AR")} c/u
                </div>
              ) : null}
            </div>
          </div>

          <div className="field">
            <label htmlFor="ms-cat">Categoría</label>
            <select
              id="ms-cat"
              className="select"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="text-faint text-[11.5px]">
              Para que la venta sume en “ventas por categoría” del reporte.
            </div>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="ms-total">Total cobrado (ARS)</label>
              <input
                id="ms-total"
                type="number"
                className="input"
                placeholder="Se completa con la calculadora"
                value={total > 0 ? total : ""}
                readOnly
                title="Precio unitario (calculadora/producto) × cantidad"
              />
              <div className="mt-1">
                <EstimatorModalButton
                  estimator={estimator}
                  onUse={handleEstUse}
                />
              </div>
              {/* Contrato de la cantidad (pedido de Ale): TODO va de la mano.
                  Se cotiza UNA pieza; precio, stock y costo escalan solos. */}
              <div className="text-faint text-[11.5px]">
                Cotizá <b className="text-fg">una unidad</b>: el total, los
                gramos y el costo se multiplican solos por la cantidad
                {qtyN > 1 ? ` (×${qtyN})` : ""}. ¿Ya sabés cuánto cobrás (ej:
                $2.500 el parche)? Ponelo en la calculadora en{" "}
                <b className="text-fg">“¿Ya sabés cuánto cobrás?”</b> y se usa
                ese precio; la ganancia sale exacta.
              </div>
            </div>
            <div className="field">
              <label htmlFor="ms-pay">Método de pago</label>
              <select
                id="ms-pay"
                className="select"
                value={form.paymentMethod}
                onChange={(e) => set("paymentMethod", e.target.value)}
              >
                {PAYS.map((p) => (
                  <option key={p.v} value={p.v}>
                    {p.l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {colorLines.length > 0 ? (
            <div className="field">
              <label>Colores usados (descuenta stock)</label>
              <p className="text-faint text-[12px] leading-relaxed">
                Obligatorio: elegí el/los color(es) y los gramos de{" "}
                <b className="text-fg">una unidad</b> (el stock descuenta gramos
                × cantidad, igual que el precio). Si falta stock, la venta se
                registra igual y te avisa por notificación.
              </p>
              {colorLines.map((ln, i) => (
                <div key={i} className="mt-2 flex items-center gap-2">
                  {/* Círculo del color elegido: mismo lenguaje visual que el
                      muestrario de arriba, para no leer el nombre y adivinar. */}
                  <span
                    aria-hidden
                    style={{
                      width: 22,
                      height: 22,
                      flex: "0 0 auto",
                      borderRadius: "50%",
                      background: ln.filamentId
                        ? (colorHex[filamentColorName(ln.filamentId)] ?? "#888")
                        : "transparent",
                      border: ln.filamentId
                        ? "1px solid rgba(128,128,128,.35)"
                        : "1px dashed var(--border)",
                    }}
                  />
                  <select
                    className="select flex-1"
                    value={ln.filamentId}
                    onChange={(e) =>
                      setColorLine(i, "filamentId", e.target.value)
                    }
                  >
                    <option value="">— Elegí color / carrete —</option>
                    {estimator.filaments.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.material} · {f.color}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    style={{ width: 100 }}
                    type="number"
                    min={0}
                    placeholder="gramos"
                    value={ln.grams}
                    onChange={(e) => setColorLine(i, "grams", e.target.value)}
                  />
                  <span className="text-faint text-[12px]">g</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => removeColorLine(i)}
                    aria-label="Quitar color"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={addColorLine}
                >
                  + Agregar color
                </button>
                <span className="text-faint ml-auto text-[12px]">
                  Calculado: {calcGrams ?? "—"} g · Colores: {colorGramsTotal} g
                  {qtyN > 1 ? (
                    <>
                      {" · A descontar del stock: "}
                      <b className="text-fg">{colorGramsTotal * qtyN} g</b> (
                      {qtyN} × {colorGramsTotal} g)
                    </>
                  ) : null}
                </span>
              </div>
              {gramsMismatch ? (
                <p className="bg-warning/10 text-warning mt-2 rounded-md px-3 py-2 text-[12px]">
                  ⚠ El total de los colores ({colorGramsTotal} g) no coincide
                  con el peso calculado ({calcGrams} g). Ajustá los gramos: del
                  stock se descuenta lo que pongas acá.
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="field">
            <label>Insumos adicionales (opcional)</label>
            <p className="text-faint text-[12px] leading-relaxed">
              Argollas, vaso del chop, polímero, etc. Su costo se suma al total
              y a la amortización (costo real de la venta).
            </p>
            {extras.map((e, i) => (
              <div key={i} className="mt-2 flex items-center gap-2">
                <input
                  className="input flex-1"
                  placeholder="Ej: argollas, vaso de aluminio"
                  value={e.name}
                  onChange={(ev) => setExtra(i, "name", ev.target.value)}
                />
                <input
                  className="input"
                  style={{ width: 120 }}
                  type="number"
                  min={0}
                  placeholder="Costo c/u"
                  value={e.cost}
                  onChange={(ev) => setExtra(i, "cost", ev.target.value)}
                />
                <span className="text-faint text-[12px]">×</span>
                <input
                  className="input"
                  style={{ width: 80 }}
                  type="number"
                  min={1}
                  placeholder="Cant."
                  value={e.qty}
                  onChange={(ev) => setExtra(i, "qty", ev.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  onClick={() => removeExtra(i)}
                  aria-label="Quitar insumo"
                >
                  ×
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
                  Insumos: ${extrasCost.toLocaleString("es-AR")}
                </span>
              ) : null}
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="field">
            <label htmlFor="ms-status">Estado</label>
            <select
              id="ms-status"
              className="select"
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.l}
                </option>
              ))}
            </select>
          </div>

          <p className="text-faint text-[12px] leading-relaxed">
            La ganancia se reparte entre los socios actuales según sus
            porcentajes (Ganancias y socios), igual que las compras de la
            tienda.
          </p>
        </>
      )}

      <div className="flex justify-between gap-2 border-t border-[var(--border)] pt-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              onCancel ? onCancel() : router.push("/admin/pedidos")
            }
          >
            Cancelar
          </Button>
          {step > 0 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep((v) => Math.max(0, v - 1))}
            >
              ← Atrás
            </Button>
          ) : null}
        </div>
        {step < 2 ? (
          <Button
            type="button"
            onClick={() => setStep((v) => Math.min(2, v + 1))}
          >
            Siguiente →
          </Button>
        ) : (
          <Button type="button" onClick={submit} loading={busy}>
            {busy ? "Registrando…" : "Registrar venta"}
          </Button>
        )}
      </div>
    </div>
  );
}
