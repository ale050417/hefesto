"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-mounted";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { selectSubtotal, useCartStore } from "@/stores/cartStore";
import { createOrderAction } from "../actions";
import { shippingAddressSchema, type ShippingAddress } from "../schemas";
import type { PaymentMethod } from "../types";
import { runAction } from "@/lib/run-action";

/**
 * Valida UN campo del envío con el MISMO schema que corre el servidor.
 *
 * Antes cada input usaba `required: "…"`, que solo exige "no vacío", mientras
 * el servidor pide mínimos reales (nombre 2, teléfono 6, dirección 3…). Con
 * "a" y "1" el formulario dejaba pasar y recién en el último paso aparecía
 * "Revisá los datos del formulario", sin decir qué campo (bug real,
 * 2026-08-03). Derivando la regla del schema, cliente y servidor no pueden
 * divergir: si mañana cambia el mínimo, cambia en los dos lados solo.
 */
function validarCampo(campo: keyof ShippingAddress) {
  return (valor: unknown) => {
    const r = shippingAddressSchema.shape[campo].safeParse(valor);
    return r.success || (r.error.issues[0]?.message ?? "Revisá este dato.");
  };
}

/** Campos del paso de envío (para saber si un error del servidor es de ahí). */
const CAMPOS_ENVIO = [
  "fullName",
  "phone",
  "street",
  "city",
  "province",
  "postalCode",
] as const;

const field =
  "w-full rounded-md border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-fg";
const labelCls = "mb-1 block text-xs font-medium text-dim";

// El efectivo no se abona online: se ofrece coordinar por WhatsApp.
function waHref(whatsapp: string | null, text: string): string | null {
  if (!whatsapp) return null;
  const d = whatsapp.replace(/[^\d]/g, "");
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : null;
}

const PAYMENT_OPTIONS: {
  value: PaymentMethod;
  label: string;
  hint: string;
}[] = [
  {
    value: "transfer",
    label: "Transferencia bancaria",
    hint: "Te enviamos los datos para transferir.",
  },
  {
    value: "mercadopago",
    label: "MercadoPago",
    hint: "Tarjeta de crédito o débito. Te llevamos a MercadoPago.",
  },
  { value: "cash", label: "Efectivo", hint: "Pagás al retirar el pedido." },
];

const STEPS = ["Envío", "Pago", "Revisión"] as const;

