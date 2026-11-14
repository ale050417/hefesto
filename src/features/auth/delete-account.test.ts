import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Baja de cuenta desde la app (`DELETE /api/v1/me`): reglas del flujo y de la
 * ruta. Todo con dobles — ni base ni Supabase.
 */

vi.mock("@/core/db", () => ({ db: {} }));
vi.mock("@/core/supabase/admin", () => ({ getSupabaseAdmin: vi.fn() }));

const getApiUser = vi.fn();
vi.mock("@/core/auth/api-auth", () => ({
  getApiUser: (...a: unknown[]) => getApiUser(...a),
  isApiStaff: (u: { profile?: { role?: string } } | null) =>
    u?.profile?.role === "admin" || u?.profile?.role === "operator",
}));
vi.mock("@/core/auth/permissions", () => ({
  canForUser: vi.fn(),
  getAllPermsForUser: vi.fn(async () => ({})),
  isAdminForUser: vi.fn(async () => false),
}));
const recordAudit = vi.fn();
vi.mock("@/core/audit", () => ({
  recordAudit: (...a: unknown[]) => recordAudit(...a),
}));

import { deleteOwnAccount, type DeleteAccountDeps } from "./delete-account";

function fakeDeps(over: Partial<DeleteAccountDeps> = {}) {
  const calls: string[] = [];
  const deps: DeleteAccountDeps = {
    countOrders: async () => {
      calls.push("count");
      return 0;
    },
    ensureTombstone: async () => {
      calls.push("tombstone");
      return "tomb-1";
    },
    moveOrders: async (from, to) => {
      calls.push(`move:${from}->${to}`);
    },
    deleteAuthUser: async (id) => {
      calls.push(`delete:${id}`);
      return { error: null };
    },
    ...over,
  };
  return { deps, calls };
}

describe("deleteOwnAccount", () => {
  it("cliente sin compras: borra el usuario y nada más", async () => {
    const { deps, calls } = fakeDeps();
    const r = await deleteOwnAccount({ id: "u1", role: "customer" }, deps);
    expect(r).toEqual({ ok: true, mode: "deleted" });
    expect(calls).toEqual(["count", "delete:u1"]);
  });

  it("cliente con compras: primero pasa los pedidos al perfil de sistema y después borra", async () => {
    const { deps, calls } = fakeDeps({ countOrders: async () => 3 });
    const r = await deleteOwnAccount({ id: "u1", role: "customer" }, deps);
    expect(r).toEqual({ ok: true, mode: "orders_kept" });
    expect(calls).toEqual(["tombstone", "move:u1->tomb-1", "delete:u1"]);
  });

  it.each(["admin", "operator"])(
    "una cuenta del equipo (%s) no se da de baja por acá y no toca nada",
    async (role) => {
      const { deps, calls } = fakeDeps();
      const r = await deleteOwnAccount({ id: "u1", role }, deps);
      expect(r).toEqual({ ok: false, reason: "staff" });
      expect(calls).toEqual([]);
    },
  );

  it("sin perfil (rol nulo) se trata como cliente", async () => {
    const { deps, calls } = fakeDeps();
    const r = await deleteOwnAccount({ id: "u1", role: null }, deps);
    expect(r.ok).toBe(true);
    expect(calls).toContain("delete:u1");
  });

  it("si Supabase no puede borrar el usuario, avisa que falló", async () => {
    const { deps } = fakeDeps({
      deleteAuthUser: async () => ({ error: "boom" }),
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await deleteOwnAccount({ id: "u1", role: "customer" }, deps);
    expect(r).toEqual({ ok: false, reason: "failed" });
    spy.mockRestore();
  });

  it("nunca mueve los pedidos al mismo usuario que se está borrando", async () => {
    const { deps, calls } = fakeDeps({
      countOrders: async () => 2,
      ensureTombstone: async () => "u1",
    });
    const r = await deleteOwnAccount({ id: "u1", role: "customer" }, deps);
    expect(r).toEqual({ ok: false, reason: "failed" });
    expect(calls.some((c) => c.startsWith("move"))).toBe(false);
    expect(calls.some((c) => c.startsWith("delete"))).toBe(false);
  });

  it("si falla al mover los pedidos, NO borra el usuario (se puede reintentar)", async () => {
    const { deps, calls } = fakeDeps({
      countOrders: async () => 1,
      moveOrders: async () => {
        throw new Error("db caída");
      },
    });
    await expect(
      deleteOwnAccount({ id: "u1", role: "customer" }, deps),
    ).rejects.toThrow("db caída");
    expect(calls.some((c) => c.startsWith("delete"))).toBe(false);
  });
});

describe("DELETE /api/v1/me", () => {
  const flow = vi.hoisted(() => ({ deleteOwnAccount: vi.fn() }));

  beforeEach(() => {
    vi.resetModules();
    getApiUser.mockReset();
    recordAudit.mockReset();
    flow.deleteOwnAccount.mockReset();
    vi.doMock("@/features/auth/delete-account", () => flow);
  });

  async function call() {
    const { DELETE } = await import("@/app/api/v1/me/route");
    return DELETE(
      new Request("http://localhost/api/v1/me", {
        method: "DELETE",
        headers: { authorization: "Bearer t" },
      }),
    );
  }

  it("sin sesión responde 401 y no borra nada", async () => {
    getApiUser.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(401);
    expect(flow.deleteOwnAccount).not.toHaveBeenCalled();
  });

  it("borra SOLO la cuenta del token (no acepta ids por parámetro) y deja registro", async () => {
    getApiUser.mockResolvedValue({
      id: "u1",
      email: "c@x.com",
      profile: { role: "customer" },
      profileUnavailable: false,
    });
    flow.deleteOwnAccount.mockResolvedValue({ ok: true, mode: "deleted" });
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(flow.deleteOwnAccount).toHaveBeenCalledWith({
      id: "u1",
      role: "customer",
    });
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "account.deleted",
        actorId: null,
        entityId: "u1",
        metadata: { ordersKept: false },
      }),
    );
  });

  it("una cuenta del equipo recibe 403 con la explicación", async () => {
    getApiUser.mockResolvedValue({
      id: "a1",
      email: "a@x.com",
      profile: { role: "admin" },
      profileUnavailable: false,
    });
    flow.deleteOwnAccount.mockResolvedValue({ ok: false, reason: "staff" });
    const res = await call();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("forbidden");
    expect(body.error.message).toContain("administrador");
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("si no se pudo leer el perfil no borra a ciegas (503)", async () => {
    getApiUser.mockResolvedValue({
      id: "u1",
      email: null,
      profile: null,
      profileUnavailable: true,
    });
    const res = await call();
    expect(res.status).toBe(503);
    expect(flow.deleteOwnAccount).not.toHaveBeenCalled();
  });

  it("si el borrado falla responde 503 y no registra la baja", async () => {
    getApiUser.mockResolvedValue({
      id: "u1",
      email: "c@x.com",
      profile: { role: "customer" },
      profileUnavailable: false,
    });
    flow.deleteOwnAccount.mockResolvedValue({ ok: false, reason: "failed" });
    const res = await call();
    expect(res.status).toBe(503);
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("un error inesperado no filtra detalles al cliente", async () => {
    getApiUser.mockResolvedValue({
      id: "u1",
      email: "c@x.com",
      profile: { role: "customer" },
      profileUnavailable: false,
    });
    flow.deleteOwnAccount.mockRejectedValue(new Error("secreto interno"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call();
    spy.mockRestore();
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain("secreto interno");
  });
});
