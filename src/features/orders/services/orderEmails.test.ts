import { describe, expect, it } from "vitest";
import { buildOrderStatusEmail } from "./orderEmails";

describe("buildOrderStatusEmail", () => {
  it("incluye el número de pedido y la etiqueta del estado en el asunto", () => {
    const { subject } = buildOrderStatusEmail({
      orderNumber: "HEF-ABC",
      status: "shipped",
    });
    expect(subject).toContain("HEF-ABC");
    expect(subject).toContain("Enviado");
  });

  it("el html muestra la etiqueta del estado", () => {
    const { html } = buildOrderStatusEmail({
      orderNumber: "HEF-1",
      status: "confirmed",
    });
    expect(html).toContain("Pago confirmado");
  });
});
