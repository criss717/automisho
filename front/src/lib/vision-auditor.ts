import { generateText } from "ai";
import {
  getGeminiModel,
  getOpenCodeModel,
  isGeminiConfigured,
  isOpenCodeConfigured,
  GEMINI_MODEL,
  CHAT_MODEL,
} from "@/lib/ai";
import type { CarResult, VisualAudit } from "@/types";

export interface VisionAuditOptions {
  requestedDoors?: number;
  userQuery?: string;
  price?: number | string;
}

/**
 * Audits a single car image using Vision AI (OpenCode Go primary, Google Gemini fallback).
 * Evaluates doors, color, body style, condition, flip/resale potential, and user query match.
 */
export async function auditSingleCarImage(
  imageUrl: string,
  carTitle: string,
  options?: VisionAuditOptions | number
): Promise<VisualAudit | null> {
  if (!imageUrl || !imageUrl.startsWith("http")) return null;

  const opts: VisionAuditOptions =
    typeof options === "number" ? { requestedDoors: options } : options || {};

  try {
    // 1. Fetch the image buffer with strict 2.5s timeout
    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => fetchController.abort(), 2500);

    const imgRes = await fetch(imageUrl, {
      signal: fetchController.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    clearTimeout(fetchTimeout);

    if (!imgRes.ok) return null;
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const arrayBuf = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    const userContext = opts.userQuery
      ? `Petición / Preferencias del usuario: "${opts.userQuery}"`
      : "Inspección técnica general para compraventa de ocasión en España";

    const prompt = `Analiza la fotografía de este coche en venta ("${carTitle}"${opts.price ? `, precio: ${opts.price}` : ""}).
${userContext}

Identifica e inspecciona visualmente:
1. "color": Color principal exterior de la carrocería (ej: "rojo", "negro", "blanco", "gris/plata", "azul", "verde", "amarillo").
2. "bodyType": Tipo de carrocería visible ("descapotable/cabrio", "coupé", "utilitario/compacto", "sedán/berlina", "familiar", "suv").
3. "doors": Número de puertas laterales (3 si es utilitario 3p o coupé, 5 si es 4 puertas + portón, null si no se distingue).
4. "verified3p": true si es 3 puertas / coupé / cabrio de 2 plazas, false en caso contrario.
5. "bodyCondition": Estado exterior en 1 frase (pintura, brillo de faros, si hay arañazos, abolladuras o daños visibles).
6. "userCriteriaMatch": true si cumple con lo solicitado por el usuario (ej. color pedido, descapotable, reventa, etc.), false si no cumple, o null si la búsqueda no especificó requisitos concretos.
7. "criteriaNotes": 1 frase explicando cómo encaja con lo que busca el usuario.
8. "flipOpportunity": Evaluación de oportunidad de negocio / reventa:
   - "flipPotential": "Alto" | "Medio" | "Bajo" | null
   - "damageSummary": Daños visibles en chapa/ópticas ("Sin daños aparentes" o descripción breve)
   - "estimatedRepairCost": Estimación orientativa de arreglo si hay daños (ej: "50-100€ pulido", "0€")

Responde ÚNICAMENTE un JSON válido con este formato:
{
  "color": "rojo",
  "bodyType": "descapotable/cabrio",
  "doors": 3,
  "verified3p": true,
  "bodyCondition": "Faros limpios, pintura en buen estado aparente, sin golpes visibles",
  "userCriteriaMatch": true,
  "criteriaNotes": "Cumple los criterios solicitados por el usuario",
  "flipOpportunity": {
    "flipPotential": "Alto",
    "damageSummary": "Sin daños aparentes, precio atractivo para reventa",
    "estimatedRepairCost": "0€"
  }
}`;

    let responseText = "";

    // 2. Try OpenCode Go Vision first (if configured)
    if (isOpenCodeConfigured()) {
      try {
        const openCodeModel = getOpenCodeModel(CHAT_MODEL);
        const result = await generateText({
          model: openCodeModel,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "file", data: buffer, mediaType: contentType },
              ],
            },
          ],
          abortSignal: AbortSignal.timeout(3500),
        });
        responseText = result.text;
      } catch (openCodeErr) {
        console.warn("[vision] OpenCode Vision failed, falling back to Gemini:", (openCodeErr as Error).message);
      }
    }

    // 3. Fallback to Google Gemini Vision (multimodal nativo)
    if (!responseText && isGeminiConfigured()) {
      try {
        const geminiModel = getGeminiModel(GEMINI_MODEL);
        const result = await generateText({
          model: geminiModel,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "file", data: buffer, mediaType: contentType },
              ],
            },
          ],
          abortSignal: AbortSignal.timeout(4000),
        });
        responseText = result.text;
      } catch (geminiErr) {
        console.warn("[vision] Gemini Vision error:", (geminiErr as Error).message);
      }
    }

    if (!responseText) return null;

    // 4. Parse JSON from output
    const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    const doors = typeof parsed.doors === "number" ? parsed.doors : null;
    const bodyCondition = typeof parsed.bodyCondition === "string" ? parsed.bodyCondition.trim() : undefined;
    const verified3p = parsed.verified3p === true || doors === 3;
    const colorDetected = typeof parsed.color === "string" ? parsed.color.trim().toLowerCase() : null;
    const bodyTypeDetected = typeof parsed.bodyType === "string" ? parsed.bodyType.trim() : null;
    const userCriteriaMatch = typeof parsed.userCriteriaMatch === "boolean" ? parsed.userCriteriaMatch : null;
    const criteriaNotes = typeof parsed.criteriaNotes === "string" ? parsed.criteriaNotes.trim() : null;

    let flipOpportunity = null;
    if (parsed.flipOpportunity && typeof parsed.flipOpportunity === "object") {
      flipOpportunity = {
        flipPotential: parsed.flipOpportunity.flipPotential || null,
        damageSummary: parsed.flipOpportunity.damageSummary || null,
        estimatedRepairCost: parsed.flipOpportunity.estimatedRepairCost || null,
      };
    }

    return {
      doorsDetected: doors,
      bodyCondition,
      verified3p,
      colorDetected,
      bodyTypeDetected,
      userCriteriaMatch,
      criteriaNotes,
      flipOpportunity,
    };
  } catch (err) {
    console.warn("[vision] auditSingleCarImage error for", carTitle, ":", (err as Error).message);
    return null;
  }
}

