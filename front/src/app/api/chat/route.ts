import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CHAT_MODEL, AUTOMISHO_SYSTEM_PROMPT, getChatModel } from "@/lib/ai";
import { ChatBody } from "@/lib/validators";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// Helpers are centralized in @/lib/chat-helpers for testability and to avoid Next.js route export validation
import { detectVIN, detectPlate, detectCarSearch, enrichCarResult } from "@/lib/chat-helpers";

import { lookupVehicleDgt } from "@/lib/dgt-client";

async function searchBackend(query: string, maxPrice?: number, minPrice?: number, searchMode: string = "fast") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const max_results = 10;
    const clamped = Math.max(1, Math.min(16, max_results));
    const res = await fetch(`${BACKEND_URL}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        source: searchMode,
        max_results: clamped,
        max_price: maxPrice,
        min_price: minPrice,
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

    // Detect intents
    const search = detectCarSearch(userText);
    const plate = detectPlate(userText);
    const vin = detectVIN(userText);

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

    if (search.isSearch) {
      const searchResults = await searchBackend(search.query, search.maxPrice, search.minPrice);
      console.log("[chat] search results:", searchResults?.total ?? 0, "from", searchResults?.source, "maxPrice", search.maxPrice);

      if (searchResults?.results?.length > 0) {
        const enriched = searchResults.results.map((c: Record<string, unknown>) =>
          enrichCarResult(c, search.maxPrice)
        );

        const cars = enriched
          .map(
            (c: Record<string, unknown>, i: number) =>
              `${i + 1}. **${c.title}** — ${c.price ? (c.price as number).toLocaleString("es-ES") + "€" : "Precio no disponible"} | ${c.year || "¿?"} | ${c.km ? (c.km as number).toLocaleString("es-ES") + "km" : "¿km?"} | ${c.fuel || ""} | Puntuación IA: ${c.score}/100 | Fuente: ${c.source}${c.url ? ` | ${c.url}` : ""}`
          )
          .join("\n");

        contextData += `\n\n## Resultados de búsqueda en tiempo real (${searchResults.total} coches encontrados en ${searchResults.source}):\n${cars}\n\nResponde con estos datos reales. Muestra los mejores según el criterio del usuario. Incluye precio, año, km, fuente, link y menciona brevemente 1-2 ventajas y 1 punto a tener en cuenta. Concluye SIEMPRE con las 3 preguntas clave para la llamada al vendedor (facturas de distribución/embrague, matrícula exacta o VIN, y motivo de venta).`;

        // Collect enriched for data block and dashboard
        extraDataCars.push(...enriched);
      } else {
        contextData += `\n\n## Búsqueda ejecutada pero sin resultados\nSe buscó "${search.query}"${search.maxPrice ? ` con precio máximo ${search.maxPrice}€` : ""} en AutoScout24, coches.net, Wallapop y Milanuncios. No se encontraron anuncios actualmente con esos filtros exactos. Informa al usuario con amabilidad y sugiere ajustar la búsqueda (ampliar presupuesto, cambiar marca o modelo).`;
      }
    }

    if (plate || vin) {
      const dgtResult = await lookupVehicleDgt(plate || vin || "");
      contextData += `\n\n## Verificación Oficial DGT / Historial del Vehículo:\n- Matrícula/VIN: ${dgtResult.plate}\n- Fecha 1ª Matriculación en España: ${dgtResult.firstRegistrationDate || "No disponible"}\n- Distintivo Ambiental DGT Oficial: ${dgtResult.environmentalBadge || "Sin Distintivo"}\n- Estado DGT: ${dgtResult.status} (${dgtResult.statusDescription})\n- Informe Oficial DGT Tasa 4.1 (8,67€): ${dgtResult.officialReportUrl}\n- Informe CarVertical: ${dgtResult.carVerticalUrl}\n- Informe Carfax: ${dgtResult.carfaxUrl}\n\nUsa estos datos técnicos oficiales. Si la fecha de la matrícula contradice la del anuncio o lo que dijo el vendedor, alerta inmediatamente al usuario de la discrepancia.`;
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

    console.log("[chat] model:", CHAT_MODEL, "| search:", search.isSearch, "price:", search.maxPrice, "| plate:", plate, "| vin:", vin, "| conv:", conversationId);

    // Build enhanced system prompt with context data
    const systemPrompt = contextData
      ? `${AUTOMISHO_SYSTEM_PROMPT}\n\n---\nTienes datos reales del sistema. Úsalos para responder al usuario. NO inventes datos.${contextData}\n\nSi hay resultados de coches, presenta 3-5 mejores en markdown con links. Si hay matrícula/VIN, ofrece las 3 opciones DGT/CarVertical/Carfax con links externos.`
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

    // Attempt LLM stream with generous timeout (60s) + graceful fallback
    let llmTimeout: ReturnType<typeof setTimeout> | null = null;
    const abortController = new AbortController();
    llmTimeout = setTimeout(() => {
      console.warn("[chat] LLM timeout 60s — aborting stream for", conversationId);
      try { abortController.abort(); } catch {}
    }, 60000);

    try {
      const result = streamText({
        model: getChatModel(CHAT_MODEL),
        system: systemPrompt,
        messages: await convertToModelMessages(messages),
        abortSignal: abortController.signal as unknown as AbortSignal,
        onFinish: async ({ text }) => {
          if (llmTimeout) clearTimeout(llmTimeout);
          if (conversationId && text) {
            try {
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
        },
      });

      const streamId = "msg-" + Date.now();
      const uiStream = createUIMessageStream({
        execute: async ({ writer }) => {
          writer.write({
            type: "text-start",
            id: streamId,
          });

          try {
            for await (const chunk of result.textStream) {
              writer.write({
                type: "text-delta",
                id: streamId,
                delta: chunk,
              });
            }
            if (extraDataCars.length > 0) {
              writer.write({
                type: "text-delta",
                id: streamId,
                delta: `\n\n<!--AUTOMISHO_CARS_DATA:${JSON.stringify(extraDataCars)}-->`,
              });
            }
          } catch (streamErr) {
            console.error("[chat] textStream error:", streamErr);
          } finally {
            writer.write({
              type: "text-end",
              id: streamId,
            });
          }
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
    } catch (llmErr: unknown) {
      if (llmTimeout) clearTimeout(llmTimeout);
      const errMsg = llmErr instanceof Error ? llmErr.message : String(llmErr);
      const errStack = llmErr instanceof Error ? llmErr.stack : undefined;
      console.error("[chat] LLM streamText failed — falling back to static markdown", {
        message: errMsg,
        stack: errStack,
        model: CHAT_MODEL,
        conversationId,
        hasCars: extraDataCars.length > 0,
        plate,
        vin,
      });

      // Fallback: still send data block + static markdown so UI shows cards without error red
      const fallbackText = generateFallbackMarkdown(extraDataCars);

      // Persist fallback as assistant message so history is consistent
      if (conversationId) {
        try {
          const savedFallback = extraDataCars.length > 0
            ? `${fallbackText}\n\n<!--AUTOMISHO_CARS_DATA:${JSON.stringify(extraDataCars)}-->`
            : fallbackText;

          await prisma.message.create({
            data: { conversationId, role: "assistant", content: savedFallback },
          });
          const msgCount = await prisma.message.count({ where: { conversationId } });
          if (msgCount <= 2 && userText) {
            const title = userText.slice(0, 80) + (userText.length > 80 ? "..." : "");
            await prisma.conversation.update({ where: { id: conversationId }, data: { title } });
          }
        } catch (persistErr) {
          console.error("[chat] Failed to persist fallback message:", persistErr);
        }
      }

      if (extraData) {
        const fallbackStream = createUIMessageStream({
          execute: async ({ writer }) => {
            (writer as unknown as { write: (c: unknown) => void }).write({
              type: "data",
              data: extraData,
              transient: false,
            });
            const id = "fallback-" + Date.now();
            (writer as unknown as { write: (c: unknown) => void }).write({ type: "text-start", id });
            (writer as unknown as { write: (c: unknown) => void }).write({ type: "text-delta", id, delta: fallbackText });
            (writer as unknown as { write: (c: unknown) => void }).write({ type: "text-end", id });
          },
        });
        const response = createUIMessageStreamResponse({ stream: fallbackStream });
        response.headers.set("x-automisho-cars", encodeURIComponent(JSON.stringify(extraData)));
        return response;
      }

      // No cars: still return a stream with fallback text (200, not 500)
      const textOnlyStream = createUIMessageStream({
        execute: async ({ writer }) => {
          const id = "fallback-" + Date.now();
          (writer as unknown as { write: (c: unknown) => void }).write({ type: "text-start", id });
          (writer as unknown as { write: (c: unknown) => void }).write({ type: "text-delta", id, delta: fallbackText });
          (writer as unknown as { write: (c: unknown) => void }).write({ type: "text-end", id });
        },
      });
      return createUIMessageStreamResponse({ stream: textOnlyStream });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[chat] Unhandled Error:", { message, stack, conversationId: (await (async () => { try { return "unknown"; } catch { return "unknown"; }})()) });
    return Response.json({ error: message }, { status: 500 });
  }
}
