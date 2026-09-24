import { generateText } from "ai";
import { getCommandCodeModel, isCommandCodeConfigured, VISION_MODEL } from "@/lib/ai";
import type { CarResult, VisualAudit } from "@/types";

export interface VisionAuditOptions {
  requestedDoors?: number;
  userQuery?: string;
  price?: number | string;
  description?: string | null;
  targetCount?: number;
}

/**
 * Audits a single car image using Vision AI (Command Code GOAT provider).
 * Evaluates doors, color, body style, condition, flip/resale potential, and user query match.
 */
export async function auditSingleCarImage(
  imageUrl: string,
  carTitle: string,
  options?: VisionAuditOptions | number
): Promise<VisualAudit | null> {
  if (!imageUrl || !imageUrl.startsWith("http")) return null;
  const lowerUrl = imageUrl.toLowerCase();
  if (lowerUrl.includes(".svg") || lowerUrl.includes("logo") || lowerUrl.includes("placeholder")) {
    return null;
  }

  const opts: VisionAuditOptions =
    typeof options === "number" ? { requestedDoors: options } : options || {};

  try {
    // 1. Fetch the image buffer with 12s timeout
    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => fetchController.abort(), 12000);

    const imgRes = await fetch(imageUrl, {
      signal: fetchController.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    clearTimeout(fetchTimeout);

    if (!imgRes.ok) return null;
    const rawContentType = (imgRes.headers.get("content-type") || "image/jpeg").toLowerCase();
    if (rawContentType.includes("svg") || rawContentType.includes("html") || rawContentType.includes("xml")) {
      return null;
    }
    const supportedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const contentType = supportedTypes.find((t) => rawContentType.includes(t.replace("image/", ""))) || "image/jpeg";
    const arrayBuf = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    const userContext = opts.userQuery
      ? `Requisitos estrictos solicitados por el usuario: "${opts.userQuery}"`
      : "Inspección técnica general para compraventa de ocasión en España";

    const descriptionContext = opts.description
      ? `\nDescripción/detalles publicados por el vendedor:\n"${opts.description.slice(0, 700)}"`
      : "";

    const prompt = `Eres el Auditor Técnico Oficial de AutoMisho. Analiza conjuntamente la fotografía y el texto de este anuncio en venta ("${carTitle}"${opts.price ? `, precio: ${opts.price}` : ""}).
${userContext}${descriptionContext}

Realiza una auditoría exhaustiva contrastando la imagen y la descripción del anuncio con lo que busca el usuario:
1. "color": Color principal exterior de la carrocería visible en la foto (ej: "rojo", "negro", "blanco", "gris/plata", "azul", "verde", "amarillo", "marrón").
2. "bodyType": Tipo de carrocería ("descapotable/cabrio", "coupé", "utilitario/compacto", "sedán/berlina", "familiar/station wagon", "suv/monovolumen").
3. "doors": Número de puertas laterales (3 si es utilitario 3p o coupé, 5 si es 4 puertas + portón, null si no se distingue).
4. "verified3p": true si es 3 puertas / coupé / cabrio, false en caso contrario.
5. "bodyCondition": Estado exterior en 1 frase (pintura, brillo de faros, abolladuras, arañazos o piezas desgastadas).
6. "userCriteriaMatch": true si cumple fielmente lo que busca el usuario. false si viola CUALQUIER requisito expresado por el usuario (ej: color excluido o no pedido, marca no deseada, potencia insuficiente para su objetivo, o anomalías/averías no solicitadas en la descripción).
7. "rejectionReason": Si userCriteriaMatch es false, explica en 1 frase concisa por qué se rechaza (ej: "El coche es de color negro en la foto y el usuario pidió exclusivamente blanco, azul, gris o rojo", o "La descripción indica avería de culata/para piezas"). Si cumple, déjalo en null.
8. "criteriaNotes": 1 frase explicando cómo encaja con lo que busca el usuario.
9. "flipOpportunity":
   - "flipPotential": "Alto" | "Medio" | "Bajo" | null
   - "damageSummary": Daños visibles en chapa/ópticas ("Sin daños aparentes" o descripción)
   - "estimatedRepairCost": Estimación orientativa de arreglo (ej: "0€", "100-200€ pintura")

Responde ÚNICAMENTE un JSON válido con este formato:
{
  "color": "rojo",
  "bodyType": "utilitario/compacto",
  "doors": 3,
  "verified3p": true,
  "bodyCondition": "Pintura con brillo, sin golpes visibles",
  "userCriteriaMatch": true,
  "rejectionReason": null,
  "criteriaNotes": "Cumple los criterios solicitados por el usuario",
  "flipOpportunity": {
    "flipPotential": "Alto",
    "damageSummary": "Sin daños aparentes",
    "estimatedRepairCost": "0€"
  }
}`;

    let responseText = "";

    // 2. GOAT-only vision call via Command Code Provider (vision-capable model).
    if (isCommandCodeConfigured()) {
      try {
        const visionModel = getCommandCodeModel(VISION_MODEL);
        const result = await generateText({
          model: visionModel,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "file", data: buffer, mediaType: contentType },
              ],
            },
          ],
          abortSignal: AbortSignal.timeout(35000),
        });
        responseText = result.text;
      } catch (visionErr) {
        console.warn("[vision] CommandCode Vision error for", carTitle, ":", (visionErr as Error).message);
      }
    }

    if (!responseText) return null;

    // 4. Parse JSON from output (outermost braces to preserve nested objects)
    const startIdx = responseText.indexOf("{");
    const endIdx = responseText.lastIndexOf("}");
    if (startIdx === -1 || endIdx <= startIdx) return null;

    const jsonStr = responseText.slice(startIdx, endIdx + 1);
    const parsed = JSON.parse(jsonStr);
    const doors = typeof parsed.doors === "number" ? parsed.doors : null;
    const bodyCondition = typeof parsed.bodyCondition === "string" ? parsed.bodyCondition.trim() : undefined;
    const verified3p = parsed.verified3p === true || doors === 3;
    const colorDetected = typeof parsed.color === "string" ? parsed.color.trim().toLowerCase() : null;
    const bodyTypeDetected = typeof parsed.bodyType === "string" ? parsed.bodyType.trim() : null;
    const userCriteriaMatch = typeof parsed.userCriteriaMatch === "boolean" ? parsed.userCriteriaMatch : null;
    const criteriaNotes = typeof parsed.criteriaNotes === "string" ? parsed.criteriaNotes.trim() : null;
    const rejectionReason = typeof parsed.rejectionReason === "string" ? parsed.rejectionReason.trim() : null;

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
      rejectionReason,
      flipOpportunity,
    };
  } catch (err) {
    console.warn("[vision] auditSingleCarImage error for", carTitle, ":", (err as Error).message);
    return null;
  }
}

