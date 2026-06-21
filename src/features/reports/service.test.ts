import { describe, expect, it } from "vitest";
import { buildSalesCsv, fillDailySeries } from "./service";

describe("fillDailySeries", () => {
  const today = new Date("2026-06-10T12:00:00Z");

  it("genera N días continuos rellenando con 0", () => {
    const s = fillDailySeries([{ day: "2026-06-09", total: 500 }], 3, today);
    expect(s).toHaveLength(3);
    expect(s.map((p) => p.date)).toEqual([
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
    ]);
    expect(s[1]!.total).toBe(500);
    expect(s[0]!.total).toBe(0);
  });
});

describe("buildSalesCsv", () => {
  it("arma encabezado + filas y escapa comillas", () => {
    const csv = buildSalesCsv([
      {
        orderNumber: "HEF-1",
        status: "confirmed",
        total: "1000.00",
        createdAt: new Date("2026-06-01T00:00:00Z"),
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Pedido,Estado,Total,Fecha");
    expect(lines[1]).toContain('"HEF-1"');
    expect(lines[1]).toContain('"1000.00"');
  });
});
