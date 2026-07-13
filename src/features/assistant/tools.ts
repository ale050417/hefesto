import { z } from "zod";
import type { ActionResult } from "@/core/errors";
import { saveFilamentAction } from "@/features/inventory/actions";

/**
 * Registro de ACCIONES que el asistente puede PROPONER (y ejecutar tras
 * confirmación del staff). Cada tool:
 *  - `promptDoc`: qué hace + qué args espera (va en el system prompt del modelo).
 *  - `parse`: valida el JSON crudo del modelo → args + un resumen para confirmar.
 *  - `execute`: delega en la ACTION existente (que ya chequea can() + Zod). Nunca
 *    reimplementa lógica de negocio (Cap. 5).
 *
 * Diseñado para sumar tools sin tocar el resto: agregás un objeto acá y listo.
 */
export type ToolParse =
  | { ok: true; args: Record<string, unknown>; summary: string }
  | { ok: false; error: string };

export type AssistantTool = {
  name: string;
  promptDoc: string;
  parse: (raw: unknown) => ToolParse;
  execute: (args: Record<string, unknown>) => Promise<ActionResult>;
};

const num = (label: string) => z.coerce.number().min(0, `${label} inválido`);

const filamentArgs = z.object({
  material: z.string().trim().min(1, "Falta el material"),
  color: z.string().trim().min(1, "Falta el color"),
  brand: z.string().trim().min(1, "Falta la marca"),
  stockGrams: num("Stock"),
  costPerKg: num("Costo por kg"),
  spoolGrams: z.coerce.number().min(1).optional(),
  diameter: z.string().trim().optional(),
  alertThresholdGrams: z.coerce.number().min(0).optional(),
});

export const ASSISTANT_TOOLS: AssistantTool[] = [
  {
    name: "crear_filamento",
    promptDoc:
      'crear_filamento — da de alta un filamento en el inventario. args: { "material": string, "color": string, "brand": string, "stockGrams": number, "costPerKg": number, "spoolGrams"?: number (default 1000), "diameter"?: string (default "1.75"), "alertThresholdGrams"?: number (default 1000) }',
    parse: (raw) => {
      const p = filamentArgs.safeParse(raw);
      if (!p.success) {
        return {
          ok: false,
          error: p.error.issues[0]?.message ?? "Datos inválidos.",
        };
      }
      const a = p.data;
      return {
        ok: true,
        args: a,
        summary: `Crear filamento ${a.material} ${a.color} (${a.brand}) · ${a.stockGrams} g · $${a.costPerKg}/kg`,
      };
    },
    execute: (args) =>
      saveFilamentAction({
        material: args.material,
        color: args.color,
        brand: args.brand,
        diameter: (args.diameter as string | undefined) ?? "1.75",
        stockGrams: String(args.stockGrams ?? 0),
        spoolGrams: String(args.spoolGrams ?? 1000),
        costPerKg: String(args.costPerKg ?? 0),
        alertThresholdGrams: String(args.alertThresholdGrams ?? 1000),
      }),
  },
];

export function findTool(name: string): AssistantTool | null {
  return ASSISTANT_TOOLS.find((t) => t.name === name) ?? null;
}

/** Doc de todas las tools para el system prompt del modelo. */
export function toolsPromptDoc(): string {
  return ASSISTANT_TOOLS.map((t) => `- ${t.promptDoc}`).join("\n");
}
