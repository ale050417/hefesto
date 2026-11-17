import { describe, expect, it } from "vitest";
import {
  bannerPatchSchema,
  cotizacionSchema,
  enviosSchema,
  negocioPatchSchema,
  textosPatchSchema,
  tiendaPatchSchema,
} from "./api-schemas";
import { createRoleSchema, inviteSchema } from "./schemas";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("negocioPatchSchema", () => {
  it("es parcial: acepta solo los campos que cambian", () => {
    const r = negocioPatchSchema.safeParse({ slogan: "Forjado en capas" });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ slogan: "Forjado en capas" });
  });

  it("recorta espacios y permite borrar un dato con ''", () => {
    const r = negocioPatchSchema.safeParse({
      instagram: "  @hefesto  ",
      cuit: "",
    });
    expect(r.data).toEqual({ instagram: "@hefesto", cuit: "" });
  });

  it("el nombre no puede quedar vacío", () => {
    const r = negocioPatchSchema.safeParse({ storeName: "  " });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.message).toBe("Ingresá el nombre del negocio.");
  });

  it("valida el email (si viene)", () => {
    expect(
      negocioPatchSchema.safeParse({ contactEmail: "no-es-mail" }).success,
    ).toBe(false);
    expect(
      negocioPatchSchema.safeParse({ contactEmail: "hola@hefesto.com" })
        .success,
    ).toBe(true);
    expect(negocioPatchSchema.safeParse({ contactEmail: "" }).success).toBe(
      true,
    );
  });

  it("respeta los largos máximos de la web", () => {
    expect(
      negocioPatchSchema.safeParse({ description: "x".repeat(501) }).success,
    ).toBe(false);
    expect(negocioPatchSchema.safeParse({ cuit: "1".repeat(21) }).success).toBe(
      false,
    );
  });

  it("no deja pasar los switches de retiro/envío (van en Envíos)", () => {
    const r = negocioPatchSchema.safeParse({
      slogan: "x",
      pickupEnabled: false,
    });
    expect(r.success).toBe(true);
    expect(r.data).not.toHaveProperty("pickupEnabled");
  });

  it("horarios con dos turnos", () => {
    const hours = [
      {
        label: "Lun a Vie",
        morning: { on: true, from: "09:00", to: "13:00" },
        afternoon: { on: false, from: "", to: "" },
      },
    ];
    expect(negocioPatchSchema.safeParse({ hours }).success).toBe(true);
    expect(
      negocioPatchSchema.safeParse({ hours: [{ label: "x" }] }).success,
    ).toBe(false);
  });
});

describe("enviosSchema", () => {
  const ok = {
    city: "Iguazú",
    freeOver: 30000,
    outMsg: "",
    zones: [{ name: "Centro", price: 1500 }],
  };

  it("acepta el formulario completo y convierte números en texto", () => {
    const r = enviosSchema.safeParse({
      ...ok,
      freeOver: "30000",
      zones: [{ name: "Km 5", price: "2000" }],
    });
    expect(r.success).toBe(true);
    expect(r.data!.freeOver).toBe(30000);
    expect(r.data!.zones[0]!.price).toBe(2000);
  });

  it("exige todos los campos (no hay merge: la lista de barrios se reemplaza)", () => {
    expect(enviosSchema.safeParse({ city: "x" }).success).toBe(false);
  });

  it("no acepta precios negativos", () => {
    expect(enviosSchema.safeParse({ ...ok, freeOver: -1 }).success).toBe(false);
    expect(
      enviosSchema.safeParse({ ...ok, zones: [{ name: "A", price: -5 }] })
        .success,
    ).toBe(false);
  });

  it("los switches son opcionales", () => {
    expect(
      enviosSchema.safeParse({
        ...ok,
        pickupEnabled: false,
        deliveryEnabled: true,
      }).success,
    ).toBe(true);
  });
});

describe("tiendaPatchSchema", () => {
  it("acepta modo, acento, temporada y segundos entre banners", () => {
    const r = tiendaPatchSchema.safeParse({
      businessMode: "vidriera",
      accentColor: "#C9A84C",
      season: "navidad",
      seasonDeco: true,
      bannerIntervalSec: 7,
    });
    expect(r.success).toBe(true);
  });

  it("rechaza temporadas inventadas, colores mal formados y modos raros", () => {
    expect(tiendaPatchSchema.safeParse({ season: "carnaval" }).success).toBe(
      false,
    );
    expect(tiendaPatchSchema.safeParse({ accentColor: "rojo" }).success).toBe(
      false,
    );
    expect(
      tiendaPatchSchema.safeParse({ businessMode: "mayorista" }).success,
    ).toBe(false);
  });

  it("acota los segundos entre banners a 3-12 como la web", () => {
    expect(tiendaPatchSchema.safeParse({ bannerIntervalSec: 2 }).success).toBe(
      false,
    );
    expect(tiendaPatchSchema.safeParse({ bannerIntervalSec: 13 }).success).toBe(
      false,
    );
    expect(tiendaPatchSchema.safeParse({ bannerIntervalSec: 12 }).success).toBe(
      true,
    );
  });

  it("acepta el acento vacío (vuelve al dorado de la marca)", () => {
    expect(tiendaPatchSchema.safeParse({ accentColor: "" }).success).toBe(true);
  });
});

