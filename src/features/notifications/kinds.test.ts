import { describe, expect, it } from "vitest";
import type { ResolveInput } from "@/core/auth/perm-defs";
import { activeKinds, kindOf, kindPrefs, visibleKinds } from "./kinds";
import { pickPushTargets } from "./push";
import type { PushTarget } from "./repository";

const admin: ResolveInput = { enumRole: "admin", role: null };
// El operador del taller: responde consultas, maneja filamentos y arreglos.
const operador: ResolveInput = {
  enumRole: "operator",
  role: {
    isAdmin: false,
    permissions: {
      consultas: ["ver", "crear", "editar"],
      filamentos: ["ver", "crear", "editar"],
      arreglos: ["ver", "crear"],
      pedidos: ["ver"],
    },
  },
};
// Atención al cliente: carga consultas, no ve arreglos de filamento.
const atencion: ResolveInput = {
  enumRole: "operator",
  role: { isAdmin: false, permissions: { consultas: ["ver", "crear"] } },
};
const cliente: ResolveInput = { enumRole: "customer", role: null };

describe("visibleKinds", () => {
  it("el dueño ve todos los tipos", () => {
    expect(visibleKinds(admin)).toContain("calc_preset");
    expect(visibleKinds(admin)).toContain("inquiry");
    expect(visibleKinds(admin)).toContain("low_stock");
  });

  it("cada uno ve los avisos de los módulos que puede ver", () => {
    const op = visibleKinds(operador);
    expect(op).toEqual(
      expect.arrayContaining(["inquiry", "low_stock", "fix", "order", "other"]),
    );
    // Lo del dueño no le llega al operador.
    expect(op).not.toContain("calc_preset");

    const at = visibleKinds(atencion);
    expect(at).toContain("inquiry_answered");
    expect(at).not.toContain("low_stock");
    expect(at).not.toContain("order");
  });

  it("un cliente no ve avisos del panel", () => {
    expect(visibleKinds(cliente)).toEqual([]);
  });
});

describe("activeKinds / kindPrefs", () => {
  it("saca los tipos que la persona apagó", () => {
    expect(activeKinds(operador, ["low_stock"])).not.toContain("low_stock");
    expect(activeKinds(operador, ["low_stock"])).toContain("inquiry");
  });

  it("arma la lista de interruptores solo con lo que puede ver", () => {
    const prefs = kindPrefs(atencion, ["inquiry_answered"]);
    expect(prefs.map((p) => p.key)).not.toContain("low_stock");
    expect(prefs.find((p) => p.key === "inquiry")?.enabled).toBe(true);
    expect(prefs.find((p) => p.key === "inquiry_answered")?.enabled).toBe(
      false,
    );
  });
});

describe("kindOf", () => {
  it("un aviso viejo sin tipo, o con uno desconocido, es 'other'", () => {
    expect(kindOf(null)).toBe("other");
    expect(kindOf("algo-raro")).toBe("other");
    expect(kindOf("inquiry")).toBe("inquiry");
  });
});

describe("pickPushTargets · a qué dispositivos se manda", () => {
  const target = (
    profileId: string,
    over: Partial<PushTarget> = {},
  ): PushTarget => ({
    endpoint: `https://push.example/${profileId}`,
    p256dh: "k",
    auth: "a",
    profileId,
    enumRole: "operator",
    roleIsAdmin: false,
    rolePermissions: { consultas: ["ver", "editar"] },
    mutedKinds: null,
    ...over,
  });
  const ids = (list: PushTarget[]) => list.map((t) => t.profileId);

  it("consulta nueva: le llega a quien ve consultas, no a quien la cargó", () => {
    const targets = [
      target("agus"),
      target("anto"),
      target("sin-consultas", { rolePermissions: { filamentos: ["ver"] } }),
    ];
    expect(ids(pickPushTargets(targets, "inquiry", "anto"))).toEqual(["agus"]);
  });

  it("respeta lo que cada uno apagó", () => {
    const targets = [target("agus", { mutedKinds: ["inquiry"] }), target("x")];
    expect(ids(pickPushTargets(targets, "inquiry", null))).toEqual(["x"]);
  });

  it("el dueño recibe todo; un operador sin rol, nada", () => {
    const targets = [
      target("ale", {
        enumRole: "admin",
        roleIsAdmin: null,
        rolePermissions: null,
      }),
      target("sin-rol", { roleIsAdmin: null, rolePermissions: null }),
    ];
    expect(ids(pickPushTargets(targets, "calc_preset", null))).toEqual(["ale"]);
    expect(ids(pickPushTargets(targets, "low_stock", null))).toEqual(["ale"]);
  });
});
