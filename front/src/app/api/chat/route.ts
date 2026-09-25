import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CHAT_MODEL,
  AUTOMISHO_SYSTEM_PROMPT,
  isCommandCodeConfigured,
  getCommandCodeModel,
} from "@/lib/ai";
import { ChatBody } from "@/lib/validators";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

import { detectVIN, detectPlate, detectCarSearch, enrichCarResult, isCarMatchingDoors, isCarMatchingColor } from "@/lib/chat-helpers";

import { classifyUserIntent } from "@/lib/intent-classifier";
import { lookupVehicleDgt } from "@/lib/dgt-client";

async function searchBackend(
  query: string,
  maxPrice?: number,
  minPrice?: number,
  doors?: number,
  excludedMakes?: string[],
  makes?: string[]
) {
  const controller = new AbortController();
  const timeoutMs = 85000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BACKEND_URL}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        source: "deep",
        max_results: 50,
        max_price: maxPrice,
        min_price: minPrice,
        doors,
        excluded_makes: excludedMakes,
        makes,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    if ((e as Error).name === "AbortError") console.warn("[chat] searchBackend timeout");
    else console.error("[chat] searchBackend error", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function agentSearchBackend(userText: string, maxPrice?: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75000);
  try {
    const promptText = maxPrice ? `${userText} (PRESUPUESTO MÁXIMO ESTRICTO: ${maxPrice}€)` : userText;
    const res = await fetch(`${BACKEND_URL}/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: promptText }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const cars = (data as { cars_data?: unknown }).cars_data;
    if (!Array.isArray(cars) || cars.length === 0) return null;
    return { results: cars, source: "agent", total: cars.length };
  } catch (e) {
    if ((e as Error).name === "AbortError") console.warn("[chat] agentSearchBackend timeout");
    else console.error("[chat] agentSearchBackend error", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!checkRateLimit(req, (session.user as unknown as { plan?: string }).plan)) {
    return rateLimitResponse();
  }

  try {
    const body = await req.json();
    const parsed = ChatBody.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { messages, conversationId } = parsed.data;

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "No messages provided" }, { status: 400 });
    }

    // Verify conversation
    if (conversationId) {
      const conv = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: session.user.id },
      });
      if (!conv) {
        return Response.json({ error: "Conversation not found" }, { status: 404 });
      }
    }

    // Get last user message
    const lastUserMessage = messages[messages.length - 1];
    const userText =
      lastUserMessage.parts
        ?.filter((p: { type: string }) => p.type === "text")
        .map((p: { text: string }) => p.text)
        .join("") || "";

    // Save user message
    if (conversationId && userText) {
      await prisma.message.create({
        data: { conversationId, role: "user", content: userText },
      });
    }

    // 1. AI-Driven Structured Intent Classification (Zero-Regex, full conversation context)
    const intent = await classifyUserIntent(messages);
    console.log("[chat] AI Classified Intent:", JSON.stringify(intent));

    const isSearch = intent.isSearch;
    const maxPrice = intent.maxPrice ?? undefined;
    const minPrice = intent.minPrice ?? undefined;
    const doors = intent.doors ?? undefined;
    const excludedMakes = intent.excludedMakes || [];
    const wantedMakes = intent.wantedMakes || [];
    const colors = intent.colors || [];
    const plate = intent.plate || null;
    const vin = intent.vin || null;
    const requestedCount = Math.max(1, Math.min(intent.targetCount || 6, 20));

    let contextData = "";
    let extraData: Record<string, unknown> | null = null;
    const extraDataCars: unknown[] = [];

    // Check for uploaded PDF or image files in message parts
    for (const part of (lastUserMessage.parts || []) as Record<string, unknown>[]) {
      if (part.type === "file" && typeof part.url === "string") {
        const url = part.url as string;
        if (url.includes("application/pdf") || (part.mediaType as string) === "application/pdf") {
          try {
            const base64Data = url.split(",")[1];
            if (base64Data) {
              const buffer = Buffer.from(base64Data, "base64");
              const rawText = buffer.toString("latin1");
              const cleanStrings = rawText.match(/[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s:.,\/\-]{4,}/g) || [];
              const extractedText = cleanStrings.join(" ").slice(0, 4000);
              if (extractedText.trim()) {
                contextData += `\n\n## DOCUMENTO PDF ADJUNTO POR EL USUARIO (Informe DGT / Ficha ITV / CarVertical):\n${extractedText}\n\nAudita este documento detalladamente: revisa si hay defectos graves de ITV, cargas financieras o embargos, fecha de primera matriculación y coherencia del kilometraje.`;
              }
            }
          } catch (pdfErr) {
            console.warn("[chat] PDF extraction error:", pdfErr);
          }
        }
      }
    }

    if (isSearch) {
      // Build clean query: only positive makes or empty string (never conversational prose)
      const cleanScrapeQuery = intent.query
        ? intent.query
        : (wantedMakes.length > 0 ? wantedMakes.join(" ") : "");

      // Agent is primary; scrape backend runs as safe structured fallback
      const [agentSettled, scrapeSettled] = await Promise.allSettled([
        agentSearchBackend(userText, maxPrice),
        searchBackend(cleanScrapeQuery, maxPrice, minPrice, doors, excludedMakes, wantedMakes),
      ]);
      const agentResults =
        agentSettled.status === "fulfilled" ? agentSettled.value : null;
      const scrapeResults =
        scrapeSettled.status === "fulfilled" ? scrapeSettled.value : null;
      const hasAgentCars =
        agentResults != null &&
        Array.isArray((agentResults as { results?: unknown }).results) &&
        ((agentResults as { results: unknown[] }).results.length > 0);
      const hasScrapeCars =
        scrapeResults != null &&
        Array.isArray((scrapeResults as { results?: unknown }).results) &&
        ((scrapeResults as { results: unknown[] }).results.length > 0);
      const rawAgentCars =
        hasAgentCars && Array.isArray((agentResults as { results?: unknown[] }).results)
          ? ((agentResults as { results: Record<string, unknown>[] }).results)
          : [];
      const rawScrapeCars =
        hasScrapeCars && Array.isArray((scrapeResults as { results?: unknown[] }).results)
          ? ((scrapeResults as { results: Record<string, unknown>[] }).results)
          : [];

      // FUSION OF POOLS: Combine both Agent cars and Scrape cars into one unified multi-source pool
      const allRawCars = [...rawAgentCars, ...rawScrapeCars];

      // Deduplicate by URL or normalized Title + Price
      const seenKeys = new Set<string>();
      const dedupedCars: Record<string, unknown>[] = [];

      for (const car of allRawCars) {
        const rawUrl = String(car.url || "").trim().toLowerCase();
        const rawTitle = String(car.title || "").trim().toLowerCase().replace(/\s+/g, " ");
        const price = Number(car.price) || 0;

        let key = "";
        if (rawUrl && rawUrl.startsWith("http")) {
          try {
            const parsedUrl = new URL(rawUrl);
            key = parsedUrl.origin + parsedUrl.pathname;
          } catch {
            key = rawUrl;
          }
        }
        if (!key) {
          key = `${rawTitle}_${price}`;
        }

        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          dedupedCars.push(car);
        }
      }

      // Group by normalized portal source (coches.net, autoscout24, wallapop, milanuncios, etc.)
      const bySource: Record<string, Record<string, unknown>[]> = {};
      for (const c of dedupedCars) {
        const src = String(c.source || "other").toLowerCase().replace("_", ".");
        if (!bySource[src]) bySource[src] = [];
        bySource[src].push(c);
      }

      // Fair round-robin interleaving across sources to ensure balanced market representation
      const balancedPool: Record<string, unknown>[] = [];
      const maxSourceLen = Math.max(...Object.values(bySource).map((arr) => arr.length), 0);
      for (let i = 0; i < maxSourceLen; i++) {
        for (const src of Object.keys(bySource)) {
          if (i < bySource[src].length) {
            balancedPool.push(bySource[src][i]);
          }
        }
      }

      const totalCombined = balancedPool.length;
      const searchResults = totalCombined > 0
        ? { results: balancedPool, source: "hybrid-pool", total: totalCombined }
        : null;
      const chosen = (hasAgentCars && hasScrapeCars)
        ? "hybrid (agent+scrape)"
        : hasAgentCars
          ? "agent"
          : hasScrapeCars
            ? "scrape"
            : "none";

      console.log(
        `[chat] agent: ${agentSettled.status} (${rawAgentCars.length} cars) | scrape: ${scrapeSettled.status} (${rawScrapeCars.length} cars) | chosen: ${chosen} -> combined pool: ${totalCombined} cars across ${Object.keys(bySource).length} portals (${Object.keys(bySource).join(", ")})`
      );
      console.log(
        "[chat] search results:",
        totalCombined,
        "from",
        searchResults?.source,
        "maxPrice",
        maxPrice,
        "doors:",
        doors
      );

      if (searchResults && Array.isArray(searchResults.results) && searchResults.results.length > 0) {
        // Enforce hard price filter: discard any car exceeding user maxPrice by more than 5%
        let validCars = searchResults.results as Record<string, unknown>[];
        if (maxPrice) {
          validCars = validCars.filter((c) => {
            const price = Number(c.price);
            if (!price || isNaN(price)) return false;
            return price <= maxPrice * 1.05;
          });
        }

        // Enforce excluded makes filter: immediately purge any car matching an excluded brand
        if (excludedMakes.length > 0) {
          validCars = validCars.filter((c) => {
            const title = String(c.title || "").toLowerCase();
            return !excludedMakes.some((brand) => new RegExp(`\\b${brand}\\b`, "i").test(title));
          });
        }

        const enriched = validCars.map((c: Record<string, unknown>) =>
          enrichCarResult(c, maxPrice, doors)
        );

        // Strict door filtering on enriched cars if specified
        let filteredEnriched = enriched;
        if (doors) {
          filteredEnriched = filteredEnriched.filter((c: { title: string; url?: string }) =>
            isCarMatchingDoors(c.title, c.url, doors)
          );
        }

        // Color filtering before vision audit (title-based check)
        if (colors.length > 0) {
          const colorMatched = filteredEnriched.filter((c: { title: string }) =>
            isCarMatchingColor(c.title, colors)
          );
          if (colorMatched.length > 0) {
            filteredEnriched = colorMatched;
          }
        }

        let sortedEnriched = [...filteredEnriched].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));

        // Multimodal AI Vision & Description Audit: Inspect candidates against user criteria
        try {
          const { auditCarVisuals } = await import("@/lib/vision-auditor");
          const auditContextQuery = maxPrice
            ? `${userText} (PRESUPUESTO MÁXIMO: ${maxPrice}€)`
            : userText;
          sortedEnriched = await auditCarVisuals(sortedEnriched, {
            requestedDoors: doors,
            userQuery: auditContextQuery,
            targetCount: requestedCount,
          });

          // Post-audit color filter: if user requested specific colors, strictly exclude non-matching colors
          if (colors.length > 0) {
            const visualColorMatched = sortedEnriched.filter((c) => {
              const audit = c.visualAudit as import("@/types").VisualAudit | undefined;
              if (audit?.colorDetected && !isCarMatchingColor(c.title, colors, audit.colorDetected)) {
                return false;
              }
              if (audit?.userCriteriaMatch === false && (audit.rejectionReason?.toLowerCase().includes("color") || audit.criteriaNotes?.toLowerCase().includes("color"))) {
                return false;
              }
              return true;
            });
            if (visualColorMatched.length > 0) {
              sortedEnriched = visualColorMatched;
            }
          }

          const fullyMatched = sortedEnriched.filter((c) => (c.visualAudit as import("@/types").VisualAudit | undefined)?.userCriteriaMatch !== false);
          if (fullyMatched.length >= Math.min(requestedCount, 3)) {
            sortedEnriched = fullyMatched;
          }
        } catch (visionErr) {
          console.warn("[chat] Vision audit error, proceeding with text metadata:", visionErr);
        }

        const cars = sortedEnriched
          .slice(0, requestedCount)
          .map(
            (c: import("@/types").CarResult, i: number) => {
              const audit = c.visualAudit;
              const visionParts: string[] = [];
              if (audit) {
                if (audit.verified3p) visionParts.push("3p confirmado en foto");
                else if (audit.doorsDetected) visionParts.push(`${audit.doorsDetected}p en foto`);
                if (audit.colorDetected) visionParts.push(`Color: ${audit.colorDetected}`);
                if (audit.bodyTypeDetected) visionParts.push(`Carrocería: ${audit.bodyTypeDetected}`);
                if (audit.bodyCondition) visionParts.push(`Estado: ${audit.bodyCondition}`);
                if (audit.criteriaNotes) visionParts.push(`Auditoría: ${audit.criteriaNotes}`);
                if (audit.flipOpportunity?.flipPotential) {
                  visionParts.push(
                    `Oportunidad Reventa: Potencial ${audit.flipOpportunity.flipPotential} (${audit.flipOpportunity.damageSummary || "sin daños graves"})`
                  );
                }
              }
              const visionInfo = visionParts.length > 0 ? ` | [Visión IA: ${visionParts.join(" | ")}]` : "";
              return `${i + 1}. **${c.title}** — ${c.price ? (c.price as number).toLocaleString("es-ES") + "€" : "Precio no disponible"} | ${c.year || "¿?"} | ${c.km ? (c.km as number).toLocaleString("es-ES") + "km" : "¿km?"} | ${c.fuel || ""} | Puntuación IA: ${c.score}/100 | Fuente: ${c.source}${visionInfo}${c.url ? ` | ${c.url}` : ""}`;
            }
          )
          .join("\n");

        const isBroadQuery = !doors && colors.length === 0 && !/(?:rojo|negro|blanco|azul|gris|verde|amarillo|cabrio|descapotable|coupe|coupé|familiar|suv|berlina|reventa|revender|chollo)/i.test(userText);
        const proactiveFilterPrompt = isBroadQuery
          ? "\n\nPREGUNTA PROACTIVA DE AFINADO (OBLIGATORIA): Como la búsqueda del usuario es abierta o genérica, al final de tu respuesta, pregúntale de forma cercana y proactiva si desea afinar con algún filtro específico: ¿Tiene preferencia por algún color (ej. rojo, negro, blanco...), tipo de carrocería (descapotable, utilitario, familiar, coupé), marca concreta o busca unidades con margen para reventa / negocio?"
          : "";

        const colorPromptRule = colors.length > 0
          ? `\n\nREGLA DE COLOR: El usuario tiene preferencia exclusiva por color ${colors.join(" o ")}. Los candidatos principales de la lista han sido auditados visualmente por Visión IA para cumplir esta preferencia. Menciona explícitamente el color confirmado por Visión IA en la fotografía del anuncio para cada candidato.`
          : "";

        const quantityPromptRule = `\n\nREGLA DE CANTIDAD EXACTA: El usuario ha solicitado exactamente ${requestedCount} opciones. Debes presentar y detallar exactamente ${Math.min(requestedCount, sortedEnriched.length)} recomendaciones en tu respuesta numeradas del 1 al ${Math.min(requestedCount, sortedEnriched.length)}. No resumas ni recortes la lista si dispones de suficientes candidatos.`;

        contextData += `\n\n## Resultados reales ordenados por puntuación IA (${sortedEnriched.length} coches analizados en el mercado español):\n${cars}\n\nInstrucción de Calidad y Coherencia: Presenta los mejores candidatos tomando estrictamente los primeros coches de la lista anterior ordenada por puntuación. Tus recomendaciones deben coincidir de forma exacta con los vehículos analizados en el mercado. Para cada coche incluye: Precio, Kilometraje, Año, Combustible, Fuente y enlace [Ver anuncio ↗](url), 1-2 Ventajas reales y 1 Punto a revisar. Si el coche incluye información de [Visión IA: ...], menciona explícitamente en el texto lo que has auditado visualmente en la fotografía del anuncio (color, tipo de carrocería, estado de chapa/faros, potencial de reventa o daños detectados). Concluye SIEMPRE con las 3 preguntas clave para la llamada al vendedor (facturas de distribución/embrague, matrícula exacta o VIN, y motivo de venta).${proactiveFilterPrompt}${colorPromptRule}${quantityPromptRule}${doors ? `\n\nREGLA CRÍTICA INQUEBRANTABLE DE CARROCERÍA: El usuario exige ÚNICAMENTE vehículos de ${doors} puertas. Queda TERMINANTEMENTE PROHIBIDO recomendar, incluir o mencionar coches de 4 o 5 puertas, ni siquiera como "alternativas" o notas. Recomienda SOLO coches de ${doors} puertas.` : ""}`;

        // Collect enriched for data block and dashboard
        extraDataCars.push(...sortedEnriched);
      } else {
        contextData += `\n\n## Búsqueda ejecutada pero sin resultados\nSe buscó en el mercado español con precio máximo ${maxPrice ? `${maxPrice}€` : "no especificado"}${doors ? ` de ${doors} puertas` : ""}. No se encontraron anuncios actualmente con esos filtros exactos. Informa al usuario con amabilidad y sugiere ajustar la búsqueda (ampliar presupuesto, cambiar marca o modelo).`;
      }
    }

    if (vin) {
      const { decodeVin } = await import("@/lib/vin-decoder");
      const vinInfo = decodeVin(vin);
      if (vinInfo.isValid) {
        contextData += `\n\n## Decodificación Oficial por Número de Bastidor (VIN):\n- VIN: ${vinInfo.vin}\n- Fabricante: ${vinInfo.manufacturer}\n- País de Ensamblaje: ${vinInfo.country}\n- Año Modelo Oficial: ${vinInfo.modelYear || "No especificado"}\n- Informes de Historial Internacional: AutoDNA (${vinInfo.reports.autoDnaUrl}), CarVertical (${vinInfo.reports.carVerticalUrl}), Carfax (${vinInfo.reports.carfaxUrl}) y vinAudit (${vinInfo.reports.vinAuditUrl}).`;
      }
    }

    if (plate) {
      const dgtResult = await lookupVehicleDgt(plate);
      contextData += `\n\n## Verificación Oficial DGT / Historial del Vehículo:\n- Matrícula: ${dgtResult.plate}\n- Fecha 1ª Matriculación en España: ${dgtResult.firstRegistrationDate || "No disponible"}\n- Distintivo Ambiental DGT Oficial: ${dgtResult.environmentalBadge || "Sin Distintivo"}\n- Estado DGT: ${dgtResult.status} (${dgtResult.statusDescription})\n- Informe Oficial DGT Tasa 4.1 (8,67€): ${dgtResult.officialReportUrl}\n- Informe CarVertical: ${dgtResult.carVerticalUrl}\n- Informe Carfax: ${dgtResult.carfaxUrl}\n\nUsa estos datos técnicos oficiales. Si la fecha de la matrícula contradice la del anuncio o lo que dijo el vendedor, alerta inmediatamente al usuario de la discrepancia.`;
    }

    // Build extraData for MessageList car grid and Copilot Live Dashboard
    if (extraDataCars.length > 0) {
      extraData = { cars: extraDataCars };
      if (plate || vin) {
        (extraData as Record<string, unknown>).dgtOptions = { plate: plate ?? null, vin: vin ?? null };
      }
    } else if (plate || vin) {
      extraData = { dgtOptions: { plate: plate ?? null, vin: vin ?? null } };
    }

    console.log("[chat] model:", CHAT_MODEL, "| search:", isSearch, "price:", maxPrice, "| plate:", plate, "| vin:", vin, "| conv:", conversationId);

    // Build enhanced system prompt with context data
    const systemPrompt = contextData
      ? `${AUTOMISHO_SYSTEM_PROMPT}\n\n---\nTienes datos reales del sistema. Úsalos para responder al usuario. NO inventes datos.${contextData}\n\nSi hay resultados de coches, presenta detalladamente exactamente las ${Math.min(requestedCount, extraDataCars.length)} mejores opciones ordenadas por puntuación en markdown con links. Si hay matrícula/VIN, ofrece las 3 opciones DGT/CarVertical/Carfax con links externos.`
      : AUTOMISHO_SYSTEM_PROMPT;

    // Helper: generate static markdown fallback when LLM fails but we have cars
    const generateFallbackMarkdown = (cars: unknown[]): string => {
      if (Array.isArray(cars) && cars.length > 0) {
        const list = (cars as Record<string, unknown>[]).slice(0, 3)
          .map((c, i) => {
            const price = c.price ? `${(c.price as number).toLocaleString("es-ES")}€` : "Precio no disponible";
            const year = (c.year as string | number) || "¿?";
            const km = c.km ? `${(c.km as number).toLocaleString("es-ES")}km` : "¿km?";
            const fuel = (c.fuel as string) || "";
            const source = (c.source as string) || "anuncio";
            const url = c.url ? ` — ${c.url}` : "";
            return `${i + 1}. **${c.title}** — ${price} | ${year} | ${km} | ${fuel} | Fuente: ${source}${url}`;
          })
          .join("\n");
        return `¡He encontrado ${cars.length} opciones para ti! Puedes ver la comparativa detallada en el panel lateral:\n\n${list}\n\n¿Quieres que analice a fondo alguna de estas opciones?`;
      }
      if (plate || vin) {
        return `He detectado ${plate ? `matrícula **${plate}**` : ""}${plate && vin ? " y " : ""}${vin ? `VIN **${vin}**` : ""}. Puedes consultar los informes recomendados:\n\n- **DGT oficial 8,67€** (tasa 4.1) en https://sede.dgt.gob.es/es/vehiculos/informe-de-vehiculo/\n- **CarVertical ~15€** en https://www.carvertical.com\n- **Carfax ~20€** en https://www.carfax.eu\n\n¿Deseas que revise algún dato específico de la ficha?`;
      }
      return "No he podido conectar temporalmente con el modelo de lenguaje, pero tus parámetros de búsqueda han sido registrados. Por favor, intenta de nuevo tu consulta.";
    };

    // Attempt LLM stream with generous timeout (140s: intent + agent + scrape + vision + stream)
    let llmTimeout: ReturnType<typeof setTimeout> | null = null;
    const abortController = new AbortController();
    llmTimeout = setTimeout(() => {
      console.warn("[chat] LLM timeout 140s — aborting stream for", conversationId);
      try { abortController.abort(); } catch {}
    }, 140000);

    // Helper to persist assistant message to DB
    const persistAssistantMessage = async (text: string) => {
      if (conversationId && text) {
        try {
          const convExists = await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: { id: true },
          });
          if (!convExists) {
            console.info("[chat] Conversation was closed/deleted by user, skipping persist");
            return;
          }

          const savedText = extraDataCars.length > 0
            ? `${text}\n\n<!--AUTOMISHO_CARS_DATA:${JSON.stringify(extraDataCars)}-->`
            : text;

          await prisma.message.create({
            data: { conversationId, role: "assistant", content: savedText },
          });

          const msgCount = await prisma.message.count({
            where: { conversationId },
          });
          if (msgCount <= 2 && userText) {
            const title = userText.slice(0, 80) + (userText.length > 80 ? "..." : "");
            await prisma.conversation.update({
              where: { id: conversationId },
              data: { title },
            });
          }
        } catch (err) {
          console.error("[chat] Failed to save message:", err);
        }
      }
    };

    const modelMessages = await convertToModelMessages(messages);
    const streamId = "msg-" + Date.now();

    const uiStream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({
          type: "text-start",
          id: streamId,
        });

        let fullText = "";
        let streamSuccess = false;

        // 1. Primary Attempt: Command Code Provider API (GOAT-only)
        if (isCommandCodeConfigured()) {
          try {
            console.log(`[chat] Attempting provider: Command Code Provider API (${CHAT_MODEL})`);
            const ccResult = streamText({
              model: getCommandCodeModel(CHAT_MODEL),
              system: systemPrompt,
              messages: modelMessages,
              abortSignal: abortController.signal as unknown as AbortSignal,
            });

            for await (const chunk of ccResult.textStream) {
              streamSuccess = true;
              fullText += chunk;
              writer.write({
                type: "text-delta",
                id: streamId,
                delta: chunk,
              });
            }
          } catch (ccErr) {
            console.warn("[chat] Command Code Provider API failed, using static fallback:", ccErr);
          }
        }

        // 2. Last Resort Fallback: Static structured markdown
        if (!streamSuccess) {
          console.warn("[chat] CommandCode provider failed or unconfigured — delivering static fallback");
          const fallback = generateFallbackMarkdown(extraDataCars);
          fullText = fallback;
          writer.write({
            type: "text-delta",
            id: streamId,
            delta: fallback,
          });
        }

        // Append structured cars data block for UI/Dashboard
        if (extraDataCars.length > 0) {
          writer.write({
            type: "text-delta",
            id: streamId,
            delta: `\n\n<!--AUTOMISHO_CARS_DATA:${JSON.stringify(extraDataCars)}-->`,
          });
        }

        writer.write({
          type: "text-end",
          id: streamId,
        });

        // Persist final assistant response to DB
        await persistAssistantMessage(fullText);
      },
      onFinish: async () => {
        if (llmTimeout) clearTimeout(llmTimeout);
      },
    });

    const response = createUIMessageStreamResponse({ stream: uiStream });
    if (extraData) {
      response.headers.set("x-automisho-cars", encodeURIComponent(JSON.stringify(extraData)));
    }
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[chat] Unhandled Error:", { message, stack, conversationId: (await (async () => { try { return "unknown"; } catch { return "unknown"; }})()) });
    return Response.json({ error: message }, { status: 500 });
  }
}