describe("textosPatchSchema", () => {
  it("necesita al menos uno de los dos bloques", () => {
    expect(textosPatchSchema.safeParse({}).success).toBe(false);
    expect(
      textosPatchSchema.safeParse({ faq: [{ q: "¿Hola?", a: "Hola." }] })
        .success,
    ).toBe(true);
    expect(
      textosPatchSchema.safeParse({
        trustBar: [{ ic: "truck", t: "Rápido", d: "En 48 h" }],
      }).success,
    ).toBe(true);
  });

  it("limita la cantidad y el largo (6 puntos de confianza, 12 preguntas)", () => {
    const item = { ic: "truck", t: "T", d: "D" };
    expect(
      textosPatchSchema.safeParse({ trustBar: Array(7).fill(item) }).success,
    ).toBe(false);
    expect(
      textosPatchSchema.safeParse({ faq: Array(13).fill({ q: "q", a: "a" }) })
        .success,
    ).toBe(false);
    expect(
      textosPatchSchema.safeParse({ faq: [{ q: "", a: "a" }] }).success,
    ).toBe(false);
  });
});

describe("cotizacionSchema", () => {
  it("mismas reglas que la acción web", () => {
    const ok = {
      title: "COTIZACIÓN",
      depositPct: 50,
      depositText: "",
      notes: ["Una aclaración."],
    };
    expect(cotizacionSchema.safeParse(ok).success).toBe(true);
    expect(cotizacionSchema.safeParse({ ...ok, depositPct: 101 }).success).toBe(
      false,
    );
    expect(cotizacionSchema.safeParse({ ...ok, title: "ab" }).success).toBe(
      false,
    );
    expect(cotizacionSchema.safeParse({ ...ok, notes: [""] }).success).toBe(
      false,
    );
    expect(
      cotizacionSchema.safeParse({ ...ok, notes: Array(11).fill("x") }).success,
    ).toBe(false);
  });
});

describe("bannerPatchSchema", () => {
  it("es parcial y no deja cambiar el orden", () => {
    const r = bannerPatchSchema.safeParse({ isActive: false, sortOrder: 9 });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ isActive: false });
  });

  it("la imagen solo puede ser una subida a nuestro Storage de banners", () => {
    expect(
      bannerPatchSchema.safeParse({ imageUrl: "https://hack/x.png" }).success,
    ).toBe(false);
    expect(
      bannerPatchSchema.safeParse({
        imageUrl:
          "https://abc.supabase.co/storage/v1/object/public/products/12/x.webp",
      }).success,
    ).toBe(false);
    expect(
      bannerPatchSchema.safeParse({
        imageUrl:
          "https://abc.supabase.co/storage/v1/object/public/products/banners/banner-1.jpg",
      }).success,
    ).toBe(true);
  });

  it("la alineación es left/center/right", () => {
    expect(bannerPatchSchema.safeParse({ align: "center" }).success).toBe(true);
    expect(bannerPatchSchema.safeParse({ align: "arriba" }).success).toBe(
      false,
    );
  });
});

describe("schemas de equipo y roles (compartidos con la web)", () => {
  it("los permisos se sanean contra los módulos y acciones conocidos", () => {
    const r = createRoleSchema.safeParse({
      name: "  Ventas  ",
      permissions: {
        pedidos: ["ver", "editar", "ver", "volar"],
        modulo_inventado: ["ver"],
        auditoria: ["ver"],
        config: "ver",
      },
    });
    expect(r.success).toBe(true);
    expect(r.data!.name).toBe("Ventas");
    expect(r.data!.permissions).toEqual({
      pedidos: ["ver", "editar"],
      auditoria: ["ver"],
    });
  });

  it("el rol necesita nombre", () => {
    expect(
      createRoleSchema.safeParse({ name: "  ", permissions: {} }).success,
    ).toBe(false);
  });

  it("la invitación pide email válido y rol uuid", () => {
    expect(
      inviteSchema.safeParse({ email: "a@b.com", roleId: UUID }).success,
    ).toBe(true);
    expect(
      inviteSchema.safeParse({ email: "a@b.com", roleId: "no" }).success,
    ).toBe(false);
    expect(
      inviteSchema.safeParse({ email: "nope", roleId: UUID }).success,
    ).toBe(false);
  });
});
