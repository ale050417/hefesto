import { describe, expect, it } from "vitest";
import { resolveAllowed } from "./perm-defs";

describe("resolveAllowed", () => {
  it("admin (enum) siempre puede todo", () => {
    expect(
      resolveAllowed({ enumRole: "admin", role: null }, "config", "eliminar"),
    ).toBe(true);
    expect(
      resolveAllowed({ enumRole: "admin", role: null }, "pedidos", "crear"),
    ).toBe(true);
  });

  it("customer / sin sesión no puede nada", () => {
    expect(
      resolveAllowed({ enumRole: "customer", role: null }, "pedidos", "ver"),
    ).toBe(false);
    expect(
      resolveAllowed({ enumRole: null, role: null }, "pedidos", "ver"),
    ).toBe(false);
  });

  it("operador SIN rol custom no tiene permisos (deny-by-default)", () => {
    const u = { enumRole: "operator" as const, role: null };
    expect(resolveAllowed(u, "pedidos", "ver")).toBe(false);
    expect(resolveAllowed(u, "productos", "eliminar")).toBe(false);
    expect(resolveAllowed(u, "reportes", "ver")).toBe(false);
  });

  it("operador con rol custom: respeta su matriz", () => {
    const u = {
      enumRole: "operator" as const,
      role: {
        isAdmin: false,
        permissions: { pedidos: ["ver"], clientes: ["ver", "editar"] },
      },
    };
    expect(resolveAllowed(u, "pedidos", "ver")).toBe(true);
    expect(resolveAllowed(u, "pedidos", "editar")).toBe(false); // no tiene editar
    expect(resolveAllowed(u, "clientes", "editar")).toBe(true);
    expect(resolveAllowed(u, "productos", "ver")).toBe(false); // módulo no listado
    expect(resolveAllowed(u, "config", "ver")).toBe(false);
  });

  it("rol custom con isAdmin = acceso total aunque sea operator", () => {
    const u = {
      enumRole: "operator" as const,
      role: { isAdmin: true, permissions: {} },
    };
    expect(resolveAllowed(u, "config", "eliminar")).toBe(true);
  });
});
