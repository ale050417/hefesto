import { env } from "@/core/config/env";
import { safeLoad } from "@/lib/safe-load";
import { getDashboardData } from "@/features/reports/service";
import { listFilamentsView } from "@/features/inventory/queries";
import { listManualSales } from "@/features/orders/services/manualSaleService";
import { findTool, toolsPromptDoc } from "./tools";

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
  // Fallbacks estables conocidos, por si los nombres nuevos no existen para tu key.
  "gemini-2.0-flash",
  "gemini-1.5-flash",
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

const SYSTEM_BASE = `Sos el asistente del PANEL DE ADMINISTRACIÓN de Hefesto 3D (e-commerce argentino de impresión 3D a pedido). Hablás en voseo rioplatense, conciso y práctico. Respondés SOLO al staff.

TEMA ÚNICO: el panel y sus datos. Si preguntan CUALQUIER otra cosa (temas generales, código, otras webs, consejos ajenos al panel), respondé exactamente: "Solo puedo ayudarte con el panel de Hefesto" y, si aplica, sugerí la sección relacionada.

MANUAL DEL PANEL (secciones y para qué sirve cada una):
- Panel: KPIs de los últimos 30 días (ingresos, ventas, pedidos pendientes, filamentos bajo stock), gráfico de ingresos y últimos pedidos. Botones: Exportar y Nuevo producto.
- Pedidos: pedidos de la tienda online con filtros por estado (chips) y, abajo, las VENTAS MANUALES. Botones: "Importar Excel/CSV" (carga masiva con plantilla) y "Cargar venta" (venta manual con calculadora de costos integrada). Clic en un pedido → detalle con cambio de estado, código de seguimiento, nota interna y chat con el cliente.
- A medida: encargos personalizados con chat y cotización (hoy marcado "Próximamente").
- Clientes: registrados y manuales, con gasto total y pedidos; ficha con nota interna y edición.
- Cola de impresión: impresoras y trabajos del taller. Botones: Conectar impresora y Encolar.
- Filamentos: inventario por material/color/marca con stock en gramos, costo por kg y alerta de stock bajo. "+ Carrete" suma stock; el lápiz edita; en marca y color se puede ESCRIBIR un valor nuevo (queda creado al guardar).
- Impresiones fallidas: "Registrar falla" descuenta los gramos perdidos del filamento y calcula el costo perdido.
- Productos: catálogo de la tienda. "Nuevo producto" incluye calculadora de costos; se puede editar, publicar o archivar. Todo producto necesita categoría.
- Categorías: se crean acá; no se puede borrar una categoría en uso.
- Descuentos: cupones (% o monto fijo) con vigencia y límite de usos.
- Recompensas: catálogo de canjes por puntos (los clientes suman 1 punto por cada $100).
- Reseñas: moderación (aprobar o eliminar).
- Reportes: facturación por año, ventas por origen (tienda vs. manual), por mes y por categoría, top productos y Exportar CSV.
- Ganancias y socios: ingresos cobrados, amortización (costos), ganancia pura y reparto por porcentaje entre socios con "a cobrar" por persona. Botón "Config de costos".
- Calculadora 3D: presupuesto por pieza (filamento, gramos, horas → precio sugerido). Botones "Tipos y márgenes" y "Configuración global".
- Configuración: pestañas Negocio, Métodos de pago, Tienda, Envíos y Roles y permisos.
- Auditoría: registro de las acciones sensibles del equipo (quién hizo qué y cuándo).
- Barra superior: "Volver a la tienda", selector de tema (claro/oscuro) y campana de notificaciones (pedido nuevo, mensaje de cliente, stock bajo).

Reglas de datos: usá los DATOS ACTUALES de abajo cuando pregunten por ventas, stock, pedidos o clientes. No inventes números: si un dato no está, decilo y indicá en qué sección verlo. Respuestas cortas: 1 a 4 oraciones salvo que pidan detalle.`;

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
  timeoutMs = 25_000,
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
    signal: AbortSignal.timeout(timeoutMs),
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
  timeoutMs = 25_000,
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
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!res.ok) {
      // CUALQUIER error del modelo actual (404 inexistente, 400 no habilitado
      // para la key, 429, etc.): lo registramos y probamos el SIGUIENTE
      // candidato en vez de cortar. Así un modelo dado de baja o no disponible
      // para tu key no tumba al fallback "gemini-flash-latest" (que sí anda).
      const detail = await res.text().catch(() => "");
      console.warn(
        `[asistente] modelo Gemini "${model}" falló (${res.status}):`,
        detail.slice(0, 200),
      );
      geminiWorkingModel = null;
      lastStatus = res.status;
      continue;
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

/**
 * "Generar con Hefi": una descripción de producto a partir del nombre. One-shot
 * (sin historial ni snapshot del negocio), reusa el mismo proveedor y llamadas
 * del asistente. Devuelve texto plano listo para el campo Descripción.
 */
export async function generateProductDescription(
  name: string,
): Promise<string> {
  const provider = pickProvider();
  if (!provider) throw new Error("ASSISTANT_NOT_CONFIGURED");
  const system =
    "Sos Hefi, el asistente de Hefesto 3D, una tienda argentina de impresión 3D. " +
    "Escribí la descripción de un producto para la tienda: atractiva, clara y breve " +
    "(2 a 4 oraciones), en español rioplatense, tono cálido y profesional. NO inventes " +
    "medidas, materiales, colores ni especificaciones que no te den. Devolvé SOLO la " +
    "descripción, sin título, sin comillas y sin listas.";
  const messages: AssistantMessage[] = [
    {
      role: "user",
      content: `Nombre del producto: "${name}". Escribí su descripción para la tienda.`,
    },
  ];
  // Timeout corto: es una tarea chica. Si Gemini gratis se cuelga, mejor cortar
  // a los 18s y que el admin reintente (suele andar a la segunda) que esperar 25.
  const text =
    provider === "gemini"
      ? await callGemini(system, messages, 18_000)
      : await callAnthropic(system, messages, 18_000);
  return text.trim();
}

/* ---------- Acciones con confirmación (Fase 5) ---------- */

export type AssistantReply =
  | { type: "text"; text: string }
  | {
      type: "action";
      name: string;
      args: Record<string, unknown>;
      summary: string;
    };

const SYSTEM_ACTIONS = `

=== ACCIONES QUE PODÉS EJECUTAR ===
Si el staff te pide EJECUTAR (no solo consultar) una de estas acciones, respondé ÚNICAMENTE con un bloque JSON, sin ningún texto adicional:
\`\`\`json
{"accion": "<nombre>", "args": { ... }}
\`\`\`
Acciones disponibles:
${toolsPromptDoc()}
Si falta un dato OBLIGATORIO, NO lo inventes: pedíselo en texto normal. Para preguntas o cualquier otra cosa, respondé en texto normal SIN JSON.`;

/** Extrae { accion, args } de un bloque JSON en la respuesta del modelo. */
function parseActionBlock(text: string): { name: string; raw: unknown } | null {
  // Sacamos el cerco de código (```json ... ```) sin escapar backticks en regex.
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "");
  const candidate = /\{[\s\S]*"accion"[\s\S]*\}/.exec(cleaned)?.[0];
  if (!candidate) return null;
  try {
    const obj = JSON.parse(candidate.trim()) as {
      accion?: unknown;
      args?: unknown;
    };
    if (typeof obj.accion === "string") {
      return { name: obj.accion, raw: obj.args ?? {} };
    }
  } catch {
    /* no era JSON válido: se trata como texto */
  }
  return null;
}

