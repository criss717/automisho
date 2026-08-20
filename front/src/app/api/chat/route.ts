import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { opencode, CHAT_MODEL, AUTOMISHO_SYSTEM_PROMPT } from "@/lib/ai";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// Detect if user is asking about cars
function detectCarSearch(message: string): {
  isSearch: boolean;
  query: string;
  maxPrice?: number;
} {
  const lower = message.toLowerCase();

  // Price patterns: "3000€", "3.000 euros", "menos de 5000", "por 2000"
  const priceMatch = lower.match(
    /(\d[\d.]*)\s*(?:€|euros?|eur)|menos\s+de\s+(\d[\d.]*)|por\s+(\d[\d.]*)|(?:presupuesto|budget)\s+(?:de\s+)?(\d[\d.]*)/i
  );
  const maxPrice = priceMatch
    ? parseInt((priceMatch[1] || priceMatch[2] || priceMatch[3] || priceMatch[4]).replace(/\./g, ""), 10)
    : undefined;

  // Search intent keywords
  const searchKeywords = [
    "coche", "coches", "vehículo", "vehiculos", "car",
    "busco", "buscar", "quiero", "necesito", "hay",
    "opciones", "disponibles", "en venta", "segunda mano",
    "suv", "berlina", "utilitario", "familiar",
    "diésel", "diesel", "gasolina", "eléctrico", "hibrido", "híbrido",
    "seat", "volkswagen", "vw", "renault", "peugeot", "toyota",
    "bmw", "mercedes", "ford", "opel", "nissan", "hyundai", "kia",
  ];

  const hasSearchIntent = searchKeywords.some((kw) => lower.includes(kw));
  const hasPriceOrYear = maxPrice !== undefined || /\b20\d{2}\b/.test(lower);

  return {
    isSearch: hasSearchIntent && hasPriceOrYear,
    query: message,
    maxPrice,
  };
}

// Detect DGT plate
function detectPlate(message: string): string | null {
  const match = message.match(/\b(\d{4}[\s-]?[BCDFGHJKLMNPRSTVWXYZ]{3})\b/i);
  return match ? match[1].toUpperCase().replace(/[\s-]/g, "").replace(/(.{4})/, "$1-") : null;
}

async function searchBackend(query: string, maxPrice?: number) {
  try {
    const res = await fetch(`${BACKEND_URL}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        source: "auto",
        max_results: 8,
        max_price: maxPrice,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
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

  try {
    const { messages, conversationId } = await req.json();

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

    // Detect intents and fetch data IN PARALLEL
    const search = detectCarSearch(userText);
    const plate = detectPlate(userText);

    let contextData = "";

    if (search.isSearch) {
      const searchResults = await searchBackend(search.query, search.maxPrice);
      console.log("[chat] search results:", searchResults?.total ?? 0, "from", searchResults?.source);

      if (searchResults?.results?.length > 0) {
        const cars = searchResults.results
          .map(
            (c: Record<string, unknown>, i: number) =>
              `${i + 1}. **${c.title}** — ${c.price ? c.price.toLocaleString("es-ES") + "€" : "Precio no disponible"} | ${c.year || "¿?"} | ${c.km ? c.km.toLocaleString("es-ES") + "km" : "¿km?"} | ${c.fuel || ""} | Fuente: ${c.source}${c.url ? ` | ${c.url}` : ""}`
          )
          .join("\n");

        contextData = `\n\n## Resultados de búsqueda en tiempo real (${searchResults.total} coches encontrados en ${searchResults.source}):\n${cars}\n\nResponde con estos datos reales. Muestra los 3-5 mejores según el criterio del usuario.`;
      } else {
        contextData = `\n\n## Búsqueda ejecutada pero sin resultados\nSe buscó "${search.query}"${search.maxPrice ? ` con precio máximo ${search.maxPrice}€` : ""} en AutoScout24, coches.net y Wallapop. No se encontraron anuncios. Informa al usuario y sugiere ajustar la búsqueda (cambiar marca, ampliar presupuesto, etc.).`;
      }
    }

    if (plate) {
      const dgtResult = await lookupDgt(plate);
      if (dgtResult && !dgtResult.error) {
        contextData += `\n\n## Consulta DGT — Matrícula ${dgtResult.plate}:\n- Marca: ${dgtResult.make}\n- Modelo: ${dgtResult.model}\n- Año: ${dgtResult.year}\n- Combustible: ${dgtResult.fuel}\n- Potencia: ${dgtResult.power}\n- ITV: ${dgtResult.itv_status}\n- Matriculación: ${dgtResult.enrollment_date}`;
      }
    }

    console.log("[chat] model:", CHAT_MODEL, "| search:", search.isSearch, "| plate:", plate, "| conv:", conversationId);

    // Build enhanced system prompt with context data
    const systemPrompt = contextData
      ? `${AUTOMISHO_SYSTEM_PROMPT}\n\n---\nTienes datos reales del sistema. Úsalos para responder al usuario. NO inventes datos.${contextData}`
      : AUTOMISHO_SYSTEM_PROMPT;

    const result = streamText({
      model: opencode(CHAT_MODEL),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      onFinish: async ({ text }) => {
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

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[chat] Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
