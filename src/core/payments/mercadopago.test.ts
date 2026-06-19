import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildPreferenceBody, verifyWebhookSignature } from "./mercadopago";

describe("buildPreferenceBody", () => {
  const base = {
    externalReference: "order-1",
    items: [
      { title: "Dragón", quantity: 2, unitPrice: 1000 },
      { title: "Anillo (Grande)", quantity: 1, unitPrice: 250 },
    ],
    backUrls: {
      success: "https://hefesto.test/checkout/exito?pedido=HEF-1",
      failure: "https://hefesto.test/checkout?pago=fallido",
      pending: "https://hefesto.test/checkout/exito?pedido=HEF-1",
    },
    notificationUrl: "https://hefesto.test/api/webhooks/mercadopago",
    payerEmail: "ada@test.com",
  };

  it("mapea los ítems con precio y moneda ARS", () => {
    const body = buildPreferenceBody(base);
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toMatchObject({
      title: "Dragón",
      quantity: 2,
      unit_price: 1000,
      currency_id: "ARS",
    });
  });

  it("usa el id del pedido como external_reference", () => {
    expect(buildPreferenceBody(base).external_reference).toBe("order-1");
  });

  it("incluye back_urls, auto_return y notification_url", () => {
    const body = buildPreferenceBody(base);
    expect(body.back_urls.success).toContain("/checkout/exito");
    expect(body.auto_return).toBe("approved");
    expect(body.notification_url).toBe(
      "https://hefesto.test/api/webhooks/mercadopago",
    );
  });

  it("agrega el email del pagador cuando está", () => {
    expect(buildPreferenceBody(base).payer).toEqual({ email: "ada@test.com" });
  });

  it("omite payer y notification_url cuando no se pasan", () => {
    const body = buildPreferenceBody({
      externalReference: "o",
      items: base.items,
      backUrls: base.backUrls,
    });
    expect(body).not.toHaveProperty("payer");
    expect(body).not.toHaveProperty("notification_url");
  });
});

describe("verifyWebhookSignature", () => {
  const secret = "super-secret";
  const dataId = "123456";
  const xRequestId = "req-1";
  const ts = "1700000000";

  function sign(id = dataId, sec = secret): string {
    const manifest = `id:${id.toLowerCase()};request-id:${xRequestId};ts:${ts};`;
    return crypto.createHmac("sha256", sec).update(manifest).digest("hex");
  }

  it("acepta una firma válida", () => {
    const ok = verifyWebhookSignature({
      dataId,
      xSignature: `ts=${ts},v1=${sign()}`,
      xRequestId,
      secret,
    });
    expect(ok).toBe(true);
  });

  it("rechaza una firma con hash adulterado", () => {
    const ok = verifyWebhookSignature({
      dataId,
      xSignature: `ts=${ts},v1=${sign().replace(/.$/, "0")}`,
      xRequestId,
      secret,
    });
    expect(ok).toBe(false);
  });

  it("rechaza si falta el header x-signature", () => {
    expect(
      verifyWebhookSignature({
        dataId,
        xSignature: null,
        xRequestId,
        secret,
      }),
    ).toBe(false);
  });

  it("rechaza si el secret no coincide", () => {
    const ok = verifyWebhookSignature({
      dataId,
      xSignature: `ts=${ts},v1=${sign(dataId, "otro-secret")}`,
      xRequestId,
      secret,
    });
    expect(ok).toBe(false);
  });
});