/**
 * Como askAssistant pero además detecta PROPUESTAS DE ACCIÓN. Si el modelo
 * devuelve un bloque JSON que matchea una tool y sus args son válidos, devuelve
 * una propuesta para que el staff CONFIRME (no ejecuta nada acá). Si no, texto.
 */
export async function askAssistantSmart(
  messages: AssistantMessage[],
): Promise<AssistantReply> {
  const provider = pickProvider();
  if (!provider) throw new Error("ASSISTANT_NOT_CONFIGURED");
  const snapshot = await buildBusinessSnapshot();
  const system = `${SYSTEM_BASE}${SYSTEM_ACTIONS}\n\n=== DATOS ACTUALES DEL NEGOCIO ===\n${snapshot}`;
  const normalized = normalizeTurns(messages);
  if (normalized.length === 0) throw new Error("ASSISTANT_EMPTY_INPUT");

  const text =
    provider === "anthropic"
      ? await callAnthropic(system, normalized)
      : await callGemini(system, normalized);
  if (!text) throw new Error("ASSISTANT_EMPTY_REPLY");

  const block = parseActionBlock(text);
  if (block) {
    const tool = findTool(block.name);
    if (tool) {
      const parsed = tool.parse(block.raw);
      if (parsed.ok) {
        return {
          type: "action",
          name: block.name,
          args: parsed.args,
          summary: parsed.summary,
        };
      }
      return {
        type: "text",
        text: `Para hacer eso necesito un dato más: ${parsed.error}`,
      };
    }
  }
  return { type: "text", text };
}
