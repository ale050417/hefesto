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
import type { ShippingAddress } from "../schemas";
import type { PaymentMethod } from "../types";

const field =
  "w-full rounded-md border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-fg";
const labelCls = "mb-1 block text-xs font-medium text-dim";

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

export function CheckoutStepper({ mpEnabled = true }: { mpEnabled?: boolean }) {
  const router = useRouter();
  const mounted = useMounted();
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore(selectSubtotal);

  const paymentOptions = PAYMENT_OPTIONS.filter(
    (o) => o.value !== "mercadopago" || mpEnabled,
  );
  const [step, setStep] = useState(0);
  const [payment, setPayment] = useState<PaymentMethod>("transfer");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    trigger,
    getValues,
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
    const valid = await trigger([
      "fullName",
      "phone",
      "street",
      "city",
      "province",
      "postalCode",
    ]);
    if (valid) setStep(1);
  };

  const confirm = async () => {
    setSubmitting(true);
    setFormError(null);
    const res = await createOrderAction({
      items: items.map((i) => ({
        productId: i.productId,
        slug: i.slug,
        variantId: i.variantId,
        quantity: i.quantity,
      })),
      paymentMethod: payment,
      shippingAddress: getValues(),
    });
    if (!res.ok) {
      setFormError(res.error.message);
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
              <span className={i === step ? "text-fg" : "text-dim"}>
                {label}
              </span>
              {i < STEPS.length - 1 ? (
                <span className="text-surface-3">→</span>
              ) : null}
            </li>
          ))}
        </ol>

        {formError ? (
          <p className="bg-danger/10 text-danger mb-4 rounded-md px-3 py-2 text-sm">
            {formError}
          </p>
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
                  required: "Ingresá tu nombre y apellido.",
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
                {...register("phone", { required: "Ingresá un teléfono." })}
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
                  required: "Ingresá el código postal.",
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
                {...register("street", { required: "Ingresá la dirección." })}
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
                {...register("city", { required: "Ingresá la localidad." })}
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
                {...register("province", { required: "Ingresá la provincia." })}
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
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(0)}>
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
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
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
              <span className="text-fg">
                {formatPrice(i.unitPrice * i.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-surface-2 mt-3 flex justify-between border-t pt-3 text-sm">
          <span className="text-dim">Subtotal</span>
          <span className="text-fg font-medium">{formatPrice(subtotal)}</span>
        </div>
        <p className="text-dim mt-2 text-xs">
          El total final se confirma al crear el pedido.
        </p>
      </aside>
    </div>
  );
}
