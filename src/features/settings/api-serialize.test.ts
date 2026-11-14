import { describe, expect, it } from "vitest";
import {
  buildConfigSnapshot,
  buildTeamSnapshot,
  normalizeHours,
  serializeEnvios,
  serializeNegocio,
  serializePagos,
  serializeTextos,
  serializeTienda,
} from "./api-serialize";
import { DEFAULT_FAQ } from "./faq-defaults";
import { DEFAULT_TRUST_BAR } from "./trust-defaults";
import { DEFAULT_QUOTE_DEFAULTS } from "@/features/quotes/build-quote";
import type {
  BusinessSettings,
  PaymentSettings,
  Role,
  ShippingSettings,
  StoreBanner,
  TeamMember,
} from "./types";

const settings = (over: Partial<BusinessSettings> = {}) =>
  ({
    storeName: "Hefesto 3D",
    slogan: null,
    description: null,
    whatsapp: "+54 3757 624148",
    contactEmail: null,
    addressText: null,
    instagram: "@hefesto3d",
    facebook: "@hefesto.tiktok",
    cuit: null,
    businessMode: "checkout",
    accentColor: "#C9A84C",
    season: "none",
    seasonDeco: false,
    seasonIntensity: 16,
    seasonDurationSec: 0,
    homeSections: null,
    trustBar: null,
    faq: null,
    bannerIntervalSec: 5,
    pickupEnabled: true,
    deliveryEnabled: false,
    hours: null,
    logoUrl: null,
    heroImageUrl: null,
    ...over,
  }) as unknown as BusinessSettings;

describe("normalizeHours", () => {
  it("sin datos devuelve los horarios por defecto (copia, no la constante)", () => {
    const a = normalizeHours(null);
    expect(a).toHaveLength(3);
    expect(a[0]!.label).toBe("Lun a Vie");
    a[0]!.morning.on = false;
    expect(normalizeHours([])[0]!.morning.on).toBe(true);
  });

  it("pasa el formato viejo {from,to,on} al turno mañana", () => {
    const [h] = normalizeHours([
      { label: "Lun", from: "10:00", to: "14:00", on: true },
    ]);
    expect(h).toEqual({
      label: "Lun",
      morning: { on: true, from: "10:00", to: "14:00" },
      afternoon: { on: false, from: "", to: "" },
    });
  });

  it("respeta el formato nuevo y tolera basura", () => {
    const rows = normalizeHours([
      {
        label: "Sáb",
        morning: { on: true, from: "09:00", to: "13:00" },
        afternoon: { on: 0, from: null, to: undefined },
      },
      null,
    ]);
    expect(rows[0]!.afternoon).toEqual({ on: false, from: "", to: "" });
    expect(rows[1]!.label).toBe("");
  });
});

describe("serializeNegocio", () => {
  it("el TikTok sale de la columna facebook y los null pasan a ''", () => {
    const n = serializeNegocio(settings());
    expect(n.tiktok).toBe("@hefesto.tiktok");
    expect(n.slogan).toBe("");
    expect(n.cuit).toBe("");
    expect(n.hours).toHaveLength(3);
  });

  it("sin fila de configuración devuelve todo vacío (no rompe)", () => {
    const n = serializeNegocio(null);
    expect(n.storeName).toBe("");
    expect(n.hours).toHaveLength(3);
  });
});

describe("serializeEnvios", () => {
  it("freeOver numeric (string) → número; zonas con precio numérico", () => {
    const e = serializeEnvios(
      {
        city: "Iguazú",
        freeOver: "30000.00",
        outMsg: null,
        zones: [
          { name: "Centro", price: 1500 },
          { name: "Km 5", price: "2000" as unknown as number },
        ],
      } as unknown as ShippingSettings,
      settings(),
    );
    expect(e.freeOver).toBe(30000);
    expect(e.zones).toEqual([
      { name: "Centro", price: 1500 },
      { name: "Km 5", price: 2000 },
    ]);
    expect(e.pickupEnabled).toBe(true);
    expect(e.deliveryEnabled).toBe(false);
    expect(e.outMsg).toBe("");
  });

  it("sin configuración de envíos: ceros y listas vacías", () => {
    const e = serializeEnvios(null, null);
    expect(e).toMatchObject({
      freeOver: 0,
      zones: [],
      pickupEnabled: true,
      deliveryEnabled: true,
    });
  });
});