/**
 * Runs vision audits in bounded batches (default 2 at a time) to avoid
 * provider rate limits while keeping total latency acceptable.
 */
async function auditInBatches(
  cars: CarResult[],
  auditOne: (car: CarResult) => Promise<CarResult>,
  batchSize: number
): Promise<PromiseSettledResult<CarResult>[]> {
  const results: PromiseSettledResult<CarResult>[] = [];
  for (let i = 0; i < cars.length; i += batchSize) {
    const batch = cars.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(auditOne));
    results.push(...settled);
  }
  return results;
}

/**
 * Audits a batch of cars with bounded concurrency (2 at a time),
 * enriching them with visual inspection data.
 */
export async function auditCarVisuals(
  cars: CarResult[],
  options?: VisionAuditOptions | number
): Promise<CarResult[]> {
  if (!cars || cars.length === 0) return cars;

  const opts: VisionAuditOptions =
    typeof options === "number" ? { requestedDoors: options } : options || {};
  const requestedDoors = opts.requestedDoors;

  // Dynamically audit enough candidates to satisfy requested count (default 6-8)
  const targetCount = opts.targetCount || 6;
  const auditBudget = Math.min(cars.length, Math.max(5, targetCount));
  const candidatePool = cars.slice(0, auditBudget);
  const remainingCars = cars.slice(auditBudget);

  const auditOne = async (car: CarResult): Promise<CarResult> => {
    if (!car.image_url) return car;

    const visualAudit = await auditSingleCarImage(car.image_url, car.title, {
      ...opts,
      price: car.price,
      description: car.description,
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
        enrichedCar.score = Math.max(40, enrichedCar.score - 40);
      }
      const reason = visualAudit.rejectionReason || visualAudit.criteriaNotes || "No cumple con las preferencias expresadas";
      cons.unshift(`⛔ Descartado por IA: ${reason}`);
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
  };

  const settled = await auditInBatches(candidatePool, auditOne, 2);
  const auditedPool = settled.map((res, i) => (res.status === "fulfilled" ? res.value : candidatePool[i]));

  // Re-sort: cars matching user criteria first, then by score
  auditedPool.sort((a, b) => {
    const aMatch = a.visualAudit?.userCriteriaMatch === true ? 1 : a.visualAudit?.userCriteriaMatch === false ? -1 : 0;
    const bMatch = b.visualAudit?.userCriteriaMatch === true ? 1 : b.visualAudit?.userCriteriaMatch === false ? -1 : 0;
    if (aMatch !== bMatch) return bMatch - aMatch;
    return (Number(b.score) || 0) - (Number(a.score) || 0);
  });

  // If user requested 3 doors, re-filter if vision confirmed 5 doors and we have other 3p cars
  let finalCars = [...auditedPool, ...remainingCars];
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
