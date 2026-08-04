"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { CouponInput } from "@/features/cart/components/coupon-input";
import { useMounted } from "@/hooks/use-mounted";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCartStore, type CartItem } from "@/stores/cartStore";
import { createOrderAction } from "../actions";
import {
  shippingAddressSchema,
  type Delivery,
  type DeliveryType,
} from "../schemas";
import { quoteShipping, type ShippingConfig } from "../shipping";
import type { PaymentMethod } from "../types";
import { runAction } from "@/lib/run-action";

/** Solo los campos que el cliente ESCRIBE (el barrio se elige en un select y
 *  el tipo de entrega lo deduce la pantalla). */
type CampoEnvio =
  | "fullName"
  | "phone"
  | "street"
  | "city"
  | "province"
  | "postalCode";

/**
 * Valida UN campo con el MISMO schema que corre el servidor.
 *
 * Antes cada input usaba `required: "…"`, que solo exige "no vacío", mientras
 * el servidor pide mínimos reales (nombre 2, teléfono 6, dirección 3…). Con
 * "a" y "1" el formulario dejaba pasar y recién en el último paso aparecía
 * "Revisá los datos del formulario", sin decir qué campo (bug real,
 * 2026-08-03). Derivando la regla del schema, cliente y servidor no pueden
 * divergir: si mañana cambia el mínimo, cambia en los dos lados solo.
 */
function validarCampo(campo: CampoEnvio) {
  return (valor: unknown) => {
    const r = shippingAddressSchema.shape[campo].safeParse(valor);
    return r.success || (r.error.issues[0]?.message ?? "Revisá este dato.");
  };
}

/** Identifica una línea del carrito (mismo criterio que el store). */
function lineKey(i: CartItem): string {
  return `${i.productId}|${i.variantId ?? ""}|${i.color ?? ""}`;
}

/** Qué campos pide cada forma de entrega. Nada de pedir de más. */
const CAMPOS_POR_ENTREGA: Record<DeliveryType, CampoEnvio[]> = {
  pickup: ["fullName", "phone"],
  local: ["fullName", "phone", "street"],
  national: ["fullName", "phone", "street", "city", "province", "postalCode"],
};

/** Guarda qué se compró para que la pantalla de éxito borre SOLO eso. */
const COMPRADO_KEY = "hefesto-comprado";

const field =
  "w-full rounded-md border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-fg";
const labelCls = "mb-1 block text-xs font-medium text-dim";

type FormValues = {
  fullName: string;
  phone: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  notes: string;
};

const STEPS = ["Entrega", "Pago", "Revisión"] as const;