/**
 * Audits a batch of cars in parallel, enriching them with visual inspection data.
 */
export async function auditCarVisuals(
  cars: CarResult[],
  options?: VisionAuditOptions | number
): Promise<CarResult[]> {
  if (!cars || cars.length === 0) return cars;

  const opts: VisionAuditOptions =
    typeof options === "number" ? { requestedDoors: options } : options || {};
  const requestedDoors = opts.requestedDoors;

  // Audit up to the top 4 candidates to keep latency under 2.5s
  const topCandidates = cars.slice(0, 4);
  const remainingCars = cars.slice(4);

  const auditPromises = topCandidates.map(async (car) => {
    if (!car.image_url) return car;

    const visualAudit = await auditSingleCarImage(car.image_url, car.title, {
      ...opts,
      price: car.price,
    });
    if (!visualAudit) return car;

    const enrichedCar = { ...car, visualAudit };
    const pros = [...(enrichedCar.pros || [])];
    const cons = [...(enrichedCar.cons || [])];

    // Doors validation
    if (visualAudit.verified3p) {
      enrichedCar.doors = 3;
      pros.unshift("✓ Carrocería de 3 puertas confirmada por Visión IA");
    } else if (requestedDoors === 3 && visualAudit.doorsDetected === 5) {
      cons.unshift("⚠ Visión IA detectó 5 puertas en la fotografía");
      if (typeof enrichedCar.score === "number") {
        enrichedCar.score -= 40;
      }
    }

    // User Criteria match
    if (visualAudit.userCriteriaMatch === true) {
      if (typeof enrichedCar.score === "number") {
        enrichedCar.score = Math.min(99, enrichedCar.score + 10);
      }
      if (visualAudit.criteriaNotes) {
        pros.unshift(`✓ Visión IA: ${visualAudit.criteriaNotes}`);
      }
    } else if (visualAudit.userCriteriaMatch === false) {
      if (typeof enrichedCar.score === "number") {
        enrichedCar.score = Math.max(50, enrichedCar.score - 25);
      }
      if (visualAudit.criteriaNotes) {
        cons.unshift(`⚠ Visión IA: ${visualAudit.criteriaNotes}`);
      }
    }

    // Color & Body type
    if (visualAudit.colorDetected && opts.userQuery?.toLowerCase().includes(visualAudit.colorDetected)) {
      pros.push(`Color verificado: ${visualAudit.colorDetected}`);
    }
    if (visualAudit.bodyTypeDetected && opts.userQuery) {
      const qLower = opts.userQuery.toLowerCase();
      if (qLower.includes("descapotable") || qLower.includes("cabrio") || qLower.includes("coupe") || qLower.includes("coupé")) {
        pros.push(`Carrocería confirmada: ${visualAudit.bodyTypeDetected}`);
      }
    }

    // Flip / Resale Opportunity
    if (visualAudit.flipOpportunity?.flipPotential && ["Alto", "Medio"].includes(visualAudit.flipOpportunity.flipPotential)) {
      pros.push(
        `Oportunidad Reventa: Potencial ${visualAudit.flipOpportunity.flipPotential} (${visualAudit.flipOpportunity.damageSummary || "buen margen"})`
      );
    }

    // Body condition
    if (visualAudit.bodyCondition) {
      pros.push(`Inspección visual: ${visualAudit.bodyCondition}`);
    }

    enrichedCar.pros = pros;
    enrichedCar.cons = cons;
    return enrichedCar;
  });

  const settled = await Promise.allSettled(auditPromises);
  const auditedTop = settled.map((res, i) => (res.status === "fulfilled" ? res.value : topCandidates[i]));

  // Re-sort: cars matching user criteria first, then by score
  auditedTop.sort((a, b) => {
    const aMatch = a.visualAudit?.userCriteriaMatch === true ? 1 : 0;
    const bMatch = b.visualAudit?.userCriteriaMatch === true ? 1 : 0;
    if (aMatch !== bMatch) return bMatch - aMatch;
    return (Number(b.score) || 0) - (Number(a.score) || 0);
  });

  // If user requested 3 doors, re-filter if vision confirmed 5 doors and we have other 3p cars
  let finalCars = [...auditedTop, ...remainingCars];
  if (requestedDoors === 3) {
    const verified3pCars = finalCars.filter(
      (c) => !c.visualAudit || c.visualAudit.doorsDetected !== 5
    );
    if (verified3pCars.length > 0) {
      finalCars = verified3pCars;
    }
  }

  return finalCars;
}
