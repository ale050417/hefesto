import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildPreferenceBody,
  isLocalUrl,
  verifyWebhookSignature,
} from "./mercadopago";

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

  it("incluye back_urls, auto_return y notification_url (URL pública)", () => {
    const body = buildPreferenceBody(base);
    expect(body.back_urls.success).toContain("/checkout/exito");
    expect(body.auto_return).toBe("approved");
    expect(body.notification_url).toBe(
      "https://hefesto.test/api/webhooks/mercadopago",
    );
  });

  it("OMITE auto_return y notification_url cuando la URL es localhost (dev)", () => {
    // MP rechaza la preferencia si mandamos auto_return / notification_url con
    // URLs no públicas (localhost). En dev las omitimos para no romper.
    const body = buildPreferenceBody({
      ...base,
      backUrls: {
        success: "http://localhost:3000/checkout/exito?pedido=HEF-1",
        failure: "http://localhost:3000/checkout?pago=fallido",
        pending: "http://localhost:3000/checkout/exito?pedido=HEF-1",
      },
      notificationUrl: "http://localhost:3000/api/webhooks/mercadopago",
    });
    expect(body).not.toHaveProperty("auto_return");
    expect(body).not.toHaveProperty("notification_url");
    // el resto del cuerpo sigue intacto
    expect(body.back_urls.success).toContain("localhost");
    expect(body.external_reference).toBe("order-1");
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

describe("isLocalUrl", () => {
  it("detecta localhost y loopback como no públicas", () => {
    expect(isLocalUrl("http://localhost:3000/x")).toBe(true);
    expect(isLocalUrl("http://127.0.0.1:3000/x")).toBe(true);
    expect(isLocalUrl("http://0.0.0.0/x")).toBe(true);
    expect(isLocalUrl("http://mi-pc.local/x")).toBe(true);
  });

  it("trata un dominio real como público", () => {
    expect(isLocalUrl("https://hefesto3d.com/checkout/exito")).toBe(false);
    expect(isLocalUrl("https://www.hefesto.test/x")).toBe(false);
  });

  it("ante una URL inválida no arriesga (la trata como local)", () => {
    expect(isLocalUrl("no-es-una-url")).toBe(true);
    expect(isLocalUrl("")).toBe(true);
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