export function CheckoutStepper({
  mpEnabled = true,
  whatsapp = null,
}: {
  mpEnabled?: boolean;
  whatsapp?: string | null;
}) {
  const router = useRouter();
  const mounted = useMounted();
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore(selectSubtotal);
  const appliedCoupon = useCartStore((s) => s.appliedCoupon);

  const paymentOptions = PAYMENT_OPTIONS.filter(
    (o) => o.value !== "mercadopago" || mpEnabled,
  );
  const cashWa = waHref(
    whatsapp,
    "¡Hola! Quiero coordinar el pago en efectivo de mi pedido.",
  );
  const clearCart = useCartStore((s) => s.clear);
  const [step, setStep] = useState(0);
  const [payment, setPayment] = useState<PaymentMethod>("transfer");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  /** El error viene de una línea del carrito, no de los datos del cliente. */
  const [esProblemaDelCarrito, setEsProblemaDelCarrito] = useState(false);

  const {
    register,
    trigger,
    getValues,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<ShippingAddress>({
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

  const goToPayment = async () => {
    const valid = await trigger([...CAMPOS_ENVIO]);
    if (valid) {
      setFormError(null);
      setStep(1);
      return;
    }
    // Que el cursor caiga en el primer campo con problema: en celular el error
    // puede quedar fuera de la pantalla y parecía que el botón no hacía nada.
    const primero = CAMPOS_ENVIO.find((c) => errors[c]);
    if (primero) setFocus(primero);
  };

  const confirm = async () => {
    setSubmitting(true);
    setFormError(null);
    setEsProblemaDelCarrito(false);
    const res = await runAction(
      () =>
        createOrderAction({
          items: items.map((i) => ({
            productId: i.productId,
            slug: i.slug,
            variantId: i.variantId,
            color: i.color,
            quantity: i.quantity,
          })),
          paymentMethod: payment,
          shippingAddress: getValues(),
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
      // Si el servidor señala campos del envío, los marco y VUELVO al paso 1:
      // dejar el error en la pantalla de Revisión, sin decir cuál era el campo,
      // era un callejón sin salida.
      const fields = (res.error as { fields?: Record<string, string> }).fields;
      if (fields) {
        const delEnvio = CAMPOS_ENVIO.filter(
          (c) => fields[c] ?? fields[`shippingAddress.${c}`],
        );
        for (const c of delEnvio) {
          const msg = fields[c] ?? fields[`shippingAddress.${c}`];
          if (msg) setError(c, { type: "server", message: msg });
        }
        if (delEnvio.length > 0) {
          setStep(0);
          setFocus(delEnvio[0] as keyof ShippingAddress);
        }
      }
      setSubmitting(false);
      return;
    }
    if (res.redirectUrl) {
      // Pago con MercadoPago: salimos al checkout externo. El carrito se vacía
      // recién al volver a la pantalla de éxito (no antes de pagar).
      window.location.href = res.redirectUrl;
      return;
    }
    router.push(
      `/checkout/exito?pedido=${encodeURIComponent(res.orderNumber)}`,
    );
  };

  const shipping = getValues();

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
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
              {/* En móvil solo se lee el label del paso activo; los otros
                  quedan como círculos numerados (no entran los 3 textos). */}
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
            {/* Cuando el problema es un producto del carrito (uno que se
                despublicó, un tamaño que ya no existe, un carrito viejo
                guardado en el navegador) el cliente no tenía salida: el error
                aparecía en el último paso y el pedido no se podía crear NUNCA.
                Ahora hay un camino concreto para destrabarlo. */}
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

        {/* Paso 1: envío */}
        {step === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="fullName">
                Nombre y apellido
              </label>
              <input
                id="fullName"
                className={field}
                {...register("fullName", {
                  validate: validarCampo("fullName"),
                })}
              />
              {errors.fullName ? (
                <p className="text-danger mt-1 text-xs">
                  {errors.fullName.message}
                </p>
              ) : null}
            </div>
            <div>
              <label className={labelCls} htmlFor="phone">
                Teléfono
              </label>
              <input
                id="phone"
                className={field}
                {...register("phone", { validate: validarCampo("phone") })}
              />
              {errors.phone ? (
                <p className="text-danger mt-1 text-xs">
                  {errors.phone.message}
                </p>
              ) : null}
            </div>
            <div>
              <label className={labelCls} htmlFor="postalCode">
                Código postal
              </label>
              <input
                id="postalCode"
                className={field}
                {...register("postalCode", {
                  validate: validarCampo("postalCode"),
                })}
              />
              {errors.postalCode ? (
                <p className="text-danger mt-1 text-xs">
                  {errors.postalCode.message}
                </p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="street">
                Dirección
              </label>
              <input
                id="street"
                className={field}
                {...register("street", { validate: validarCampo("street") })}
              />
              {errors.street ? (
                <p className="text-danger mt-1 text-xs">
                  {errors.street.message}
                </p>
              ) : null}
            </div>
            <div>
              <label className={labelCls} htmlFor="city">
                Localidad
              </label>
              <input
                id="city"
                className={field}
                {...register("city", { validate: validarCampo("city") })}
              />
              {errors.city ? (
                <p className="text-danger mt-1 text-xs">
                  {errors.city.message}
                </p>
              ) : null}
            </div>
            <div>
              <label className={labelCls} htmlFor="province">
                Provincia
              </label>
              <input
                id="province"
                className={field}
                {...register("province", {
                  validate: validarCampo("province"),
                })}
              />
              {errors.province ? (
                <p className="text-danger mt-1 text-xs">
                  {errors.province.message}
                </p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="notes">
                Notas (opcional)
              </label>
              <textarea
                id="notes"
                rows={2}
                className={field}
                {...register("notes")}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="button" onClick={goToPayment} className="w-full">
                Continuar al pago
              </Button>
            </div>
          </div>
        ) : null}

        {/* Paso 2: pago */}
        {step === 1 ? (
          <div className="space-y-3">
            {paymentOptions.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-4",
                  payment === opt.value
                    ? "border-accent bg-accent/5"
                    : "border-surface-2 bg-surface-1",
                )}
              >
                <input
                  type="radio"
                  name="payment"
                  className="mt-1"
                  checked={payment === opt.value}
                  onChange={() => setPayment(opt.value)}
                />
                <span>
                  <span className="text-fg block text-sm font-medium">
                    {opt.label}
                  </span>
                  <span className="text-dim block text-xs">{opt.hint}</span>
                </span>
              </label>
            ))}
            {payment === "cash" ? (
              <div className="border-accent/40 bg-accent/5 rounded-lg border p-4">
                <p className="text-fg text-sm font-medium">
                  El efectivo no se paga online
                </p>
                <p className="text-dim mt-1 text-xs leading-relaxed">
                  Confirmá el pedido y coordinamos el pago y la entrega o retiro
                  por WhatsApp.
                </p>
                {cashWa ? (
                  <a
                    href={cashWa}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={cn(
                      buttonVariants({ variant: "primary" }),
                      "mt-3 inline-flex",
                    )}
                  >
                    Coordinar por WhatsApp
                  </a>
                ) : null}
              </div>
            ) : null}
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
                Revisar pedido
              </Button>
            </div>
          </div>
        ) : null}

        {/* Paso 3: revisión */}
        {step === 2 ? (
          <div className="space-y-4">
            <section className="bg-surface-1 border-surface-2 rounded-lg border p-4">
              <h3 className="text-fg mb-1 text-sm font-medium">Envío</h3>
              <p className="text-dim text-sm">
                {shipping.fullName} · {shipping.phone}
                <br />
                {shipping.street}, {shipping.city}, {shipping.province} (
                {shipping.postalCode})
              </p>
            </section>
            <section className="bg-surface-1 border-surface-2 rounded-lg border p-4">
              <h3 className="text-fg mb-1 text-sm font-medium">Pago</h3>
              <p className="text-dim text-sm">
                {paymentOptions.find((o) => o.value === payment)?.label}
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
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? "Creando pedido…" : "Confirmar pedido"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Resumen del carrito */}
      <aside className="bg-surface-1 border-surface-2 h-fit rounded-lg border p-4">
        <h2 className="font-display text-fg mb-3 text-lg">Tu pedido</h2>
        <ul className="space-y-2">
          {items.map((i) => (
            <li
              key={`${i.productId}-${i.variantId ?? ""}`}
              className="flex justify-between gap-2 text-sm"
            >
              <span className="text-dim">
                {i.quantity}× {i.name}
                {i.variantLabel ? ` (${i.variantLabel})` : ""}
              </span>
              <span className="text-fg shrink-0 whitespace-nowrap">
                {formatPrice(i.unitPrice * i.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-surface-2 mt-3 space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-dim">Subtotal</span>
            <span className="text-fg">{formatPrice(subtotal)}</span>
          </div>
          {appliedCoupon ? (
            <div className="flex justify-between">
              <span className="text-dim">Cupón {appliedCoupon.code}</span>
              <span className="text-success">
                -{formatPrice(appliedCoupon.discount)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-medium">
            <span className="text-fg">Total</span>
            <span className="text-fg">
              {formatPrice(
                Math.max(0, subtotal - (appliedCoupon?.discount ?? 0)),
              )}
            </span>
          </div>
        </div>
        <p className="text-dim mt-2 text-xs">
          El total final se confirma al crear el pedido.
        </p>
      </aside>
    </div>
  );
}
