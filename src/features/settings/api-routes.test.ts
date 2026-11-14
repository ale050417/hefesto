import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Rutas de la app móvil (Configuración y Auditoría): autorización, validación y
 * efectos (revalidación, auditoría). Todo con dobles — ni base ni red.
 */

const getApiUser = vi.fn();
const canForUser = vi.fn();
vi.mock("@/core/auth/api-auth", () => ({
  getApiUser: (...a: unknown[]) => getApiUser(...a),
  isApiStaff: (u: { profile?: { role?: string } } | null) =>
    u?.profile?.role === "admin" || u?.profile?.role === "operator",
}));
vi.mock("@/core/auth/permissions", () => ({
  canForUser: (...a: unknown[]) => canForUser(...a),
  isAdminForUser: vi.fn(),
}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
  unstable_cache: (fn: unknown) => fn,
}));

const recordAudit = vi.fn();
vi.mock("@/core/audit", () => ({
  recordAudit: (...a: unknown[]) => recordAudit(...a),
}));
vi.mock("@/core/db", () => ({ db: {} }));

const queryAuditPage = vi.fn();
const getAuditFacets = vi.fn();
const getAuditEntry = vi.fn();
vi.mock("@/core/audit/query", async (orig) => ({
  ...(await orig<typeof import("@/core/audit/query")>()),
  queryAuditPage: (...a: unknown[]) => queryAuditPage(...a),
  getAuditFacets: (...a: unknown[]) => getAuditFacets(...a),
  getAuditEntry: (...a: unknown[]) => getAuditEntry(...a),
}));

const svc = vi.hoisted(() => ({
  saveBusinessInfo: vi.fn(),
  saveShippingSettings: vi.fn(),
  getPaymentSettings: vi.fn(),
  savePaymentSettings: vi.fn(),
  saveMpAccessToken: vi.fn(),
  saveAppearance: vi.fn(),
  getAllBanners: vi.fn(),
  updateBanner: vi.fn(),
  deleteBanner: vi.fn(),
  inviteTeamMember: vi.fn(),
  resendTeamInvite: vi.fn(),
  assignMemberRole: vi.fn(),
  removeTeamMember: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
}));
vi.mock("@/features/settings/service", () => svc);

const getSettingsStrict = vi.fn();
vi.mock("@/features/settings/repository", () => ({
  getSettingsStrict: (...a: unknown[]) => getSettingsStrict(...a),
}));
const saveQuoteDefaults = vi.fn();
vi.mock("@/features/quotes/service", () => ({
  saveQuoteDefaults: (...a: unknown[]) => saveQuoteDefaults(...a),
}));

import { AppError } from "@/core/errors";
import { GET as auditList } from "@/app/api/v1/admin/auditoria/route";
import { GET as auditDetail } from "@/app/api/v1/admin/auditoria/[id]/route";
import { PATCH as negocioPatch } from "@/app/api/v1/admin/configuracion/negocio/route";
import { PUT as enviosPut } from "@/app/api/v1/admin/configuracion/envios/route";
import { PUT as pagosPut } from "@/app/api/v1/admin/configuracion/pagos/route";
import {
  DELETE as mpDelete,
  PUT as mpPut,
} from "@/app/api/v1/admin/configuracion/pagos/mercadopago/route";
import { PATCH as tiendaPatch } from "@/app/api/v1/admin/configuracion/tienda/route";
import { PATCH as textosPatch } from "@/app/api/v1/admin/configuracion/textos/route";
import { PUT as cotizacionPut } from "@/app/api/v1/admin/configuracion/cotizacion/route";
import {
  DELETE as bannerDelete,
  PATCH as bannerPatch,
} from "@/app/api/v1/admin/configuracion/banners/[id]/route";
import { POST as equipoInvite } from "@/app/api/v1/admin/configuracion/equipo/route";
import {
  DELETE as equipoRemove,
  PATCH as equipoRole,
} from "@/app/api/v1/admin/configuracion/equipo/[id]/route";
import { POST as equipoResend } from "@/app/api/v1/admin/configuracion/equipo/[id]/reenviar/route";
import { POST as rolCreate } from "@/app/api/v1/admin/configuracion/roles/route";
import {
  DELETE as rolDelete,
  PATCH as rolUpdate,
} from "@/app/api/v1/admin/configuracion/roles/[id]/route";

const UUID = "11111111-1111-4111-8111-111111111111";
const UUID2 = "22222222-2222-4222-8222-222222222222";

