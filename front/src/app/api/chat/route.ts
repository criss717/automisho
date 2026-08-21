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
import { detectVIN, detectPlate, detectCarSearch } from "@/lib/chat-helpers";

async function searchBackend(query: string, maxPrice?: number, minPrice?: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const max_results = 8; // clamp 1..12 defensivo
    const clamped = Math.max(1, Math.min(12, max_results));
    const res = await fetch(`${BACKEND_URL}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        source: "auto",
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

async function lookupDgt(plate: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/dgt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plate }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
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

    if (search.isSearch) {
      const searchResults = await searchBackend(search.query, search.maxPrice, search.minPrice);
      console.log("[chat] search results:", searchResults?.total ?? 0, "from", searchResults?.source, "maxPrice", search.maxPrice);

      if (searchResults?.results?.length > 0) {
        const cars = searchResults.results
          .map(
            (c: Record<string, unknown>, i: number) =>
              `${i + 1}. **${c.title}** — ${c.price ? (c.price as number).toLocaleString("es-ES") + "€" : "Precio no disponible"} | ${c.year || "¿?"} | ${c.km ? (c.km as number).toLocaleString("es-ES") + "km" : "¿km?"} | ${c.fuel || ""} | Fuente: ${c.source}${c.url ? ` | ${c.url}` : ""}`
          )
          .join("\n");

        contextData = `\n\n## Resultados de búsqueda en tiempo real (${searchResults.total} coches encontrados en ${searchResults.source}):\n${cars}\n\nResponde con estos datos reales. Muestra los 3-5 mejores según el criterio del usuario. Incluye precio, año, km, fuente y link. Si hay image_url, menciona que hay foto disponible.`;

        // Collect for data block
        extraDataCars.push(
          ...searchResults.results.map((c: Record<string, unknown>) => ({
            ...c,
            image_url: (c.image_url as string | null) ?? (c.image as string | null) ?? null,
          }))
        );
      } else {
        contextData = `\n\n## Búsqueda ejecutada pero sin resultados\nSe buscó "${search.query}"${search.maxPrice ? ` con precio máximo ${search.maxPrice}€` : ""} en AutoScout24, coches.net, Wallapop y Milanuncios. No se encontraron anuncios. Informa al usuario y sugiere ajustar la búsqueda (cambiar marca, ampliar presupuesto, etc.).`;
      }
    }

    if (plate) {
      const dgtResult = await lookupDgt(plate);
      if (dgtResult && !dgtResult.error) {
        contextData += `\n\n## Consulta DGT — Matrícula ${dgtResult.plate}:\n- Marca: ${dgtResult.make}\n- Modelo: ${dgtResult.model}\n- Año: ${dgtResult.year}\n- Combustible: ${dgtResult.fuel}\n- Potencia: ${dgtResult.power}\n- ITV: ${dgtResult.itv_status}\n- Matriculación: ${dgtResult.enrollment_date}\n- Fuente: ${dgtResult.source ?? "mock"} (${dgtResult.source === "mock" ? "Demo — datos de ejemplo" : "Oficial"})`;
      }
    }

    // DGT didactic guidance when plate or VIN detected
    if (plate || vin) {
      contextData += `\n\n## Guía informes: ofrece las 3 opciones con links y explica diferencias — DGT oficial 8,67€ (tasa 4.1 en https://sede.dgt.gob.es/es/vehiculos/informe-de-vehiculo/ con Cl@ve/certificado, pagar tasa, descargar PDF y qué mirar: titulares, cargas/embargos, ITV, km, bajas), CarVertical (~15€ VIN en https://www.carvertical.com) y Carfax (~20€ VIN en https://www.carfax.eu). No scrapees DGT, solo linkea.`;
      if (plate) contextData += ` Matrícula detectada: ${plate}.`;
      if (vin) contextData += ` VIN detectado: ${vin} — recomienda CarVertical/Carfax para historial completo.`;
    }

    // Build extraData for MessageList car grid
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
            const source = (c.source as string) || "demo";
            const url = c.url ? ` — ${c.url}` : "";
            return `${i + 1}. **${c.title}** — ${price} | ${year} | ${km} | ${fuel} | Fuente: ${source}${url}`;
          })
          .join("\n");
        return `¡He encontrado ${cars.length} opciones para ti! (respuesta local — el asistente IA está temporalmente no disponible, pero aquí tienes los resultados):\n\n${list}\n\nHe mostrado las mejores 3 opciones según tu presupuesto. ¿Quieres que profundice en alguna? Podrás chatear con detalles completos cuando el servicio IA vuelva a estar disponible.`;
      }
      if (plate || vin) {
        return `He detectado ${plate ? `matrícula **${plate}**` : ""}${plate && vin ? " y " : ""}${vin ? `VIN **${vin}**` : ""}. El asistente IA está temporalmente no disponible, pero puedes consultar:\n\n- **DGT oficial 8,67€** (tasa 4.1) en https://sede.dgt.gob.es/es/vehiculos/informe-de-vehiculo/\n- **CarVertical ~15€** en https://www.carvertical.com\n- **Carfax ~20€** en https://www.carfax.eu\n\nVuelve a intentar en unos segundos y te daré el análisis completo.`;
      }
      return "Lo siento, el asistente IA está temporalmente no disponible (timeout del proveedor). Por favor, intenta de nuevo en unos segundos. Si el problema persiste, refresca la página. Tus resultados de búsqueda seguirán disponibles arriba si había coches encontrados.";
    };

    // Attempt LLM stream with timeout + graceful fallback
    let llmTimeout: ReturnType<typeof setTimeout> | null = null;
    const abortController = new AbortController();
    llmTimeout = setTimeout(() => {
      console.warn("[chat] LLM timeout 10s — aborting stream for", conversationId);
      try { abortController.abort(); } catch {}
    }, 10000);

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
              await prisma.message.create({
                data: { conversationId, role: "assistant", content: text },
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

      // Stream with optional data block for car cards — ALWAYS send data first
      if (extraData) {
        const uiStream = createUIMessageStream({
          execute: async ({ writer }) => {
            // Send data so MessageList can render car cards even if LLM later fails
            (writer as unknown as { write: (c: unknown) => void }).write({
              type: "data",
              data: extraData,
              transient: false,
            });
            // Merge LLM stream — if it errors mid-flight, data is already sent
            try {
              writer.merge(toUIMessageStream({ stream: result.stream } as unknown as { stream: ReadableStream }));
            } catch (mergeErr) {
              console.error("[chat] merge error (LLM stream failed after data):", mergeErr, { model: CHAT_MODEL, conversationId, hasCars: extraDataCars.length > 0 });
              // fallback text will be handled by client error overlay, but data already delivered
            }
          },
          onFinish: async () => {
            if (llmTimeout) clearTimeout(llmTimeout);
          },
        });
        const response = createUIMessageStreamResponse({ stream: uiStream });
        response.headers.set("x-automisho-cars", encodeURIComponent(JSON.stringify(extraData)));
        return response;
      }

      return createUIMessageStreamResponse({
        stream: toUIMessageStream({ stream: result.stream } as unknown as { stream: ReadableStream }),
      });
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
          await prisma.message.create({
            data: { conversationId, role: "assistant", content: fallbackText },
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
