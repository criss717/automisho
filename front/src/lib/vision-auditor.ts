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
  imageUrlOrUrls: string | string[],
  carTitle: string,
  options?: VisionAuditOptions | number
): Promise<VisualAudit | null> {
  const urls = (Array.isArray(imageUrlOrUrls) ? imageUrlOrUrls : [imageUrlOrUrls])
    .filter((u): u is string => typeof u === "string" && u.startsWith("http"))
    .filter((u) => {
      const lower = u.toLowerCase();
      return (
        !lower.endsWith(".mp4") &&
        !lower.includes(".mp4?") &&
        !lower.endsWith(".webm") &&
        !lower.endsWith(".mov") &&
        !lower.endsWith(".m3u8") &&
        !lower.includes(".svg") &&
        !lower.includes("logo") &&
        !lower.includes("placeholder")
      );
    });

  if (urls.length === 0) return null;

  const opts: VisionAuditOptions =
    typeof options === "number" ? { requestedDoors: options } : options || {};

  try {
    // 1. Fetch up to 2 sample images in parallel with 12s timeout
    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => fetchController.abort(), 12000);

    const downloadPromises = urls.slice(0, 2).map(async (u) => {
      try {
        const imgRes = await fetch(u, {
          signal: fetchController.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });
        if (!imgRes.ok) return null;
        const rawContentType = (imgRes.headers.get("content-type") || "image/jpeg").toLowerCase();
        if (
          rawContentType.includes("svg") ||
          rawContentType.includes("html") ||
          rawContentType.includes("xml") ||
          rawContentType.includes("video") ||
          rawContentType.includes("text")
        ) {
          return null;
        }
        const supportedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        const contentType = supportedTypes.find((t) => rawContentType.includes(t.replace("image/", ""))) || "image/jpeg";
        const arrayBuf = await imgRes.arrayBuffer();
        return { buffer: Buffer.from(arrayBuf), contentType, url: u };
      } catch {
        return null;
      }
    });

    const settled = await Promise.allSettled(downloadPromises);
    clearTimeout(fetchTimeout);

    const validBuffers: Array<{ buffer: Buffer; contentType: string; url: string }> = [];
    for (const res of settled) {
      if (res.status === "fulfilled" && res.value !== null) {
        validBuffers.push(res.value);
      }
    }

    if (validBuffers.length === 0) return null;

    const userContext = opts.userQuery
      ? `Requisitos estrictos solicitados por el usuario: "${opts.userQuery}"`
      : "Inspección técnica general para compraventa de ocasión en España";

    const descriptionContext = opts.description
      ? `\nDescripción/detalles publicados por el vendedor:\n"${opts.description.slice(0, 700)}"`
      : "";

    const prompt = `Eres el Auditor Técnico Oficial de AutoMisho. Analiza conjuntamente las fotografías adjuntas (${validBuffers.length} fotos: exterior e interior/puesto de mando si están disponibles) y el texto de este anuncio en venta ("${carTitle}"${opts.price ? `, precio: ${opts.price}` : ""}).
${userContext}${descriptionContext}

Realiza una auditoría visual técnica contrastando las fotografías y la descripción del anuncio con lo que busca el usuario:
1. "color": Color principal exterior de la carrocería visible en las fotos (ej: "rojo", "negro", "blanco", "gris/plata", "azul", "verde", "amarillo", "marrón").
2. "bodyType": Tipo de carrocería ("descapotable/cabrio", "coupé", "utilitario/compacto", "sedán/berlina", "familiar/station wagon", "suv/monovolumen").
3. "doors": Número de puertas laterales (3 si es utilitario 3p o coupé, 5 si es 4 puertas + portón, null si no se distingue).
4. "verified3p": true si es 3 puertas / coupé / cabrio, false en caso contrario.
5. "bodyCondition": Estado general en 1 frase (chapa/pintura exterior, brillo de faros, abolladuras, y estado de volante/tapicería interior si se muestra).
6. "userCriteriaMatch": true si cumple fielmente lo que busca el usuario. false si viola CUALQUIER requisito expresado por el usuario (ej: color excluido o no pedido, marca no deseada, potencia insuficiente para su objetivo, o anomalías/averías no solicitadas en la descripción).
7. "rejectionReason": Si userCriteriaMatch es false, explica en 1 frase concisa por qué se rechaza (ej: "El coche es de color negro en la foto y el usuario pidió exclusivamente blanco, azul, gris o rojo", o "La descripción indica avería de culata/para piezas"). Si cumple, déjalo en null.
8. "criteriaNotes": 1 frase explicando cómo encaja con lo que busca el usuario (menciona exterior e interior si son visibles).
9. "flipOpportunity":
   - "flipPotential": "Alto" | "Medio" | "Bajo" | null
   - "damageSummary": Daños visibles en chapa/ópticas/interior ("Sin daños aparentes" o descripción)
   - "estimatedRepairCost": Estimación orientativa de arreglo (ej: "0€", "100-200€ pintura/tapicería")

Responde ÚNICAMENTE un JSON válido con este formato:
{
  "color": "rojo",
  "bodyType": "utilitario/compacto",
  "doors": 3,
  "verified3p": true,
  "bodyCondition": "Pintura con brillo, volante y tapicería en buen estado",
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
        const contentParts: Array<{ type: "text"; text: string } | { type: "file"; data: Buffer; mediaType: string }> = [
          { type: "text", text: prompt },
        ];
        for (const item of validBuffers) {
          contentParts.push({ type: "file", data: item.buffer, mediaType: item.contentType });
        }
        const result = await generateText({
          model: visionModel,
          messages: [
            {
              role: "user",
              content: contentParts,
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
/**
 * Audits cars with Dynamic Pool Refill:
 * If an audited car is rejected by visual criteria (color mismatch, damage, doors),
 * immediately audits the next candidate from the 50-80 car pool to fill the quota,
 * guaranteeing the user gets targetCount top-quality, verified cars.
 */
export async function auditCarVisuals(
  cars: CarResult[],
  options?: VisionAuditOptions | number
): Promise<CarResult[]> {
  if (!cars || cars.length === 0) return cars;

  const opts: VisionAuditOptions =
    typeof options === "number" ? { requestedDoors: options } : options || {};
  const requestedDoors = opts.requestedDoors;
  const targetCount = opts.targetCount || 8;

  // Maximum total audits allowed to prevent unbounded latency (~50-60s max with 3 concurrent workers)
  const maxAudits = Math.min(cars.length, Math.max(targetCount * 2, targetCount + 6));

  const validCandidates: CarResult[] = [];
  const unauditedCandidates: CarResult[] = [];
  const rejectedCandidates: CarResult[] = [];
  const pendingPool = [...cars];
  let auditsPerformed = 0;

  const auditOne = async (car: CarResult): Promise<CarResult> => {
    // 1. Collect all candidate image URLs: image_url + images gallery
    const candidateUrls: string[] = [];
    if (car.image_url && typeof car.image_url === "string") {
      candidateUrls.push(car.image_url.trim());
    }
    if (Array.isArray(car.images)) {
      for (const img of car.images) {
        if (typeof img === "string") {
          const trimmed = img.trim();
          if (trimmed.startsWith("http") && !candidateUrls.includes(trimmed)) {
            candidateUrls.push(trimmed);
          }
        }
      }
    }

    if (candidateUrls.length === 0) return car;

    // 2. Select sampled pair of images: Photo 1 (exterior) + Mid-gallery (interior/detail)
    const validPhotoUrls = candidateUrls.filter((u) => {
      const lower = u.toLowerCase();
      return (
        !lower.endsWith(".mp4") &&
        !lower.includes(".mp4?") &&
        !lower.endsWith(".webm") &&
        !lower.endsWith(".mov") &&
        !lower.endsWith(".m3u8") &&
        !lower.includes("video-thumb-play") &&
        !lower.includes("play-button")
      );
    });

    if (validPhotoUrls.length === 0) return car;

    const sampledPair: string[] = [validPhotoUrls[0]];
    if (validPhotoUrls.length >= 3) {
      sampledPair.push(validPhotoUrls[Math.floor(validPhotoUrls.length / 2)]);
    } else if (validPhotoUrls.length === 2) {
      sampledPair.push(validPhotoUrls[1]);
    }

    const visualAudit = await auditSingleCarImage(sampledPair, car.title, {
      ...opts,
      price: car.price,
      description: car.description,
    });

    if (!visualAudit) return car;

    const enrichedCar = {
      ...car,
      image_url: validPhotoUrls[0] || car.image_url,
      visualAudit,
    };
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

  // Loop in batches of 3 concurrent calls until we reach targetCount valid cars or hit maxAudits
  const batchSize = 3;
  while (validCandidates.length < targetCount && pendingPool.length > 0 && auditsPerformed < maxAudits) {
    const toAuditCount = Math.min(batchSize, pendingPool.length);
    const currentBatch = pendingPool.splice(0, toAuditCount);
    auditsPerformed += currentBatch.length;

    const settled = await Promise.allSettled(currentBatch.map(auditOne));
    for (let i = 0; i < settled.length; i++) {
      const res = settled[i];
      const car = res.status === "fulfilled" ? res.value : currentBatch[i];
      const audit = car.visualAudit;

      if (!audit) {
        unauditedCandidates.push(car);
      } else if (audit.userCriteriaMatch === false) {
        console.info(`[vision-auditor] Candidate rejected by vision ('${car.title}'): ${audit?.rejectionReason || "Criteria mismatch"}. Refilling pool.`);
        rejectedCandidates.push(car);
      } else {
        validCandidates.push(car);
      }
    }
  }

  // Sort valid candidates by score descending
  validCandidates.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));

  // Assemble final cars: valid candidates first, then remaining uninspected/unaudited cars to fill any deficit, then rejected at the tail
  const finalCars = [...validCandidates, ...unauditedCandidates, ...pendingPool, ...rejectedCandidates];
  return finalCars;
}