const admin = {
  id: "a1",
  email: "a@x.com",
  profile: { role: "admin" },
  profileUnavailable: false,
};
const operator = {
  id: "o1",
  email: "o@x.com",
  profile: { role: "operator" },
  profileUnavailable: false,
};

function req(body?: unknown, url = "http://localhost/api/v1/x") {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer t" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = (id = UUID) => ({ params: Promise.resolve({ id }) });
type Body = {
  error: { code: string; message: string };
  items: unknown[];
  facets?: unknown;
  [k: string]: unknown;
};
const json = async (res: Response) => (await res.json()) as Body;

/** Quién llama y qué permisos tiene (por defecto, todos los de `allow`). */
function as(user: unknown, allow: string[] = []) {
  getApiUser.mockResolvedValue(user);
  // Como el real: el rol admin puede todo; el resto, solo lo que tenga marcado.
  canForUser.mockImplementation(
    async (u: { profile?: { role?: string } }, m: string, a: string) =>
      u?.profile?.role === "admin" || allow.includes(`${m}:${a}`),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getSettingsStrict.mockResolvedValue({ homeSections: { faq: false } });
  svc.getAllBanners.mockResolvedValue([{ id: UUID, title: "Hola" }]);
  svc.getPaymentSettings.mockResolvedValue({
    transferEnabled: true,
    transferAlias: "viejo.alias",
    transferCbu: "123",
    mpEnabled: true,
    mpNote: null,
    mpAccessToken: "APP_USR-token-secreto-1234",
    cashEnabled: true,
    cashNote: "Solo retiro",
  });
});

describe("autorización común", () => {
  it("sin sesión → 401", async () => {
    getApiUser.mockResolvedValue(null);
    const res = await negocioPatch(req({ slogan: "x" }));
    expect(res.status).toBe(401);
    expect((await json(res)).error.code).toBe("unauthorized");
  });

  it("un cliente (sin acceso al panel) → 403", async () => {
    as({ id: "c1", profile: { role: "customer" }, profileUnavailable: false });
    expect((await negocioPatch(req({ slogan: "x" }))).status).toBe(403);
  });

  it("operador sin config/editar → 403 y no toca nada", async () => {
    as(operator, ["config:ver"]);
    const res = await negocioPatch(req({ slogan: "x" }));
    expect(res.status).toBe(403);
    expect(svc.saveBusinessInfo).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("PATCH negocio", () => {
  it("guarda solo lo enviado, '' borra, tiktok va a la columna facebook y revalida la tienda", async () => {
    as(operator, ["config:editar"]);
    const res = await negocioPatch(
      req({ slogan: "Forjado en capas", instagram: "", tiktok: "@h3d" }),
    );
    expect(res.status).toBe(200);
    expect(svc.saveBusinessInfo).toHaveBeenCalledWith({
      slogan: "Forjado en capas",
      instagram: null,
      facebook: "@h3d",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/configuracion");
  });

  it("nombre vacío → 422 con el mensaje en castellano", async () => {
    as(admin);
    const res = await negocioPatch(req({ storeName: " " }));
    expect(res.status).toBe(422);
    expect((await json(res)).error.message).toBe(
      "Ingresá el nombre del negocio.",
    );
    expect(svc.saveBusinessInfo).not.toHaveBeenCalled();
  });

  it("cuerpo vacío → 422 'nada para guardar'", async () => {
    as(admin);
    const res = await negocioPatch(req({}));
    expect(res.status).toBe(422);
    expect(svc.saveBusinessInfo).not.toHaveBeenCalled();
  });

  it("un JSON roto no explota", async () => {
    as(admin);
    const bad = new Request("http://localhost/x", {
      method: "PATCH",
      headers: { authorization: "Bearer t" },
      body: "{no es json",
    });
    expect((await negocioPatch(bad)).status).toBe(422);
  });
});

describe("PUT envíos", () => {
  const body = {
    city: "Iguazú",
    freeOver: 30000,
    outMsg: "",
    zones: [
      { name: "Centro", price: 1500 },
      { name: "   ", price: 99 },
    ],
  };

  it("descarta barrios sin nombre y NO toca retiro/envío si no vienen", async () => {
    as(admin);
    const res = await enviosPut(req(body));
    expect(res.status).toBe(200);
    expect(svc.saveShippingSettings).toHaveBeenCalledWith({
      city: "Iguazú",
      freeOver: 30000,
      outMsg: null,
      zones: [{ name: "Centro", price: 1500 }],
    });
    expect(svc.saveBusinessInfo).not.toHaveBeenCalled();
  });

  it("con switches, los guarda en business_settings y revalida la tienda", async () => {
    as(admin);
    await enviosPut(req({ ...body, pickupEnabled: false }));
    expect(svc.saveBusinessInfo).toHaveBeenCalledWith({ pickupEnabled: false });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});

describe("PUT pagos y MercadoPago", () => {
  it("lo que no viene queda como estaba (merge con lo guardado)", async () => {
    as(admin);
    await pagosPut(req({ transferAlias: "nuevo.alias", cashEnabled: false }));
    expect(svc.savePaymentSettings).toHaveBeenCalledWith({
      transferEnabled: true,
      transferAlias: "nuevo.alias",
      transferCbu: "123",
      mpEnabled: true,
      mpNote: null,
      cashEnabled: false,
      cashNote: "Solo retiro",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/configuracion");
  });

  it("conectar MercadoPago: guarda el token, revalida el checkout y NO lo devuelve", async () => {
    as(admin);
    const res = await mpPut(req({ token: "APP_USR-123456789012345" }));
    expect(res.status).toBe(200);
    expect(svc.saveMpAccessToken).toHaveBeenCalledWith(
      "APP_USR-123456789012345",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/checkout");
    const text = JSON.stringify(await json(res));
    expect(text).not.toContain("APP_USR");
    expect(text).toContain("mpConnected");
  });

  it("un token muy corto → 422", async () => {
    as(admin);
    expect((await mpPut(req({ token: "abc" }))).status).toBe(422);
    expect(svc.saveMpAccessToken).not.toHaveBeenCalled();
  });

  it("desconectar guarda null", async () => {
    as(admin);
    const res = await mpDelete(req());
    expect(res.status).toBe(200);
    expect(svc.saveMpAccessToken).toHaveBeenCalledWith(null);
  });
});

describe("PATCH tienda", () => {
  it("mezcla las secciones del home sobre lo guardado y descarta claves inventadas", async () => {
    as(admin);
    const res = await tiendaPatch(
      req({
        businessMode: "vidriera",
        accentColor: "",
        season: "navidad",
        homeSections: { stats: false, inventada: true },
      }),
    );
    expect(res.status).toBe(200);
    expect(svc.saveAppearance).toHaveBeenCalledWith({
      businessMode: "vidriera",
      accentColor: null,
      season: "navidad",
      homeSections: { faq: false, stats: false },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("segundos entre banners fuera de 3-12 → 422", async () => {
    as(admin);
    expect((await tiendaPatch(req({ bannerIntervalSec: 30 }))).status).toBe(
      422,
    );
    expect(svc.saveAppearance).not.toHaveBeenCalled();
  });
});

describe("PATCH textos y PUT cotización", () => {
  it("guarda la FAQ y revalida la tienda", async () => {
    as(admin);
    await textosPatch(req({ faq: [{ q: "¿Envían?", a: "Sí." }] }));
    expect(svc.saveAppearance).toHaveBeenCalledWith({
      faq: [{ q: "¿Envían?", a: "Sí." }],
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("la cotización la puede guardar quien edita pedidos, aunque no tenga config/editar", async () => {
    as(operator, ["pedidos:editar"]);
    const res = await cotizacionPut(
      req({
        title: "COTIZACIÓN",
        depositPct: 40,
        depositText: "Seña.",
        notes: [],
      }),
    );
    expect(res.status).toBe(200);
    expect(saveQuoteDefaults).toHaveBeenCalledOnce();
  });

  it("sin productos/pedidos editar → 403", async () => {
    as(operator, ["config:editar"]);
    const res = await cotizacionPut(
      req({ title: "COTIZACIÓN", depositPct: 40, depositText: "", notes: [] }),
    );
    expect(res.status).toBe(403);
    expect(saveQuoteDefaults).not.toHaveBeenCalled();
  });
});

describe("banners", () => {
  it("edita parcialmente y '' deja el campo en null", async () => {
    as(admin);
    const res = await bannerPatch(
      req({ isActive: false, subtitle: "" }),
      ctx(),
    );
    expect(res.status).toBe(200);
    expect(svc.updateBanner).toHaveBeenCalledWith(UUID, {
      isActive: false,
      subtitle: null,
    });
  });

  it("un banner que no existe → 404", async () => {
    as(admin);
    const res = await bannerPatch(req({ isActive: false }), ctx(UUID2));
    expect(res.status).toBe(404);
    expect(svc.updateBanner).not.toHaveBeenCalled();
  });

  it("título vacío → 422; id inválido → 422", async () => {
    as(admin);
    expect((await bannerPatch(req({ title: " " }), ctx())).status).toBe(422);
    expect(
      (await bannerPatch(req({ isActive: true }), ctx("nope"))).status,
    ).toBe(422);
  });

  it("borrar", async () => {
    as(admin);
    expect((await bannerDelete(req(), ctx())).status).toBe(200);
    expect(svc.deleteBanner).toHaveBeenCalledWith(UUID);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});

describe("equipo y roles: SOLO administradores", () => {
  const deniedCases: Array<[string, () => Promise<Response>]> = [
    ["invitar", () => equipoInvite(req({ email: "a@b.com", roleId: UUID }))],
    ["cambiar rol", () => equipoRole(req({ roleId: UUID2 }), ctx())],
    ["quitar acceso", () => equipoRemove(req(), ctx())],
    ["reenviar invitación", () => equipoResend(req(), ctx())],
    ["crear rol", () => rolCreate(req({ name: "Ventas", permissions: {} }))],
    [
      "editar rol",
      () => rolUpdate(req({ name: "Ventas", permissions: {} }), ctx()),
    ],
    ["borrar rol", () => rolDelete(req(), ctx())],
  ];

  it.each(deniedCases)(
    "un operador con config/editar NO puede %s",
    async (_n, call) => {
      as(operator, ["config:ver", "config:editar"]);
      const res = await call();
      expect(res.status).toBe(403);
      expect(svc.inviteTeamMember).not.toHaveBeenCalled();
      expect(svc.assignMemberRole).not.toHaveBeenCalled();
      expect(svc.removeTeamMember).not.toHaveBeenCalled();
      expect(svc.createRole).not.toHaveBeenCalled();
      expect(svc.deleteRole).not.toHaveBeenCalled();
    },
  );

  it("invitar: manda la invitación y deja el evento en la auditoría", async () => {
    as(admin);
    svc.inviteTeamMember.mockResolvedValue({
      email: "nuevo@x.com",
      promoted: false,
    });
    const res = await equipoInvite(
      req({
        email: "nuevo@x.com",
        roleId: UUID,
        fullName: "Nuevo",
        message: "",
      }),
    );
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({
      ok: true,
      email: "nuevo@x.com",
      promoted: false,
    });
    expect(svc.inviteTeamMember).toHaveBeenCalledWith({
      email: "nuevo@x.com",
      roleId: UUID,
      fullName: "Nuevo",
      message: null,
    });
    expect(recordAudit).toHaveBeenCalledWith({
      actorId: "a1",
      action: "team.member_invited",
      entityType: "team",
      entityId: "nuevo@x.com",
      metadata: { roleId: UUID },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/configuracion");
  });

  it("invitar a un cliente existente lo registra como promoción", async () => {
    as(admin);
    svc.inviteTeamMember.mockResolvedValue({
      email: "cli@x.com",
      promoted: true,
    });
    await equipoInvite(req({ email: "cli@x.com", roleId: UUID }));
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "team.member_promoted" }),
    );
  });

  it("un error de negocio vuelve como 422 con su mensaje", async () => {
    as(admin);
    svc.inviteTeamMember.mockRejectedValue(
      new AppError("VALIDATION", "Ese email ya es parte del equipo."),
    );
    const res = await equipoInvite(req({ email: "a@b.com", roleId: UUID }));
    expect(res.status).toBe(422);
    expect((await json(res)).error.message).toBe(
      "Ese email ya es parte del equipo.",
    );
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("un error inesperado NO filtra detalles (503 genérico)", async () => {
    as(admin);
    svc.inviteTeamMember.mockRejectedValue(
      new Error("connection string postgres://secreto"),
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await equipoInvite(req({ email: "a@b.com", roleId: UUID }));
    spy.mockRestore();
    expect(res.status).toBe(503);
    expect(JSON.stringify(await json(res))).not.toContain("postgres");
  });

  it("cambiar rol: pasa quién actúa; 'no podés cambiar tu propio rol' llega como 422", async () => {
    as(admin);
    svc.assignMemberRole.mockRejectedValue(
      new AppError("VALIDATION", "No podés cambiar tu propio rol."),
    );
    const res = await equipoRole(
      req({ roleId: UUID2 }),
      ctx("a1000000-0000-4000-8000-000000000001"),
    );
    expect(svc.assignMemberRole).toHaveBeenCalledWith(
      "a1",
      "a1000000-0000-4000-8000-000000000001",
      UUID2,
    );
    expect(res.status).toBe(422);
    expect((await json(res)).error.message).toBe(
      "No podés cambiar tu propio rol.",
    );
  });

  it("quitar acceso y reenviar invitación", async () => {
    as(admin);
    expect((await equipoRemove(req(), ctx())).status).toBe(200);
    expect(svc.removeTeamMember).toHaveBeenCalledWith("a1", UUID);

    svc.resendTeamInvite.mockResolvedValue({ email: "x@y.com" });
    const res = await equipoResend(req(), ctx());
    expect(await json(res)).toMatchObject({ ok: true, email: "x@y.com" });
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "team.invite_resent",
        entityId: "x@y.com",
      }),
    );
  });

  it("crear rol: sanea permisos desconocidos; editar y borrar usan el id", async () => {
    as(admin);
    await rolCreate(
      req({
        name: "Ventas",
        permissions: { pedidos: ["ver", "volar"], inventado: ["ver"] },
      }),
    );
    expect(svc.createRole).toHaveBeenCalledWith({
      name: "Ventas",
      permissions: { pedidos: ["ver"] },
    });

    await rolUpdate(
      req({ name: "Ventas 2", permissions: { auditoria: ["ver"] } }),
      ctx(),
    );
    expect(svc.updateRole).toHaveBeenCalledWith(UUID, {
      name: "Ventas 2",
      permissions: { auditoria: ["ver"] },
    });

    svc.deleteRole.mockRejectedValue(
      new AppError(
        "VALIDATION",
        "No se puede borrar: 2 personas lo tienen asignado.",
      ),
    );
    const res = await rolDelete(req(), ctx());
    expect(res.status).toBe(422);
    expect((await json(res)).error.message).toContain("No se puede borrar");
  });
});

describe("auditoría", () => {
  const entry = { id: UUID, action: "order.status_changed" };

  it("exige auditoria/ver", async () => {
    as(operator, ["config:ver"]);
    expect(
      (
        await auditList(
          req(undefined, "http://localhost/api/v1/admin/auditoria"),
        )
      ).status,
    ).toBe(403);
    expect(queryAuditPage).not.toHaveBeenCalled();
  });

  it("lista paginada: pasa los filtros saneados y devuelve hasMore", async () => {
    as(operator, ["auditoria:ver"]);
    queryAuditPage.mockResolvedValue({ items: [entry], hasMore: true });
    const res = await auditList(
      req(
        undefined,
        `http://localhost/api/v1/admin/auditoria?q=mate&entity=order&actor=${UUID}&page=2&pageSize=10`,
      ),
    );
    expect(res.status).toBe(200);
    const [filters, page, pageSize] = queryAuditPage.mock.calls[0]!;
    expect(filters).toMatchObject({
      q: "mate",
      entityType: "order",
      actor: UUID,
    });
    expect([page, pageSize]).toEqual([2, 10]);
    const body = await json(res);
    expect(body).toMatchObject({ page: 2, pageSize: 10, hasMore: true });
    expect(body.items).toEqual([entry]);
    expect(body.facets).toBeUndefined();
    expect(getAuditFacets).not.toHaveBeenCalled();
  });

  it("facets=1 agrega las opciones de filtro, y si fallan la lista igual sale", async () => {
    as(operator, ["auditoria:ver"]);
    queryAuditPage.mockResolvedValue({ items: [], hasMore: false });
    getAuditFacets.mockResolvedValue({
      actions: [],
      entityTypes: [],
      actors: [],
    });
    const ok = await json(
      await auditList(req(undefined, "http://localhost/x?facets=1")),
    );
    expect(ok.facets).toEqual({ actions: [], entityTypes: [], actors: [] });

    getAuditFacets.mockRejectedValue(new Error("db"));
    const res = await auditList(req(undefined, "http://localhost/x?facets=1"));
    expect(res.status).toBe(200);
    expect((await json(res)).facets).toBeUndefined();
  });

  it("detalle: 200, 404 si no existe, 422 si el id es inválido", async () => {
    as(operator, ["auditoria:ver"]);
    getAuditEntry.mockResolvedValueOnce(entry);
    const ok = await auditDetail(req(), ctx());
    expect(await json(ok)).toEqual({ entry });

    getAuditEntry.mockResolvedValueOnce(null);
    expect((await auditDetail(req(), ctx(UUID2))).status).toBe(404);
    expect((await auditDetail(req(), ctx("zzz"))).status).toBe(422);
  });
});