export function CheckoutStepper({
  mpEnabled = true,
  shipping,
}: {
  mpEnabled?: boolean;
  /** Ciudad, barrios y precios que carga Ale en Configuración → Envíos. */
  shipping: ShippingConfig;
}) {
  const router = useRouter();
  const mounted = useMounted();
  const items = useCartStore((s) => s.items);
  const appliedCoupon = useCartStore((s) => s.appliedCoupon);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clear);

  const ciudad = shipping.city?.trim() || "";
  const hayZonas = shipping.zones.length > 0;
  // Sin ciudad configurada no se puede ofrecer "soy de acá": todo va al
  // formulario nacional (y Ale ve el aviso en Configuración → Envíos).
  const ofreceLocal = ciudad !== "";

  const [step, setStep] = useState(0);
  /** null = todavía no contestó "¿sos de {ciudad}?" */
  const [esDeLaCiudad, setEsDeLaCiudad] = useState<boolean | null>(null);
  const [modoLocal, setModoLocal] = useState<"pickup" | "local">("pickup");
  const [zone, setZone] = useState("");
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>("mercadopago");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [esProblemaDelCarrito, setEsProblemaDelCarrito] = useState(false);
  /** Líneas TILDADAS: se compra solo esto, el resto queda en el carrito. */
  const [excluidas, setExcluidas] = useState<Set<string>>(new Set());

  const {
    register,
    trigger,
    getValues,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      fullName: "",
      phone: "",
      street: "",
      city: "",
      province: "",
      postalCode: "",
      notes: "",
    },
  });

  const elegidos = useMemo(
    () => items.filter((i) => !excluidas.has(lineKey(i))),
    [items, excluidas],
  );
  const subtotal = useMemo(
    () => elegidos.reduce((a, i) => a + i.unitPrice * i.quantity, 0),
    [elegidos],
  );

  // Tipo de entrega efectivo según lo que fue contestando.
  const deliveryType: DeliveryType | null =
    esDeLaCiudad === null
      ? null
      : esDeLaCiudad
        ? modoLocal === "pickup"
          ? "pickup"
          : "local"
        : "national";

  // Costo del envío mostrado. Es el MISMO cálculo que hace el servidor
  // (función compartida), así el cliente nunca ve un número y paga otro.
  const envio = useMemo(() => {
    if (deliveryType === null) return { cost: 0, label: "", free: false };
    if (deliveryType === "local" && !zone)
      return { cost: 0, label: "Elegí tu barrio", free: false };
    try {
      return quoteShipping(
        deliveryType === "local"
          ? {
              type: "local",
              fullName: "x",
              phone: "xxxxxx",
              zone,
              street: "xxx",
            }
          : deliveryType === "pickup"
            ? { type: "pickup", fullName: "x", phone: "xxxxxx" }
            : {
                type: "national",
                fullName: "x",
                phone: "xxxxxx",
                street: "xxx",
                city: "xx",
                province: "xx",
                postalCode: "xxx",
              },
        shipping,
        subtotal,
      );
    } catch {
      return { cost: 0, label: "Barrio no disponible", free: false };
    }
  }, [deliveryType, zone, shipping, subtotal]);

  const descuento = appliedCoupon?.discount ?? 0;
  const total = Math.max(0, subtotal - descuento) + envio.cost;

  if (!mounted) return null;

  if (items.length === 0) {
    return (
      <div className="bg-surface-1 border-surface-2 rounded-lg border p-8 text-center">
        <p className="text-dim">Tu carrito está vacío.</p>
        <Link
          href="/catalogo"
          className={cn(buttonVariants({ variant: "primary" }), "mt-4")}
        >
          Ver catálogo
        </Link>
      </div>
    );
  }

  function armarDelivery(): Delivery {
    const v = getValues();
    const notes = v.notes?.trim() ? { notes: v.notes.trim() } : {};
    if (deliveryType === "pickup") {
      return { type: "pickup", fullName: v.fullName, phone: v.phone, ...notes };
    }
    if (deliveryType === "local") {
      return {
        type: "local",
        fullName: v.fullName,
        phone: v.phone,
        zone,
        street: v.street,
        ...notes,
      };
    }
    return {
      type: "national",
      fullName: v.fullName,
      phone: v.phone,
      street: v.street,
      city: v.city,
      province: v.province,
      postalCode: v.postalCode,
      ...notes,
    };
  }

  const irAPago = async () => {
    if (deliveryType === null) return;
    if (deliveryType === "local" && !zone) {
      setZoneError("Elegí tu barrio para calcular el envío.");
      return;
    }
    setZoneError(null);
    const campos = CAMPOS_POR_ENTREGA[deliveryType];
    const ok = await trigger(campos);
    if (!ok) {
      // Que el cursor caiga en el primer campo con problema: en celular el
      // error puede quedar fuera de la pantalla y parecía que el botón no
      // hacía nada.
      const primero = campos.find((c) => errors[c as keyof FormValues]);
      if (primero) setFocus(primero as keyof FormValues);
      return;
    }
    setFormError(null);
    setStep(1);
  };

  const confirm = async () => {
    setSubmitting(true);
    setFormError(null);
    setEsProblemaDelCarrito(false);
    const comprados = elegidos.map(lineKey);
    const res = await runAction(
      () =>
        createOrderAction({
          items: elegidos.map((i) => ({
            productId: i.productId,
            slug: i.slug,
            variantId: i.variantId,
            color: i.color,
            quantity: i.quantity,
          })),
          paymentMethod: payment,
          delivery: armarDelivery(),
          ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
        }),
      { silent: true },
    );
    if (!res.ok) {
      setFormError(res.error.message);
      // Códigos que significan "algo del carrito ya no se puede comprar".
      setEsProblemaDelCarrito(
        [
          "CART_INVALID",
          "PRODUCT_UNAVAILABLE",
          "VARIANT_NOT_FOUND",
          "VARIANT_REQUIRED",
          "INVALID_COLOR",
          "COLOR_REQUIRED",
          "EMPTY_CART",
        ].includes(res.error.code),
      );
      if (res.error.code === "ZONE_NOT_FOUND") {
        setStep(0);
        setZoneError(res.error.message);
      }
      // Si el servidor señala campos de la entrega, los marco y VUELVO al paso
      // 1: dejar el error en la pantalla de Revisión, sin decir cuál era el
      // campo, era un callejón sin salida.
      const fields = (res.error as { fields?: Record<string, string> }).fields;
      if (fields && deliveryType) {
        const campos = CAMPOS_POR_ENTREGA[deliveryType];
        const conError = campos.filter(
          (c) => fields[c] ?? fields[`delivery.${c}`],
        );
        for (const c of conError) {
          const msg = fields[c] ?? fields[`delivery.${c}`];
          if (msg)
            setError(c as keyof FormValues, { type: "server", message: msg });
        }
        if (conError.length > 0) {
          setStep(0);
          setFocus(conError[0] as keyof FormValues);
        }
      }
      setSubmitting(false);
      return;
    }
    // El carrito se limpia por LÍNEA comprada, no entero: lo que el cliente
    // dejó sin tildar sigue guardado para la próxima (pedido de Ale).
    try {
      sessionStorage.setItem(COMPRADO_KEY, JSON.stringify(comprados));
    } catch {
      /* modo incógnito sin storage: no es motivo para frenar la compra */
    }
    if (res.redirectUrl) {
      // MercadoPago: salimos al checkout externo. El carrito se limpia recién
      // al volver a la pantalla de éxito (no antes de pagar).
      window.location.href = res.redirectUrl;
      return;
    }
    router.push(
      `/checkout/exito?pedido=${encodeURIComponent(res.orderNumber)}`,
    );
  };

  const v = getValues();
  const puedeSeguir = elegidos.length > 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        {/* Indicador de pasos */}
        <ol className="mb-6 flex items-center gap-2 text-sm">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
                  i <= step
                    ? "bg-accent text-accent-fg"
                    : "bg-surface-2 text-dim",
                )}
              >
                {i + 1}
              </span>
              <span
                className={i === step ? "text-fg" : "text-dim hidden sm:inline"}
              >
                {label}
              </span>
              {i < STEPS.length - 1 ? (
                <span className="text-surface-3">→</span>
              ) : null}
            </li>
          ))}
        </ol>

        {formError ? (
          <div className="bg-danger/10 mb-4 rounded-md px-3 py-2 text-sm">
            <p className="text-danger">{formError}</p>
            {esProblemaDelCarrito ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Link href="/carrito" className="text-fg underline">
                  Revisar el carrito
                </Link>
                <button
                  type="button"
                  className="text-dim underline"
                  onClick={() => {
                    clearCart();
                    setFormError(null);
                  }}
                >
                  Vaciar el carrito
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ---------------- Paso 1: entrega ---------------- */}
        {step === 0 ? (
          <div className="space-y-5">
            {ofreceLocal ? (
              <div>
                <p className="text-fg mb-2.5 text-sm font-medium">
                  ¿Sos de {ciudad}?
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <OpcionGrande
                    activo={esDeLaCiudad === true}
                    onClick={() => setEsDeLaCiudad(true)}
                    titulo={`Sí, soy de ${ciudad}`}
                    detalle="Retirás en el local o te lo llevamos a tu barrio."
                  />
                  <OpcionGrande
                    activo={esDeLaCiudad === false}
                    onClick={() => setEsDeLaCiudad(false)}
                    titulo="No, soy de otra ciudad"
                    detalle="Te pedimos la dirección y coordinamos el envío."
                  />
                </div>
              </div>
            ) : null}

            {/* Vive en la ciudad: retiro o envío al barrio */}
            {esDeLaCiudad === true ? (
              <div>
                <p className="text-fg mb-2.5 text-sm font-medium">
                  ¿Cómo lo recibís?
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <OpcionGrande
                    activo={modoLocal === "pickup"}
                    onClick={() => setModoLocal("pickup")}
                    titulo="Retiro en el local"
                    detalle="Sin costo. Coordinamos el día por WhatsApp."
                    tag="Gratis"
                  />
                  <OpcionGrande
                    activo={modoLocal === "local"}
                    onClick={() => setModoLocal("local")}
                    titulo="Envío a mi barrio"
                    detalle={
                      hayZonas
                        ? "Elegís tu barrio y ves el costo al instante."
                        : "Todavía no hay barrios cargados."
                    }
                    disabled={!hayZonas}
                  />
                </div>

                {modoLocal === "local" && hayZonas ? (
                  <div className="mt-4">
                    <label className={labelCls} htmlFor="zone">
                      Tu barrio
                    </label>
                    <select
                      id="zone"
                      className={field}
                      value={zone}
                      onChange={(e) => {
                        setZone(e.target.value);
                        setZoneError(null);
                      }}
                    >
                      <option value="">— Elegí tu barrio —</option>
                      {shipping.zones.map((z) => (
                        <option key={z.name} value={z.name}>
                          {z.name} · {formatPrice(z.price)}
                        </option>
                      ))}
                    </select>
                    {zoneError ? (
                      <p className="text-danger mt-1 text-xs">{zoneError}</p>
                    ) : null}
                    {shipping.freeOver > 0 ? (
                      <p className="text-faint mt-1 text-xs">
                        Envío bonificado en compras desde{" "}
                        {formatPrice(shipping.freeOver)}.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Datos: solo los que hacen falta según la entrega elegida */}
            {deliveryType ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  id="fullName"
                  label="Nombre y apellido"
                  ancho
                  error={errors.fullName?.message}
                >
                  <input
                    id="fullName"
                    className={field}
                    {...register("fullName", {
                      validate: validarCampo("fullName"),
                    })}
                  />
                </Campo>
                <Campo
                  id="phone"
                  label="Teléfono / WhatsApp"
                  error={errors.phone?.message}
                >
                  <input
                    id="phone"
                    inputMode="tel"
                    className={field}
                    {...register("phone", { validate: validarCampo("phone") })}
                  />
                </Campo>

                {deliveryType === "local" ? (
                  <Campo
                    id="street"
                    label="Dirección (calle y número)"
                    error={errors.street?.message}
                  >
                    <input
                      id="street"
                      className={field}
                      {...register("street", {
                        validate: validarCampo("street"),
                      })}
                    />
                  </Campo>
                ) : null}

                {deliveryType === "national" ? (
                  <>
                    <Campo
                      id="postalCode"
                      label="Código postal"
                      error={errors.postalCode?.message}
                    >
                      <input
                        id="postalCode"
                        className={field}
                        {...register("postalCode", {
                          validate: validarCampo("postalCode"),
                        })}
                      />
                    </Campo>
                    <Campo
                      id="street"
                      label="Dirección"
                      ancho
                      error={errors.street?.message}
                    >
                      <input
                        id="street"
                        className={field}
                        {...register("street", {
                          validate: validarCampo("street"),
                        })}
                      />
                    </Campo>
                    <Campo
                      id="city"
                      label="Localidad"
                      error={errors.city?.message}
                    >
                      <input
                        id="city"
                        className={field}
                        {...register("city", {
                          validate: validarCampo("city"),
                        })}
                      />
                    </Campo>
                    <Campo
                      id="province"
                      label="Provincia"
                      error={errors.province?.message}
                    >
                      <input
                        id="province"
                        className={field}
                        {...register("province", {
                          validate: validarCampo("province"),
                        })}
                      />
                    </Campo>
                  </>
                ) : null}

                <Campo id="notes" label="Notas (opcional)" ancho>
                  <textarea
                    id="notes"
                    rows={2}
                    className={field}
                    {...register("notes")}
                  />
                </Campo>

                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    onClick={irAPago}
                    className="w-full"
                    disabled={!puedeSeguir}
                  >
                    Continuar
                  </Button>
                  {!puedeSeguir ? (
                    <p className="text-faint mt-2 text-center text-xs">
                      Tildá al menos un producto en “Tu pedido”.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ---------------- Paso 2: pago ---------------- */}
        {step === 1 ? (
          <div className="space-y-3">
            {mpEnabled ? (
              <OpcionPago
                activo={payment === "mercadopago"}
                onClick={() => setPayment("mercadopago")}
                titulo="MercadoPago"
                detalle="Tarjeta de crédito o débito. Te llevamos a MercadoPago."
              />
            ) : null}
            <OpcionPago
              activo={payment === "cash"}
              onClick={() => setPayment("cash")}
              titulo="Efectivo"
              detalle="No se paga online: coordinamos por WhatsApp al confirmar."
            />

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setFormError(null);
                  setStep(0);
                }}
              >
                Volver
              </Button>
              <Button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1"
              >
                Continuar
              </Button>
            </div>
          </div>
        ) : null}

        {/* ---------------- Paso 3: revisión ---------------- */}
        {step === 2 ? (
          <div className="space-y-4">
            <section className="bg-surface-1 border-surface-2 rounded-lg border p-4">
              <h3 className="text-fg mb-1 text-sm font-medium">Entrega</h3>
              <p className="text-dim text-sm">
                {v.fullName} · {v.phone}
                <br />
                {deliveryType === "pickup"
                  ? `Retiro en el local · ${ciudad}`
                  : deliveryType === "local"
                    ? `${v.street} · ${zone} · ${ciudad}`
                    : `${v.street}, ${v.city}, ${v.province} (${v.postalCode})`}
              </p>
            </section>
            <section className="bg-surface-1 border-surface-2 rounded-lg border p-4">
              <h3 className="text-fg mb-1 text-sm font-medium">Pago</h3>
              <p className="text-dim text-sm">
                {payment === "mercadopago" ? "MercadoPago" : "Efectivo"}
              </p>
            </section>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setFormError(null);
                  setStep(1);
                }}
              >
                Volver
              </Button>
              <Button
                type="button"
                onClick={confirm}
                disabled={submitting || !puedeSeguir}
                className="flex-1"
              >
                {submitting ? "Creando pedido…" : "Confirmar pedido"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* ---------------- Resumen: qué se compra ---------------- */}
      <aside className="bg-surface-1 border-surface-2 h-fit rounded-lg border p-4">
        <h2 className="font-display text-fg mb-1 text-lg">Tu pedido</h2>
        <p className="text-faint mb-3 text-xs">
          Destildá lo que no quieras llevar ahora: queda guardado en el carrito.
        </p>
        <ul className="space-y-2">
          {items.map((i) => {
            const k = lineKey(i);
            const on = !excluidas.has(k);
            return (
              <li
                key={k}
                className={cn(
                  "border-surface-2 flex gap-2.5 rounded-lg border p-2.5",
                  !on && "opacity-45",
                )}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={`${on ? "Sacar" : "Incluir"} ${i.name}`}
                  onClick={() =>
                    setExcluidas((s) => {
                      const n = new Set(s);
                      if (n.has(k)) n.delete(k);
                      else n.add(k);
                      return n;
                    })
                  }
                  className={cn(
                    "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border transition-colors",
                    on
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-surface-3",
                  )}
                >
                  {on ? (
                    <svg
                      viewBox="0 0 24 24"
                      width="13"
                      height="13"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : null}
                </button>

                {i.image ? (
                  <span className="bg-surface-2 relative h-11 w-11 shrink-0 overflow-hidden rounded-md">
                    <Image
                      src={i.image}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  </span>
                ) : null}

                <div className="min-w-0 flex-1">
                  <p className="text-fg truncate text-[13px] font-medium">
                    {i.name}
                  </p>
                  {i.variantLabel || i.color ? (
                    <p className="text-faint truncate text-[11.5px]">
                      {[i.variantLabel, i.color].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="border-surface-3 flex items-center rounded-md border">
                      <button
                        type="button"
                        aria-label="Restar"
                        className="text-dim h-7 w-7"
                        onClick={() =>
                          setQuantity(
                            i.productId,
                            i.variantId,
                            Math.max(1, i.quantity - 1),
                            i.color,
                          )
                        }
                      >
                        −
                      </button>
                      <span className="text-fg w-6 text-center text-xs">
                        {i.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="Sumar"
                        className="text-dim h-7 w-7"
                        onClick={() =>
                          setQuantity(
                            i.productId,
                            i.variantId,
                            i.quantity + 1,
                            i.color,
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                    <span className="text-fg ml-auto text-sm whitespace-nowrap">
                      {formatPrice(i.unitPrice * i.quantity)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Quitar ${i.name} del carrito`}
                      className="text-faint hover:text-danger"
                      onClick={() =>
                        removeItem(i.productId, i.variantId, i.color)
                      }
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="15"
                        height="15"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M3 6h18M8 6V4h8v2m1 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      </svg>
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-3">
          <CouponInput subtotal={subtotal} />
        </div>

        <div className="border-surface-2 mt-3 space-y-1 border-t pt-3 text-sm">
          <Fila label={`Productos (${elegidos.length})`} value={subtotal} />
          {descuento > 0 ? (
            <div className="flex justify-between">
              <span className="text-dim">Descuento</span>
              <span className="text-success">-{formatPrice(descuento)}</span>
            </div>
          ) : null}
          {deliveryType ? (
            <div className="flex justify-between">
              <span className="text-dim">Envío</span>
              <span className={envio.cost === 0 ? "text-success" : "text-fg"}>
                {deliveryType === "national"
                  ? "A coordinar"
                  : envio.cost === 0
                    ? "Gratis"
                    : formatPrice(envio.cost)}
              </span>
            </div>
          ) : null}
          <div className="border-surface-2 mt-1 flex justify-between border-t pt-2 text-base font-medium">
            <span className="text-fg">Total</span>
            <span className="text-fg">{formatPrice(total)}</span>
          </div>
        </div>

        {deliveryType === "national" ? (
          <p className="text-faint mt-2 text-xs">
            El flete al resto del país lo coordinamos por WhatsApp y corre por
            cuenta del comprador.
          </p>
        ) : null}
      </aside>
    </div>
  );
}

/* ---------------------- Piezas chicas de la pantalla ---------------------- */

function Fila({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-dim">{label}</span>
      <span className="text-fg">{formatPrice(value)}</span>
    </div>
  );
}

function Campo({
  id,
  label,
  error,
  ancho,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  ancho?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={ancho ? "sm:col-span-2" : undefined}>
      <label className={labelCls} htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? <p className="text-danger mt-1 text-xs">{error}</p> : null}
    </div>
  );
}

/** Tarjeta grande para elegir (más clara que un radio chiquito en celular). */
function OpcionGrande({
  activo,
  onClick,
  titulo,
  detalle,
  tag,
  disabled,
}: {
  activo: boolean;
  onClick: () => void;
  titulo: string;
  detalle: string;
  tag?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={activo}
      className={cn(
        "rounded-xl border p-4 text-left transition-colors",
        activo
          ? "border-accent bg-accent/5"
          : "border-surface-2 bg-surface-1 hover:border-surface-3",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span className="flex items-center gap-2">
        <span className="text-fg text-sm font-medium">{titulo}</span>
        {tag ? (
          <span className="bg-success/15 text-success rounded px-1.5 py-0.5 text-[10.5px] font-semibold">
            {tag}
          </span>
        ) : null}
      </span>
      <span className="text-dim mt-1 block text-xs leading-relaxed">
        {detalle}
      </span>
    </button>
  );
}

function OpcionPago({
  activo,
  onClick,
  titulo,
  detalle,
}: {
  activo: boolean;
  onClick: () => void;
  titulo: string;
  detalle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-4 text-left",
        activo ? "border-accent bg-accent/5" : "border-surface-2 bg-surface-1",
      )}
    >
      <span
        className={cn(
          "mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border",
          activo ? "border-accent" : "border-surface-3",
        )}
      >
        {activo ? <span className="bg-accent h-2 w-2 rounded-full" /> : null}
      </span>
      <span>
        <span className="text-fg block text-sm font-medium">{titulo}</span>
        <span className="text-dim block text-xs">{detalle}</span>
      </span>
    </button>
  );
}
