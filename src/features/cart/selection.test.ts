import { describe, expect, it } from "vitest";
import {
  excluidasParaComprarSolo,
  leerSenal,
  lineKey,
  type LineaCarrito,
} from "./selection";

const linea = (
  productId: string,
  variantId: string | null = null,
  color: string | null = null,
): LineaCarrito => ({ productId, variantId, color });

describe("lineKey", () => {
  it("distingue el mismo producto en distinto tamaño o color", () => {
    expect(lineKey(linea("p1", "v1", "Rojo"))).not.toBe(
      lineKey(linea("p1", "v2", "Rojo")),
    );
    expect(lineKey(linea("p1", "v1", "Rojo"))).not.toBe(
      lineKey(linea("p1", "v1", "Azul")),
    );
  });

  it("null y ausencia de valor dan la misma clave", () => {
    expect(lineKey(linea("p1"))).toBe(lineKey(linea("p1", null, null)));
  });
});

describe('excluidasParaComprarSolo · "Comprar ahora"', () => {
  const carrito = [
    linea("p1"),
    linea("p2", "v1", "Dorado"),
    linea("p3", null, "Negro"),
  ];

  it("deja tildada SOLO la línea comprada", () => {
    const clave = lineKey(carrito[1]!);
    const fuera = excluidasParaComprarSolo(carrito, clave);
    expect(fuera.has(lineKey(carrito[0]!))).toBe(true);
    expect(fuera.has(lineKey(carrito[2]!))).toBe(true);
    expect(fuera.has(clave)).toBe(false);
  });

  it("sin señal no excluye nada (compra normal desde el carrito)", () => {
    expect(excluidasParaComprarSolo(carrito, null).size).toBe(0);
  });

  it("si la línea ya no está en el carrito NO deja el pedido vacío", () => {
    // Producto borrado o carrito vaciado en otra pestaña: mejor mostrar todo
    // que un checkout sin nada y sin explicación.
    const fuera = excluidasParaComprarSolo(carrito, "fantasma||");
    expect(fuera.size).toBe(0);
  });

  it("con un solo producto en el carrito no excluye nada", () => {
    const uno = [linea("p1")];
    expect(excluidasParaComprarSolo(uno, lineKey(uno[0]!)).size).toBe(0);
  });
});

describe("leerSenal · la señal vence", () => {
  const clave = "p1||";
  const guardada = (t: number) => JSON.stringify({ k: clave, t });

  it("vale si es reciente", () => {
    expect(leerSenal(guardada(1_000_000), 1_000_000 + 30_000)).toBe(clave);
  });

  it("NO vale pasados los 5 minutos", () => {
    // El caso real: tocó "Comprar ahora" sin sesión, no completó el login y
    // media hora después compró desde el carrito. Esa señal vieja no puede
    // destildarle el carrito entero.
    expect(leerSenal(guardada(1_000_000), 1_000_000 + 6 * 60_000)).toBeNull();
  });

  it("aguanta basura sin romper", () => {
    expect(leerSenal(null, 1)).toBeNull();
    expect(leerSenal("no es json", 1)).toBeNull();
    expect(leerSenal(JSON.stringify({ k: 123 }), 1)).toBeNull();
    expect(leerSenal(JSON.stringify({ k: "x" }), 1)).toBeNull();
  });
});
