import { generateObject } from "ai";
import { z } from "zod";
import { getCommandCodeModel, isCommandCodeConfigured } from "./ai";

export const UserIntentSchema = z.object({
  isSearch: z.boolean().default(true).describe("true si el usuario solicita buscar, ver opciones, comparar o comprar vehículos en el mercado"),
  query: z.string().default("").describe("Marca y modelo específicos si los pidió (ej: 'seat ibiza', 'golf') o vacío '' si busca por requisitos generales (como viajes largos, potencia, etc.)"),
  wantedMakes: z.array(z.string()).default([]).describe("Marcas que el usuario solicita o desea incluir (ej: ['seat', 'volkswagen', 'ford']). Si el usuario dice 'sumamos peugeot', pon peugeot aquí."),
  excludedMakes: z.array(z.string()).default([]).describe("Marcas que el usuario PROHÍBE o descarta (ej: 'no opel ni peugeot ni chevrolet' -> ['opel', 'peugeot', 'chevrolet'])."),
  maxPrice: z.number().nullish().default(null).describe("Precio o presupuesto máximo en euros (ej: 3000)"),
  minPrice: z.number().nullish().default(null).describe("Precio mínimo en euros si fue indicado"),
  doors: z.number().nullish().default(null).describe("Número de puertas exigido (ej: 3, 4, 5)"),
  colors: z.array(z.string()).default([]).describe("Colores aceptados por el usuario. Si en el historial pidió blanco y negro, y ahora dice 'sumamos también los rojos', la lista DEBE ser ['blanco', 'negro', 'rojo']."),
  fuel: z.string().nullish().default(null).describe("Tipo de combustible si lo especificó (diesel, gasolina, etc.)"),
  minCv: z.number().nullish().default(null).describe("Potencia mínima en CV si la mencionó (ej: 70 u 80)"),
  bodyType: z.string().nullish().default(null).describe("Tipo de carrocería (berlina, familiar, suv, utilitario, coupe, cabrio)"),
  plate: z.string().nullish().default(null).describe("Matrícula española si mencionó alguna para auditar (ej: '1234BBB')"),
  vin: z.string().nullish().default(null).describe("Número de bastidor VIN de 17 caracteres si mencionó alguno"),
  targetCount: z.number().nullish().default(6).describe("Cantidad exacta de coches que el usuario pidió ver (ej: 6 o 7). Por defecto 6."),
});

export type UserIntent = z.infer<typeof UserIntentSchema>;

/**
 * Classifies user intent using the LLM with strict structured output.
 * Takes the full message history to resolve contextual references,
 * additive filters ('sumamos rojo'), and brand un-exclusions naturally.
 */
export async function classifyUserIntent(
  messages: Array<{ role: string; content?: string; parts?: Array<{ type: string; text?: string }> }>
): Promise<UserIntent> {
  const defaultIntent: UserIntent = {
    isSearch: false,
    query: "",
    wantedMakes: [],
    excludedMakes: [],
    maxPrice: null,
    minPrice: null,
    doors: null,
    colors: [],
    fuel: null,
    minCv: null,
    bodyType: null,
    plate: null,
    vin: null,
    targetCount: 6,
  };

  if (!isCommandCodeConfigured()) {
    return defaultIntent;
  }

  // Format conversation history for context
  const conversationHistory = messages.map((m) => {
    const text =
      m.content ||
      (m.parts as Array<{ type: string; text?: string }>)
        ?.filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("") ||
      "";
    return `${m.role.toUpperCase()}: ${text}`;
  }).join("\n");

  const prompt = `Analiza la siguiente conversación entre un usuario y AutoMisho (asistente de compra de coches en España).
Tu tarea es clasificar la intención y extraer los filtros estructurados del usuario teniendo en cuenta TODO el historial de la conversación.

REGLAS CRÍTICAS DE EXTRACCIÓN:
1. "query": Pon ÚNICAMENTE marca y modelo concretos (ej: "seat leon", "golf"). Si el usuario describe necesidades generales ("para viajes largos", "más de 80cv", "barato"), deja "query" vacío (""). NUNCA metas frases conversacionales ni negaciones en query.
2. "excludedMakes": Marcas que el usuario explícitamente descartó o dijo que NO quiere (ej: "no opel ni peugeot ni chevrolet" -> ["opel", "peugeot", "chevrolet"]).
3. "wantedMakes": Si el usuario pide marcas concretas o si en un mensaje posterior dice "sumamos peugeot" o "incluye peugeot", retira peugeot de excludedMakes y ponlo en wantedMakes. NUNCA tomes palabras gramaticales (como "los", "las", "el", "coche", "rojos") como marcas.
4. "colors": Si el usuario pide colores (ej: "blanco o negro") y luego dice "y mete también los rojos", COMBINA los colores: ["blanco", "negro", "rojo"]. NO borres los colores anteriores a menos que diga "cualquier color" o "cambia a solo rojo".
5. "maxPrice": Presupuesto tope en euros. Si se fijó en un mensaje anterior (ej: 3000€) y no se cambió, manténlo.
6. "minCv": Si pidió mínimo de CV (ej: "minimo 80 cv", "minimo 70 cv"), extrae el número entero.

Historial de conversación:
${conversationHistory}
`;

  try {
    const model = getCommandCodeModel("deepseek/deepseek-v4-flash");
    const { object } = await generateObject({
      model,
      schema: UserIntentSchema,
      prompt,
      abortSignal: AbortSignal.timeout(25000),
    });
    return object;
  } catch (err) {
    console.warn("[intent-classifier] LLM classification error, using fallback:", err);
    // Graceful fallback for essential params if LLM timed out
    const lastMsg = messages[messages.length - 1];
    const lastText =
      lastMsg?.content ||
      (lastMsg?.parts as Array<{ type: string; text?: string }>)
        ?.filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("") ||
      "";
    const lastLower = lastText.toLowerCase();
    const priceMatch = lastText.match(/(\d[\d.,]*)\s*(?:€|euros?|k)/i);
    const maxP = priceMatch ? parseInt(priceMatch[1].replace(/[.,]/g, ""), 10) : null;
    const fallbackExcluded: string[] = [];
    if (/opel/i.test(lastLower) && /no|sin|menos/i.test(lastLower)) fallbackExcluded.push("opel");
    if (/peugeot|pegout/i.test(lastLower) && /no|sin|menos/i.test(lastLower)) fallbackExcluded.push("peugeot");
    if (/chevrolet/i.test(lastLower) && /no|sin|menos/i.test(lastLower)) fallbackExcluded.push("chevrolet");
    const fallbackColors: string[] = [];
    if (/blanco/i.test(lastLower)) fallbackColors.push("blanco");
    if (/negro/i.test(lastLower)) fallbackColors.push("negro");
    if (/rojo/i.test(lastLower)) fallbackColors.push("rojo");
    if (/azul/i.test(lastLower)) fallbackColors.push("azul");
    if (/gris/i.test(lastLower)) fallbackColors.push("gris");

    return {
      ...defaultIntent,
      isSearch: /(?:coche|coches|opciones|busco|quiero|viaje|presupuesto)/i.test(lastText),
      maxPrice: maxP && maxP > 100 ? maxP : null,
      excludedMakes: fallbackExcluded,
      colors: fallbackColors,
    };
  }
}
