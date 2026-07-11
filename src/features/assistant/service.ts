import { env } from "@/core/config/env";
import { safeLoad } from "@/lib/safe-load";
import { getDashboardData } from "@/features/reports/service";
import { listFilamentsView } from "@/features/inventory/queries";
import { listManualSales } from "@/features/orders/services/manualSaleService";

/**
 * Asistente IA del panel admin (Fase mejoras 2026-07, "Opción A").
 *
 * v1 sin herramientas: arma un SNAPSHOT compacto del negocio (KPIs, stock,
 * últimas ventas) reusando los services existentes y se lo da a Claude como
 * system prompt. Responde preguntas del staff sobre el negocio y sobre
 * impresión 3D en general. Llama a la API de Anthropic por fetch directo
 * (sin SDK: una dependencia menos, el endpoint es un POST simple).
 */

/** Modelo económico por default; se puede pisar con ANTHROPIC_MODEL. */
const MODEL = env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";

export type AssistantMessage = { role: "user" | "assistant"; content: string };

export function isAssistantConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

/**
 * Snapshot del negocio para el contexto del modelo. Cada fuente va con
 * safeLoad: si la DB está lenta, el asistente contesta igual y aclara qué
 * dato no pudo leer (nunca rompe el chat por una query).
 */
export async function buildBusinessSnapshot(): Promise<string> {
  const [dashR, filamentsR, salesR] = await Promise.all([
    safeLoad(
      "asistente:dashboard",
      getDashboardData(30),
      null as Awaited<ReturnType<typeof getDashboardData>> | null,
    ),
    safeLoad("asistente:filamentos", listFilamentsView(), []),
    safeLoad("asistente:ventas", listManualSales(), []),
  ]);

  const lines: string[] = [];
  const d = dashR.value;
  if (d) {
    lines.push(
      `KPIs últimos 30 días: ingresos $${d.kpis.revenue}, ventas ${d.kpis.salesCount}, ` +
        `pedidos pendientes ${d.kpis.pendingCount}, filamentos bajo stock ${d.kpis.lowStockCount}.`,
    );
  } else {
    lines.push("(KPIs no disponibles en este momento.)");
  }

  const filaments = filamentsR.value;
  if (filaments.length > 0) {
    lines.push(
      "Inventario de filamentos: " +
        filaments
          .map(
            (f) =>
              `${f.material} ${f.color}: ${f.stockGrams} g (costo $${f.costPerKg}/kg, estado ${f.status})`,
          )
          .join("; ") +
        ".",
    );
  }

  const sales = salesR.value.slice(0, 10);
  if (sales.length > 0) {
    lines.push(
      "Últimas ventas manuales: " +
        sales
          .map((s) => `${s.customerName}: $${s.total} (estado ${s.status})`)
          .join("; ") +
        ".",
    );
  }

  return lines.join("\n");
}

const SYSTEM_BASE = `Sos el asistente IA del panel de administración de Hefesto 3D, un e-commerce argentino de impresión 3D a pedido (Puerto Iguazú, Misiones). Hablás en voseo rioplatense, conciso y práctico. Respondés SOLO al equipo del negocio (staff).

Reglas:
- Usá los DATOS ACTUALES de abajo cuando pregunten por ventas, stock, pedidos o clientes. No inventes números: si un dato no está, decilo y sugerí en qué sección del panel verlo (Panel, Pedidos, Filamentos, Reportes, Ganancias, etc.).
- También podés ayudar con impresión 3D en general (materiales, fallas comunes, costos) y con ideas para el negocio.
- Respuestas cortas: 1 a 4 oraciones salvo que pidan detalle.`;

/** Envía la conversación a la API de Anthropic y devuelve la respuesta. */
export async function askAssistant(
  messages: AssistantMessage[],
): Promise<string> {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ASSISTANT_NOT_CONFIGURED");

  const snapshot = await buildBusinessSnapshot();
  const system = `${SYSTEM_BASE}\n\n=== DATOS ACTUALES DEL NEGOCIO ===\n${snapshot}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages,
    }),
    // La API puede tardar; el tope evita colgar el request hasta el 504.
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(
      "[asistente] la API de Anthropic falló:",
      res.status,
      detail.slice(0, 300),
    );
    throw new Error(`ASSISTANT_API_ERROR:${res.status}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("ASSISTANT_EMPTY_REPLY");
  return text;
}
