import { describe, expect, it } from "vitest";
import { findZone, quoteShipping, toShippingAddress } from "./shipping";
import type { ShippingConfig } from "./shipping";
import type { Delivery } from "./schemas";

/**
 * Estos tests protegen PLATA: el costo del envío entra al total que paga el
 * cliente. Si el cálculo se rompe, se cobra de menos (pérdida) o de más
 * (reclamo). Por eso van desde el primer día (Cap. 15).
 */

const config: ShippingConfig = {
  city: "Puerto Iguazú",
  freeOver: 0,
  zones: [
    { name: "San Lucas", price: 1000 },
    { name: "Centro", price: 700 },
    { name: "Villa Nueva", price: 1500 },
  ],
};

const quien = { fullName: "Ana Perez", phone: "3757624148" };

describe("quoteShipping", () => {
  it("retiro en el local: gratis", () => {
    const d: Delivery = { type: "pickup", ...quien };
    const q = quoteShipping(d, config, 20000);
    expect(q.cost).toBe(0);
    expect(q.label).toBe("Retiro en el local");
  });

  it("envío local: cobra el precio del barrio elegido", () => {
    const d: Delivery = {
      type: "local",
      ...quien,
      zone: "San Lucas",
      street: "Los Lapachos 123",
    };
    expect(quoteShipping(d, config, 20000).cost).toBe(1000);
  });

  it("el barrio se reconoce sin importar acentos ni mayúsculas", () => {
    const d: Delivery = {
      type: "local",
      ...quien,
      zone: "  sán lúcas ",
      street: "Los Lapachos 123",
    };
    expect(quoteShipping(d, config, 20000).cost).toBe(1000);
  });

  it("barrio inexistente: RECHAZA (no cobra 0 en silencio)", () => {
    const d: Delivery = {
      type: "local",
      ...quien,
      zone: "Barrio Fantasma",
      street: "Los Lapachos 123",
    };
    expect(() => quoteShipping(d, config, 20000)).toThrow(/no está disponible/);
  });

  it("envío gratis a partir del mínimo configurado", () => {
    const cfg = { ...config, freeOver: 30000 };
    const d: Delivery = {
      type: "local",
      ...quien,
      zone: "Villa Nueva",
      street: "Los Lapachos 123",
    };
    expect(quoteShipping(d, cfg, 29999).cost).toBe(1500);
    const gratis = quoteShipping(d, cfg, 30000);
    expect(gratis.cost).toBe(0);
    expect(gratis.free).toBe(true);
  });

  it("freeOver en 0 significa desactivado (no regala envíos)", () => {
    const d: Delivery = {
      type: "local",
      ...quien,
      zone: "Centro",
      street: "Los Lapachos 123",
    };
    expect(quoteShipping(d, config, 999999).cost).toBe(700);
  });

  it("resto del país: no se cobra acá (lo paga el comprador al correo)", () => {
    const d: Delivery = {
      type: "national",
      ...quien,
      street: "Corrientes 1234",
      city: "Rosario",
      province: "Santa Fe",
      postalCode: "2000",
    };
    expect(quoteShipping(d, config, 20000).cost).toBe(0);
  });
});

describe("findZone", () => {
  it("devuelve null si no está", () => {
    expect(findZone(config.zones, "Nada")).toBeNull();
  });
});

describe("toShippingAddress", () => {
  it("retiro: la ciudad sale de la config, no del cliente", () => {
    const a = toShippingAddress({ type: "pickup", ...quien }, config);
    expect(a.city).toBe("Puerto Iguazú");
    expect(a.street).toBe("Retiro en el local");
    expect(a.deliveryType).toBe("pickup");
    expect(a.province).toBeUndefined();
  });

  it("local: guarda el barrio y completa la ciudad solo", () => {
    const a = toShippingAddress(
      {
        type: "local",
        ...quien,
        zone: "San Lucas",
        street: "Los Lapachos 123",
      },
      config,
    );
    expect(a.zone).toBe("San Lucas");
    expect(a.city).toBe("Puerto Iguazú");
    expect(a.street).toBe("Los Lapachos 123");
  });

  it("resto del país: respeta lo que cargó el cliente", () => {
    const a = toShippingAddress(
      {
        type: "national",
        ...quien,
        street: "Corrientes 1234",
        city: "Rosario",
        province: "Santa Fe",
        postalCode: "2000",
      },
      config,
    );
    expect(a.city).toBe("Rosario");
    expect(a.province).toBe("Santa Fe");
    expect(a.postalCode).toBe("2000");
  });
});
