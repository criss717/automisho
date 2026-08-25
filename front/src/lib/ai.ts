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