describe("serializePagos", () => {
  it("NUNCA expone el token de MercadoPago: solo si está conectado", () => {
    const p = serializePagos({
      transferEnabled: true,
      transferAlias: "hefesto.mp",
      transferCbu: null,
      mpEnabled: true,
      mpNote: null,
      mpAccessToken: "APP_USR-super-secreto-123456",
      cashEnabled: false,
      cashNote: null,
    } as unknown as PaymentSettings);
    expect(p.mpConnected).toBe(true);
    expect(JSON.stringify(p)).not.toContain("APP_USR");
    expect(JSON.stringify(p)).not.toContain("secreto");
    expect(p).not.toHaveProperty("mpAccessToken");
  });

  it("token vacío o en blanco = desconectado", () => {
    expect(
      serializePagos({ mpAccessToken: "   " } as unknown as PaymentSettings)
        .mpConnected,
    ).toBe(false);
    expect(serializePagos(null).mpConnected).toBe(false);
  });
});

describe("serializeTienda", () => {
  const banner = (over: Partial<StoreBanner>) =>
    ({
      id: "b1",
      title: "Hola",
      subtitle: null,
      imageUrl: "https://x/y.webp",
      position: "50% 50%",
      align: "left",
      ctaText: null,
      ctaHref: null,
      sortOrder: 0,
      isActive: true,
      createdAt: new Date(),
      ...over,
    }) as StoreBanner;

  it("secciones del home: todas visibles salvo las puestas en false", () => {
    const t = serializeTienda(
      settings({ homeSections: { faq: false, stats: true } }),
      [],
    );
    expect(t.homeSections.find((s) => s.id === "faq")!.on).toBe(false);
    expect(t.homeSections.find((s) => s.id === "stats")!.on).toBe(true);
    expect(t.homeSections.find((s) => s.id === "galeria")!.on).toBe(true);
    expect(t.homeSections.length).toBeGreaterThanOrEqual(11);
  });

  it("temporada desconocida cae a 'none'; ofrece la lista de temporadas", () => {
    expect(
      serializeTienda(settings({ season: "fiesta_rara" }), []).season,
    ).toBe("none");
    const t = serializeTienda(settings({ season: "navidad" }), []);
    expect(t.season).toBe("navidad");
    expect(t.seasons.find((s) => s.key === "navidad")).toMatchObject({
      label: "Navidad",
      hasDeco: true,
    });
    expect(t.seasons.find((s) => s.key === "none")!.hasDeco).toBe(false);
  });

  it("modo vidriera y banners", () => {
    const t = serializeTienda(settings({ businessMode: "vidriera" }), [
      banner({ isActive: false }),
    ]);
    expect(t.businessMode).toBe("vidriera");
    expect(t.banners[0]).toMatchObject({
      id: "b1",
      isActive: false,
      imageUrl: "https://x/y.webp",
    });
    expect(t.banners[0]).not.toHaveProperty("createdAt");
  });
});

