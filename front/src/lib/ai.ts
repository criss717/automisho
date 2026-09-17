import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export const CHAT_MODEL = process.env.DEFAULT_AGENT_MODEL || process.env.COMMANDCODE_MODEL || "meta/muse-spark-1.3";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export function isCommandCodeConfigured(): boolean {
  return Boolean(process.env.COMMANDCODE_API_KEY);
}

export function isOpenCodeConfigured(): boolean {
  return Boolean(process.env.OPENCODE_API_KEY && process.env.OPENCODE_BASE_URL);
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function getCommandCodeModel(modelId: string = CHAT_MODEL) {
  const baseURL = process.env.COMMANDCODE_BASE_URL || "https://api.commandcode.ai/provider/v1";
  const apiKey = process.env.COMMANDCODE_API_KEY || "";
  const ccProvider = createOpenAICompatible({
    name: "commandcode-provider",
    baseURL,
    apiKey,
  });
  return ccProvider(modelId);
}

// OpenCode Go tiene dos familias de endpoints según el modelo:
// - /chat/completions (OpenAI compatible) -> kimi, deepseek, glm, grok...
// - /messages (Anthropic) -> qwen, minimax...
// Docs: https://opencode.ai/docs/es/go#endpoints
const ANTHROPIC_MODELS = ["qwen", "minimax"];

export function getOpenCodeModel(modelId: string = CHAT_MODEL) {
  const baseURL = process.env.OPENCODE_BASE_URL || "https://opencode.ai/zen/go/v1";
  const apiKey = process.env.OPENCODE_API_KEY || "";
  const lower = modelId.toLowerCase();
  const isAnthropic = ANTHROPIC_MODELS.some((p) => lower.includes(p));

  if (isAnthropic) {
    const opencodeAnthropic = createAnthropic({
      baseURL,
      apiKey,
    } as unknown as Record<string, unknown>);
    return opencodeAnthropic(modelId);
  }

  const opencode = createOpenAICompatible({
    name: "opencode-go",
    baseURL,
    apiKey,
  });
  return opencode(modelId);
}

export function getGeminiModel(modelId: string = GEMINI_MODEL) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in .env.local");
  }
  const google = createGoogleGenerativeAI({
    apiKey,
  });
  return google(modelId);
}

/**
 * Obtiene el modelo activo según configuración:
 * 1. Command Code Provider API (Muse Spark 1.3 u otro) si está configurado
 * 2. OpenCode Go si está configurado
 * 3. Google Gemini como fallback
 */
export function getChatModel(modelId: string = CHAT_MODEL) {
  if (isCommandCodeConfigured()) {
    return getCommandCodeModel(modelId);
  }
  if (isOpenCodeConfigured()) {
    return getOpenCodeModel(modelId);
  }
  if (isGeminiConfigured()) {
    return getGeminiModel(GEMINI_MODEL);
  }
  // Fallback a Command Code con defaults
  return getCommandCodeModel(modelId);
}

export const AUTOMISHO_SYSTEM_PROMPT = `Eres AutoMisho, el copiloto IA experto en compraventa y negociación de coches de segunda mano en España.

Tu misión: acompañar al usuario en TODO el proceso de compra de forma crítica y técnica:
1. Buscar y filtrar las mejores oportunidades del mercado en tiempo real (AutoScout24, Coches.net, Wallapop, Milanuncios).
2. Asesorar y preparar al usuario para la llamada telefónica al vendedor.
3. Auditar lo que le contó el vendedor o los informes oficiales (DGT, ITV, CarVertical, Carfax) detectando fraudes y contradicciones.
4. Elaborar estrategias de negociación y contraoferta justificada.

## REGLAS CRÍTICAS
- NUNCA inventes datos técnicos ni menciones "simulaciones demo". Si el sistema te da datos reales de DGT o del mercado, úsalos con precisión.
- Si el usuario comparte una matrícula o bastidor, usa los datos calculados por el sistema (fecha oficial de matriculación y distintivo ambiental DGT).
- Cuando recomiendes opciones de coches:
  - Destaca los 3 a 5 mejores ordenados por puntuación/relación calidad-precio.
  - Para cada uno muestra: Marca/Modelo, Precio, Año, Kilometraje, Combustible, Puntuación IA, Ventajas, Puntos a revisar y Link directo al anuncio.
  - Concluye SIEMPRE invitando proactivamente al usuario a llamar a los vendedores con las 3 preguntas clave (facturas de mantenimientos críticos como distribución/embrague, matrícula exacta o VIN, y motivo de venta/titulares).
- Cuando el usuario te cuente lo que le dijo el vendedor:
  - Analiza si la matrícula coincide cronológicamente con el año del anuncio.
  - Alerta de inconsistencias típicas (ej. cambios de piezas sin factura demostrable, coche rematriculado, kilometraje sospechoso).
  - Prepara una contraoferta recomendada con argumentos técnicos sólidos para rebajar el precio.

Idioma: Español de España, tono profesional, amigable, experto y protector del comprador.`;
