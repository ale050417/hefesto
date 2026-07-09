import { describe, expect, it } from "vitest";
import {
  buildTemplateRows,
  guessMapping,
  normalizeDate,
  normalizeNumber,
  normalizePayment,
  normalizeStatus,
  parseImportRow,
  IMPORT_FIELDS,
  type ImportFieldKey,
} from "./import-sales";

const FULL_MAPPING: Record<ImportFieldKey, number> = {
  saleDate: 0,
  customerName: 1,
  detail: 2,
  quantity: 3,
  total: 4,
  paymentMethod: 5,
  status: 6,
  material: 7,
  grams: 8,
  printMinutes: 9,
  unitCost: 10,
};

describe("normalizeDate", () => {
  it("acepta dd/mm/aaaa, aaaa-mm-dd y serial de Excel", () => {
    expect(normalizeDate("15/06/2026")).toBe("2026-06-15");
    expect(normalizeDate("5-1-26")).toBe("2026-01-05");
    expect(normalizeDate("2026-06-15")).toBe("2026-06-15");
    // 45838 = 2025-06-30 en serial Excel (base 1900).
    expect(normalizeDate(45838)).toBe("2025-06-30");
    expect(normalizeDate(new Date("2026-06-15T00:00:00Z"))).toBe("2026-06-15");
  });
  it("rechaza basura", () => {
    expect(normalizeDate("ayer")).toBeNull();
    expect(normalizeDate("32/13/2026")).toBeNull();
    expect(normalizeDate("")).toBeNull();
  });
});

describe("normalizeNumber (formato AR)", () => {
  it("parsea $ 1.234,56 / 1234,5 / números nativos", () => {
    expect(normalizeNumber("$ 1.234,56")).toBe(1234.56);
    expect(normalizeNumber("1234,5")).toBe(1234.5);
    expect(normalizeNumber("18000")).toBe(18000);
    expect(normalizeNumber(2500.75)).toBe(2500.75);
  });
  it("rechaza texto", () => {
    expect(normalizeNumber("dos mil")).toBeNull();
  });
});

describe("alias de pago y estado", () => {
  it("mapea alias en español", () => {
    expect(normalizePayment("Efectivo")).toBe("cash");
    expect(normalizePayment("Transferencia")).toBe("transfer");
    expect(normalizePayment("Mercado Pago")).toBe("mercadopago");
    expect(normalizePayment("")).toBe("cash");
    expect(normalizePayment("cripto")).toBeNull();
    expect(normalizeStatus("Entregado")).toBe("delivered");
    expect(normalizeStatus("")).toBe("delivered");
    expect(normalizeStatus("en producción")).toBe("in_production");
    expect(normalizeStatus("???")).toBeNull();
  });
});

describe("guessMapping", () => {
  it("encuentra columnas por alias aunque cambie el orden", () => {
    const m = guessMapping(["Cliente", "Total $", "Fecha", "Cant."]);
    expect(m.customerName).toBe(0);
    expect(m.total).toBe(1);
    expect(m.saleDate).toBe(2);
    expect(m.quantity).toBe(3);
    expect(m.material).toBe(-1);
  });
});

describe("parseImportRow", () => {
  const okRow = [
    "15/06/2026",
    "Juan Pérez",
    "Maceta",
    "2",
    "$ 18.000,00",
    "efectivo",
    "entregado",
    "PLA",
    "120",
    "180",
    "",
  ];

  it("fila válida con gramos+material (costo calculable)", () => {
    const r = parseImportRow(okRow, FULL_MAPPING);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.total).toBe(18000);
      expect(r.data.quantity).toBe(2);
      expect(r.data.paymentMethod).toBe("cash");
      expect(r.data.grams).toBe(120);
    }
  });

  it("fila válida con costo unitario explícito (sin gramos)", () => {
    const row = [...okRow];
    row[7] = "";
    row[8] = "";
    row[10] = "6500";
    const r = parseImportRow(row, FULL_MAPPING);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.unitCost).toBe(6500);
  });

  it("sin costo posible → error claro (nunca 0 silencioso)", () => {
    const row = [...okRow];
    row[7] = "";
    row[8] = "";
    row[10] = "";
    const r = parseImportRow(row, FULL_MAPPING);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/costo/i);
  });

  it("acumula errores por fila sin tirar excepción", () => {
    const r = parseImportRow(
      ["fecha rara", "", "x", "0.5", "nada", "cripto", "???", "", "", "", ""],
      FULL_MAPPING,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("plantilla", () => {
  it("los encabezados de la plantilla se auto-mapean completos", () => {
    const [headers] = buildTemplateRows();
    const m = guessMapping(headers!);
    for (const f of IMPORT_FIELDS) {
      expect(m[f.key], `campo ${f.key}`).toBeGreaterThanOrEqual(0);
    }
  });
});
