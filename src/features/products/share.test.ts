import { describe, expect, it } from "vitest";
import { productShareLink, productShareText, whatsappShareUrl } from "./share";

describe("compartir producto", () => {
  it("arma el link público sin duplicar la barra", () => {
    expect(productShareLink("https://hefesto3d.com.ar/", "huevo-dragon")).toBe(
      "https://hefesto3d.com.ar/producto/huevo-dragon",
    );
    expect(productShareLink("https://hefesto3d.com.ar", "huevo-dragon")).toBe(
      "https://hefesto3d.com.ar/producto/huevo-dragon",
    );
  });

  it("el mensaje lleva nombre, precio y link; sin precio, nombre y link", () => {
    const link = "https://hefesto3d.com.ar/producto/huevo-dragon";
    expect(
      productShareText({ name: "Huevo de dragón", link, price: "$8.500" }),
    ).toBe(`Huevo de dragón — $8.500\n${link}`);
    expect(productShareText({ name: "Huevo de dragón", link })).toBe(
      `Huevo de dragón\n${link}`,
    );
  });

  it("el link de WhatsApp no lleva número y codifica el mensaje", () => {
    expect(whatsappShareUrl("Huevo & más\nlink")).toBe(
      "https://wa.me/?text=Huevo%20%26%20m%C3%A1s%0Alink",
    );
  });
});
