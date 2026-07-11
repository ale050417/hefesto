import { env } from "@/core/config/env";
import { safeLoad } from "@/lib/safe-load";
import { getDashboardData } from "@/features/reports/service";
import { listFilamentsView } from "@/features/inventory/queries";
import { listManualSales } from "@/features/orders/services/manualSaleService";

/**
 * Asistente IA del panel admin (Fase mejoras 2026-07, "Opción A").
 *
 * v1 sin herramientas: arma un SNAPSHOT compacto del negocio (KPIs, stock,
 * últimas ventas) reusando los services existentes y se lo da al modelo como
 * instrucción de sistema. Soporta DOS proveedores por fetch directo (sin SDK):
 *  - Google Gemini (GEMINI_API_KEY): capa gratuita, sin tarjeta — el default
 *    del proyecto. OJO: en el free tier Google puede usar los datos enviados
 *    para mejorar sus modelos.
 *  - Anthropic (ANTHROPIC_API_KEY): pago por uso; si está, se prefiere.
 */

/** Modelos por default, pisables por env. */
const ANTHROPIC_MODEL = env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
/**
 * Google rota/da de baja modelos SIN respetar sus propias fechas (el
 * 2026-07-09 mató a gemini-2.5-flash tres meses antes de lo anunciado y el
 * bot quedó en 404). Por eso: lista de candidatos — se intenta en orden y se
 * recuerda el primero que funciona. GEMINI_MODEL (env) va primero si existe.
 */
const GEMINI_CANDIDATES = [
  env.GEMINI_MODEL,
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
].filter((m): m is string => Boolean(m));
let geminiWorkingModel: string | null = null;

export type AssistantMessage = { role: "user" | "assistant"; content: string };

type Provider = "anthropic" | "gemini";

function pickProvider(): Provider | null {
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  if (env.GEMINI_API_KEY) return "gemini";
  return null;
}

export function isAssistantConfigured(): boolean {
  return pickProvider() !== null;
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

/**
 * La API exige roles alternados empezando por "user": fusionamos turnos
 * consecutivos del mismo rol y descartamos un "assistant" inicial huérfano
 * (defensa en profundidad; la UI ya hace rollback de turnos fallidos).
 */
function normalizeTurns(messages: AssistantMessage[]): AssistantMessage[] {
  const normalized: AssistantMessage[] = [];
  for (const m of messages) {
    const prev = normalized[normalized.length - 1];
    if (prev && prev.role === m.role) {
      prev.content = `${prev.content}\n${m.content}`;
    } else if (normalized.length === 0 && m.role === "assistant") {
      continue;
    } else {
      normalized.push({ ...m });
    }
  }
  return normalized;
}

async function callAnthropic(
  system: string,
  normalized: AssistantMessage[],
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system,
      messages: normalized,
    }),
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
  return (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}

async function callGemini(
  system: string,
  normalized: AssistantMessage[],
): Promise<string> {
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: system }] },
    contents: normalized.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: 1024 },
  });

  // Con modelo ya validado, va directo; si no, prueba candidatos en orden.
  const candidates = geminiWorkingModel
    ? [geminiWorkingModel]
    : GEMINI_CANDIDATES;

  let lastStatus = 404;
  for (const model of candidates) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY as string,
        },
        body,
        signal: AbortSignal.timeout(25_000),
      },
    );
    if (res.status === 404) {
      // Modelo dado de baja/inexistente: probamos el siguiente candidato.
      console.warn(`[asistente] modelo Gemini "${model}" no existe (404)`);
      geminiWorkingModel = null;
      lastStatus = 404;
      continue;
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        "[asistente] la API de Gemini falló:",
        res.status,
        detail.slice(0, 300),
      );
      throw new Error(`ASSISTANT_API_ERROR:${res.status}`);
    }
    geminiWorkingModel = model;
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    return (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();
  }
  console.error(
    "[asistente] ningún modelo Gemini de la lista está disponible:",
    candidates.join(", "),
  );
  throw new Error(`ASSISTANT_API_ERROR:${lastStatus}`);
}

/** Envía la conversación al proveedor configurado y devuelve la respuesta. */
export async function askAssistant(
  messages: AssistantMessage[],
): Promise<string> {
  const provider = pickProvider();
  if (!provider) throw new Error("ASSISTANT_NOT_CONFIGURED");

  const snapshot = await buildBusinessSnapshot();
  const system = `${SYSTEM_BASE}\n\n=== DATOS ACTUALES DEL NEGOCIO ===\n${snapshot}`;
  const normalized = normalizeTurns(messages);
  if (normalized.length === 0) throw new Error("ASSISTANT_EMPTY_INPUT");

  const text =
    provider === "anthropic"
      ? await callAnthropic(system, normalized)
      : await callGemini(system, normalized);
  if (!text) throw new Error("ASSISTANT_EMPTY_REPLY");
  return text;
}
