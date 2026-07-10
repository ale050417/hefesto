import { describe, expect, it, vi } from "vitest";
import { InvalidTransitionError } from "@/core/errors";
import type {
  CreatePreferenceParams,
  CreatedPreference,
} from "@/core/payments/mercadopago";
import type { OrderWithItems } from "../types";
import { OrderError } from "./orderService";
import {
  cancelPendingOrder,
  confirmOrderPayment,
  startMercadoPagoPayment,
  type CancelPendingDeps,
  type ConfirmPaymentDeps,
  type PaymentDeps,
} from "./paymentService";

function makeOrder(): OrderWithItems {
  return {
    id: "order-1",
    orderNumber: "HEF-ABC",
    items: [
      {
        id: "i1",
        orderId: "order-1",
        productId: "p1",
        productName: "Dragón",
        variantLabel: "Grande",
        unitPrice: "1500.00",
        quantity: 2,
        lineTotal: "3000.00",
      },
    ],
    history: [],
  } as unknown as OrderWithItems;
}

describe("startMercadoPagoPayment", () => {
  it("arma la preferencia desde los snapshots del pedido y devuelve el init_point", async () => {
    const createPreference = vi.fn<
      (p: CreatePreferenceParams) => Promise<CreatedPreference>
    >(async () => ({ id: "pref-1", initPoint: "https://mp/checkout/pref-1" }));
    const deps: PaymentDeps = {
      getOrder: async () => makeOrder(),
      createPreference,
    };

    const res = await startMercadoPagoPayment(
      "order-1",
      { siteUrl: "https://hefesto.test", payerEmail: "ada@test.com" },
      deps,
    );

    expect(res).toEqual({
      redirectUrl: "https://mp/checkout/pref-1",
      preferenceId: "pref-1",
    });
    const arg = createPreference.mock.calls[0]![0];
    expect(arg.externalReference).toBe("order-1");
    expect(arg.items[0]).toEqual({
      title: "Dragón (Grande)",
      quantity: 2,
      unitPrice: 1500,
    });
    expect(arg.payerEmail).toBe("ada@test.com");
  });

  it("lanza NOT_FOUND si el pedido no existe", async () => {
    const deps: PaymentDeps = {
      getOrder: async () => null,
      createPreference: vi.fn(),
    };
    await expect(
      startMercadoPagoPayment("x", { siteUrl: "https://h.test" }, deps),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("envuelve los errores de MercadoPago como PAYMENT_ERROR", async () => {
    const deps: PaymentDeps = {
      getOrder: async () => makeOrder(),
      createPreference: vi.fn(async () => {
        throw new Error("MP caído");
      }),
    };
    await expect(
      startMercadoPagoPayment("order-1", { siteUrl: "https://h.test" }, deps),
    ).rejects.toMatchObject({ code: "PAYMENT_ERROR" });
    await expect(
      startMercadoPagoPayment("order-1", { siteUrl: "https://h.test" }, deps),
    ).rejects.toBeInstanceOf(OrderError);
  });
});

describe("confirmOrderPayment", () => {
  it("confirma un pedido pendiente (pending_payment → confirmed) con paidAt", async () => {
    const markPaid = vi.fn<ConfirmPaymentDeps["markPaid"]>(
      async (p) =>
        ({
          ...makeOrder(),
          status: p.toStatus,
          paidAt: p.paidAt,
        }) as unknown as Awaited<ReturnType<ConfirmPaymentDeps["markPaid"]>>,
    );
    const deps: ConfirmPaymentDeps = {
      getOrder: async () =>
        ({ ...makeOrder(), status: "pending_payment" }) as unknown as Awaited<
          ReturnType<ConfirmPaymentDeps["getOrder"]>
        >,
      markPaid,
    };

    await confirmOrderPayment("order-1", deps);

    const arg = markPaid.mock.calls[0]![0];
    expect(arg).toMatchObject({
      orderId: "order-1",
      fromStatus: "pending_payment",
      toStatus: "confirmed",
    });
    expect(arg.paidAt).toBeInstanceOf(Date);
  });

  it("es idempotente: no re-procesa un pedido ya confirmado", async () => {
    const markPaid = vi.fn<ConfirmPaymentDeps["markPaid"]>();
    const deps: ConfirmPaymentDeps = {
      getOrder: async () =>
        ({ ...makeOrder(), status: "confirmed" }) as unknown as Awaited<
          ReturnType<ConfirmPaymentDeps["getOrder"]>
        >,
      markPaid,
    };

    await confirmOrderPayment("order-1", deps);
    expect(markPaid).not.toHaveBeenCalled();
  });

  it("lanza NOT_FOUND si el pedido no existe", async () => {
    const deps: ConfirmPaymentDeps = {
      getOrder: async () => null,
      markPaid: vi.fn(),
    };
    await expect(confirmOrderPayment("x", deps)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  // Stock (diseño 2026-07): el pago acreditado descuenta filamento, UNA vez.
  it("al confirmar descuenta filamento; los reintentos idempotentes no", async () => {
    const deductFilament = vi.fn(async () => undefined);
    const deps: ConfirmPaymentDeps = {
      getOrder: async () =>
        ({ ...makeOrder(), status: "pending_payment" }) as unknown as Awaited<
          ReturnType<ConfirmPaymentDeps["getOrder"]>
        >,
      markPaid: vi.fn(
        async () =>
          ({ ...makeOrder(), status: "confirmed" }) as unknown as Awaited<
            ReturnType<ConfirmPaymentDeps["markPaid"]>
          >,
      ),
      deductFilament,
    };
    await confirmOrderPayment("order-1", deps);
    expect(deductFilament).toHaveBeenCalledExactlyOnceWith("order-1");

    // Reintento del webhook: el pedido ya está confirmado → ni marca ni descuenta.
    const depsRetry: ConfirmPaymentDeps = {
      ...deps,
      getOrder: async () =>
        ({ ...makeOrder(), status: "confirmed" }) as unknown as Awaited<
          ReturnType<ConfirmPaymentDeps["getOrder"]>
        >,
    };
    deductFilament.mockClear();
    await confirmOrderPayment("order-1", depsRetry);
    expect(deductFilament).not.toHaveBeenCalled();
  });

  // Auditoría 2026-07 (I3): si dos reintentos del webhook corren A LA VEZ,
  // el segundo pierde el compare-and-set (InvalidTransitionError) y debe
  // resolver de forma idempotente devolviendo el estado actual, no fallar.
  it("bajo carrera (otro proceso confirmó primero) devuelve el pedido sin fallar", async () => {
    let call = 0;
    const deps: ConfirmPaymentDeps = {
      getOrder: async () => {
        call += 1;
        // 1.ª lectura: todavía pendiente; 2.ª (tras perder la carrera): confirmado.
        return {
          ...makeOrder(),
          status: call === 1 ? "pending_payment" : "confirmed",
        } as unknown as Awaited<ReturnType<ConfirmPaymentDeps["getOrder"]>>;
      },
      markPaid: vi.fn(async () => {
        throw new InvalidTransitionError("El pedido cambió de estado.");
      }),
    };

    const result = await confirmOrderPayment("order-1", deps);
    expect(result.status).toBe("confirmed");
  });
});

describe("cancelPendingOrder", () => {
  it("cancela un pedido pendiente (pending_payment → cancelled)", async () => {
    const markCancelled = vi.fn<CancelPendingDeps["markCancelled"]>(
      async (p) =>
        ({ ...makeOrder(), status: p.toStatus }) as unknown as Awaited<
          ReturnType<CancelPendingDeps["markCancelled"]>
        >,
    );
    const deps: CancelPendingDeps = {
      getOrder: async () =>
        ({ ...makeOrder(), status: "pending_payment" }) as unknown as Awaited<
          ReturnType<CancelPendingDeps["getOrder"]>
        >,
      markCancelled,
    };

    await cancelPendingOrder("order-1", deps);

    expect(markCancelled.mock.calls[0]![0]).toMatchObject({
      orderId: "order-1",
      fromStatus: "pending_payment",
      toStatus: "cancelled",
    });
  });

  it("es idempotente: no toca un pedido que no está pendiente", async () => {
    const markCancelled = vi.fn<CancelPendingDeps["markCancelled"]>();
    const deps: CancelPendingDeps = {
      getOrder: async () =>
        ({ ...makeOrder(), status: "confirmed" }) as unknown as Awaited<
          ReturnType<CancelPendingDeps["getOrder"]>
        >,
      markCancelled,
    };
    await cancelPendingOrder("order-1", deps);
    expect(markCancelled).not.toHaveBeenCalled();
  });
});
