import { describe, expect, it, vi } from "vitest";

// query.ts importa la base; acá solo se prueba lógica pura (sin DB real).
vi.mock("@/core/db", () => ({ db: {} }));

import { ACTION_LABEL, labelOf } from "./labels";
import {
  actionsMatchingLabel,
  escapeLike,
  parseAuditParams,
  serializeAuditEntry,
} from "./query";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("labelOf", () => {
  it("traduce las acciones conocidas", () => {
    expect(labelOf("order.status_changed")).toBe("Cambió estado de pedido");
    expect(labelOf("team.member_invited")).toBe(
      "Invitó a una persona al equipo",
    );
  });

  it("una acción desconocida se muestra legible, no cruda", () => {
    expect(labelOf("order.x_y")).toBe("Order: x y");
    expect(labelOf("algo")).toBe("Algo");
  });

  it("toda acción registrada por el código tiene texto", () => {
    for (const code of [
      "category.created",
      "coupon.deleted",
      "manual_sale.imported",
      "inventory.failure_registered",
      "team.invite_resent",
      "team.member_promoted",
    ]) {
      expect(ACTION_LABEL[code], code).toBeTruthy();
    }
  });
});

describe("escapeLike", () => {
  it("escapa los comodines para que la búsqueda sea literal", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
    expect(escapeLike("pedido")).toBe("pedido");
  });
});

describe("actionsMatchingLabel", () => {
  it("encuentra acciones por su texto en castellano, sin tildes ni mayúsculas", () => {
    const hits = actionsMatchingLabel("PEDIDO");
    expect(hits).toContain("order.status_changed");
    expect(hits).toContain("order.deleted");
    expect(hits).not.toContain("product.created");
    expect(actionsMatchingLabel("cambio")).toContain("order.status_changed");
  });

  it("un término muy corto no dispara nada", () => {
    expect(actionsMatchingLabel("a")).toEqual([]);
    expect(actionsMatchingLabel("  ")).toEqual([]);
  });
});

describe("parseAuditParams", () => {
  it("sin parámetros: página 1, 30 por página, sin filtros", () => {
    const p = parseAuditParams(new URLSearchParams());
    expect(p.page).toBe(1);
    expect(p.pageSize).toBe(30);
    expect(p.facets).toBe(false);
    expect(p.filters).toEqual({
      q: undefined,
      action: undefined,
      entityType: undefined,
      actor: undefined,
      since: undefined,
    });
  });

  it("lee filtros válidos", () => {
    const p = parseAuditParams(
      new URLSearchParams({
        q: "  mate  ",
        action: "order.status_changed",
        entity: "order",
        actor: UUID,
        desde: "2026-10-01T00:00:00.000Z",
        page: "3",
        pageSize: "50",
        facets: "1",
      }),
    );
    expect(p.filters.q).toBe("mate");
    expect(p.filters.action).toBe("order.status_changed");
    expect(p.filters.entityType).toBe("order");
    expect(p.filters.actor).toBe(UUID);
    expect(p.filters.since?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(p.page).toBe(3);
    expect(p.pageSize).toBe(50);
    expect(p.facets).toBe(true);
  });

  it("acepta 'sistema' como autor", () => {
    expect(
      parseAuditParams(new URLSearchParams({ actor: "sistema" })).filters.actor,
    ).toBe("sistema");
  });

  it("ignora lo inválido y acota los tamaños", () => {
    const p = parseAuditParams(
      new URLSearchParams({
        actor: "no-es-uuid",
        desde: "ayer",
        page: "-4",
        pageSize: "5000",
      }),
    );
    expect(p.filters.actor).toBeUndefined();
    expect(p.filters.since).toBeUndefined();
    expect(p.page).toBe(1);
    expect(p.pageSize).toBe(100);
    expect(
      parseAuditParams(new URLSearchParams({ pageSize: "0" })).pageSize,
    ).toBe(1);
    expect(parseAuditParams(new URLSearchParams({ page: "abc" })).page).toBe(1);
  });
});

describe("serializeAuditEntry", () => {
  const base = {
    id: UUID,
    action: "manual_sale.created",
    entityType: "manual_sale",
    entityId: "abc",
    metadata: { total: 1500 },
    createdAt: new Date("2026-10-30T12:00:00.000Z"),
    actorId: "u1",
    actorName: "Ale",
    actorRole: "admin",
  };

  it("fecha ISO, etiqueta en castellano y autor", () => {
    expect(serializeAuditEntry(base)).toEqual({
      id: UUID,
      action: "manual_sale.created",
      actionLabel: "Cargó una venta manual",
      entityType: "manual_sale",
      entityId: "abc",
      metadata: { total: 1500 },
      createdAt: "2026-10-30T12:00:00.000Z",
      actor: { id: "u1", name: "Ale", role: "admin" },
    });
  });

  it("sin autor → actor null; sin metadata → null", () => {
    const e = serializeAuditEntry({
      ...base,
      actorId: null,
      actorName: null,
      actorRole: null,
      metadata: undefined,
    });
    expect(e.actor).toBeNull();
    expect(e.metadata).toBeNull();
  });
});
