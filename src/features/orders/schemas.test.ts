import { describe, expect, it } from "vitest";
import { checkoutLineSchema, shippingAddressSchema } from "./schemas";

/**
 * El checkout es la puerta por la que entra la plata. Estos tests fijan el
 * contrato de la validación después del bug del 2026-08-03: un producto
 * multicolor de 8 colores hacía que el pedido ENTERO fuera rechazado con
 * "Revisá los datos del formulario", y nadie podía comprarlo.
 */

const linea = {
  productId: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  slug: "figura-de-messi",
  variantId: null,
  quantity: 1,
};

describe("checkoutLineSchema · color", () => {
  it("acepta un multicolor con muchos colores (el caso que rompía la compra)", () => {
    const color =
      "Blanco + Celeste + Dorado + Marron + Negro + Piel + verde kriptonita + Verde Manzana";
    expect(color.length).toBeGreaterThan(60); // el límite viejo
    expect(checkoutLineSchema.safeParse({ ...linea, color }).success).toBe(
      true,
    );
  });

  it("acepta color nulo (producto sin colores cargados)", () => {
    expect(
      checkoutLineSchema.safeParse({ ...linea, color: null }).success,
    ).toBe(true);
  });

  it("sigue rechazando un color absurdamente largo (tope 300)", () => {
    const color = "x".repeat(301);
    expect(checkoutLineSchema.safeParse({ ...linea, color }).success).toBe(
      false,
    );
  });

  it("rechaza cantidad cero o negativa", () => {
    expect(
      checkoutLineSchema.safeParse({ ...linea, quantity: 0 }).success,
    ).toBe(false);
  });
});

describe("shippingAddressSchema · lo que valida el formulario", () => {
  // El checkout valida campo por campo con ESTE schema: si estos mínimos
  // cambian, la pantalla cambia sola y no puede volver a divergir.
  const ok = {
    fullName: "Ana Perez",
    phone: "3757624148",
    street: "Av. Victoria Aguirre 320",
    city: "Puerto Iguazu",
    province: "Misiones",
    postalCode: "3370",
  };

  it("acepta una dirección completa", () => {
    expect(shippingAddressSchema.safeParse(ok).success).toBe(true);
  });

  it.each([
    ["fullName", "a"],
    ["phone", "12345"],
    ["street", "ab"],
    ["city", "x"],
    ["province", "y"],
    ["postalCode", "12"],
  ])("rechaza %s demasiado corto", (campo, valor) => {
    const r = shippingAddressSchema.safeParse({ ...ok, [campo]: valor });
    expect(r.success).toBe(false);
  });

  it("cada campo se puede validar por separado (lo que hace la pantalla)", () => {
    expect(shippingAddressSchema.shape.phone.safeParse("1").success).toBe(
      false,
    );
    expect(
      shippingAddressSchema.shape.phone.safeParse("3757624148").success,
    ).toBe(true);
  });
});