describe("serializeTextos", () => {
  it("sin textos guardados devuelve los de fábrica y avisa que no son propios", () => {
    const t = serializeTextos(settings(), DEFAULT_QUOTE_DEFAULTS);
    expect(t.trustBar).toEqual(DEFAULT_TRUST_BAR);
    expect(t.trustBarCustom).toBe(false);
    expect(t.faq).toEqual(DEFAULT_FAQ);
    expect(t.faqCustom).toBe(false);
    expect(t.quote.depositPct).toBe(50);
  });

  it("con textos propios los devuelve tal cual", () => {
    const t = serializeTextos(
      settings({
        trustBar: [{ ic: "truck", t: "Rápido", d: "En 24 h" }],
        faq: [{ q: "¿Envían?", a: "Sí." }],
      }),
      { ...DEFAULT_QUOTE_DEFAULTS, depositPct: 30 },
    );
    expect(t.trustBar).toEqual([{ ic: "truck", t: "Rápido", d: "En 24 h" }]);
    expect(t.trustBarCustom).toBe(true);
    expect(t.faq).toHaveLength(1);
    expect(t.faqCustom).toBe(true);
    expect(t.quote.depositPct).toBe(30);
  });

  it("una lista guardada vacía cuenta como 'sin textos propios'", () => {
    const t = serializeTextos(settings({ faq: [] }), DEFAULT_QUOTE_DEFAULTS);
    expect(t.faqCustom).toBe(false);
    expect(t.faq).toEqual(DEFAULT_FAQ);
  });
});

describe("buildConfigSnapshot", () => {
  it("junta las secciones y funciona aun sin ninguna fila", () => {
    const snap = buildConfigSnapshot({
      settings: null,
      payment: null,
      shipping: null,
      banners: [],
      quote: null,
    });
    expect(Object.keys(snap).sort()).toEqual([
      "envios",
      "negocio",
      "pagos",
      "textos",
      "tienda",
    ]);
    expect(snap.textos.quote.title).toBe(DEFAULT_QUOTE_DEFAULTS.title);
  });
});

describe("buildTeamSnapshot", () => {
  const member = (over: Partial<TeamMember>): TeamMember => ({
    id: "u1",
    fullName: "Ale",
    email: "ale@x.com",
    role: "admin",
    roleId: "r-admin",
    roleName: "Administrador",
    status: "activo",
    ...over,
  });
  const role = (over: Partial<Role>): Role =>
    ({
      id: "r-admin",
      name: "Administrador",
      permissions: {},
      isSystem: true,
      isAdmin: true,
      createdAt: new Date(),
      ...over,
    }) as Role;

  it("marca al propio usuario y al último administrador", () => {
    const snap = buildTeamSnapshot({
      team: [
        member({}),
        member({
          id: "u2",
          fullName: "Anto",
          role: "operator",
          roleId: "r-op",
          roleName: "Operador",
          status: "invitado",
        }),
      ],
      roles: [
        role({}),
        role({
          id: "r-op",
          name: "Operador",
          isAdmin: false,
          permissions: { pedidos: ["ver"] },
        }),
      ],
      currentUserId: "u1",
      canManage: true,
    });
    expect(snap.canManage).toBe(true);
    expect(snap.team[0]).toMatchObject({ isSelf: true, isLastAdmin: true });
    expect(snap.team[1]).toMatchObject({
      isSelf: false,
      isLastAdmin: false,
      status: "invitado",
    });
    expect(snap.roles.find((r) => r.id === "r-op")).toMatchObject({
      memberCount: 1,
      permissions: { pedidos: ["ver"] },
    });
  });

  it("con dos administradores ninguno es 'el último'", () => {
    const snap = buildTeamSnapshot({
      team: [member({}), member({ id: "u3", fullName: "Otro" })],
      roles: [role({})],
      currentUserId: "zzz",
      canManage: false,
    });
    expect(snap.team.every((t) => !t.isLastAdmin)).toBe(true);
    expect(snap.canManage).toBe(false);
  });

  it("lista los módulos de permisos del panel (incluye config y auditoria)", () => {
    const snap = buildTeamSnapshot({
      team: [],
      roles: [],
      currentUserId: "u",
      canManage: true,
    });
    const keys = snap.modules.map((m) => m.key);
    expect(keys).toContain("config");
    expect(keys).toContain("auditoria");
    expect(snap.modules.find((m) => m.key === "config")!.label).toBe(
      "Configuración",
    );
  });
});
