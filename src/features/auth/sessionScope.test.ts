import { describe, expect, it } from "vitest";
import { decidirSesion } from "./sessionScope";

describe("decidirSesion · a quién le pertenece el carrito", () => {
  it("mismo usuario: no toca nada", () => {
    expect(decidirSesion("u1", "u1")).toBe("nada");
  });

  it("visitante sin sesión que sigue sin sesión: conserva su carrito", () => {
    expect(decidirSesion(null, null)).toBe("nada");
    expect(decidirSesion("", null)).toBe("nada");
  });

  it("armó el carrito sin cuenta y después inicia sesión: lo adopta", () => {
    // Borrárselo justo al loguearse sería perder la compra que venía armando.
    expect(decidirSesion(null, "u1")).toBe("adoptar");
  });

  it("cerró sesión: limpia", () => {
    expect(decidirSesion("u1", null)).toBe("limpiar");
  });

  it("si NO se pudo verificar la sesión, no toca nada", () => {
    // Supabase caído o token sin refrescar: el servidor no sabe. Tratarlo como
    // "cerró sesión" le borraría el carrito a alguien que sigue logueado.
    expect(decidirSesion("u1", undefined)).toBe("nada");
    expect(decidirSesion(null, undefined)).toBe("nada");
  });

  it("entra OTRA persona en la misma compu: limpia", () => {
    // El caso del mostrador o la compu compartida: nadie tiene que ver el
    // carrito ni los favoritos del anterior.
    expect(decidirSesion("u1", "u2")).toBe("limpiar");
  });
});
