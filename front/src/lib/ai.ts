import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";

const baseURL = process.env.OPENCODE_BASE_URL;
const apiKey = process.env.OPENCODE_API_KEY;

if (!baseURL) throw new Error("OPENCODE_BASE_URL is not set in .env.local");
if (!apiKey) throw new Error("OPENCODE_API_KEY is not set in .env.local");

// OpenCode Go tiene dos familias de endpoints según el modelo:
// - /chat/completions (OpenAI compatible) -> kimi, deepseek, glm, grok...
// - /messages (Anthropic) -> qwen, minimax...
// Docs: https://opencode.ai/docs/es/go#endpoints
export const opencode = createOpenAICompatible({
  name: "opencode-go",
  baseURL,
  apiKey,
});

export const opencodeAnthropic = createAnthropic({
  baseURL,
  apiKey,
} as unknown as Record<string, unknown>);

export const CHAT_MODEL = process.env.OPENCODE_MODEL || "qwen3.7-plus";

// Helper para elegir el provider correcto según el modelo
const ANTHROPIC_MODELS = ["qwen", "minimax"];
export function getChatModel(modelId: string = CHAT_MODEL) {
  const lower = modelId.toLowerCase();
  const isAnthropic = ANTHROPIC_MODELS.some((p) => lower.includes(p));
  if (isAnthropic) {
    // endpoint https://opencode.ai/zen/go/v1/messages via @ai-sdk/anthropic
    return opencodeAnthropic(modelId);
  }
  // endpoint https://opencode.ai/zen/go/v1/chat/completions via openai-compatible
  return opencode(modelId);
}

export const AUTOMISHO_SYSTEM_PROMPT = `Eres AutoMisho, el copiloto IA experto en compraventa de coches de segunda mano en España.

Tu misión: ayudar al usuario a encontrar el coche perfecto según sus necesidades, presupuesto y situación personal.

## Cómo funciona el sistema

Cuando el usuario pregunta por coches o menciona una matrícula, el sistema automáticamente busca datos reales en AutoScout24, coches.net y Wallapop, y consulta la DGT. Si recibes datos reales en el contexto, SIEMPRE úsalos para responder — NUNCA inventes datos de vehículos.

## Estilo
- Amigable pero directo y profesional
- Respuestas claras y estructuradas
- Cuando muestres vehículos, incluye: precio, año, kilómetros, fuente, enlace si hay
- Detecta alertas rojas: precios muy bajos, ITV vencida, km sospechosos
- Si hay muchos resultados, destaca los 3-5 mejores según el criterio del usuario
- Si no hay datos reales, di que no pudiste buscar y pide más detalles

Idioma: Español de España.`;
