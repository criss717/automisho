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

// ── Helpers ───────────────────────────────────────────────────────────────

function parsePrice(s: string): number {
  // "3.000" → 3000, "15.5" → 155 (without k) but clamped; k handled separately
  const cleaned = s.replace(/[.,]/g, "").replace(/k/i, "000");
  const digits = cleaned.replace(/[^\d]/g, "");
  const n = parseInt(digits, 10);
  if (isNaN(n)) return 0;
  // Clamp price 500..100000 per spec
  return Math.max(500, Math.min(100000, n));
}

function parsePriceSmart(raw: string, fullMatch: string): number {
  const hasK = /k/i.test(fullMatch);
  if (hasK) {
    // handle "15.5k" -> 15500, "15k" -> 15000, "15.000k" -> 15000
    const normalized = raw.replace(",", ".").trim();
    const f = parseFloat(normalized.replace(/[^\d.]/g, ""));
    if (isNaN(f)) return 0;
    const val = Math.round(f * 1000);
    return Math.max(500, Math.min(100000, val));
  }
  return parsePrice(raw);
}

// Detect VIN 17 chars without I,O,Q
export function detectVIN(message: string): string | null {
  const m = message.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i);
  return m ? m[0].toUpperCase() : null;
}

// Detect DGT plate without A,E,I,O,U,Q,Ñ
export function detectPlate(message: string): string | null {
  const m = message.match(/\b(\d{4}[\s-]?[BCDFGHJKLMNPRSTVWXYZ]{3})\b/i);
  if (!m) return null;
  const normalized = m[1].toUpperCase().replace(/[\s-]/g, "");
  return normalized.replace(/(.{4})/, "$1-");
}

export function detectCarSearch(message: string): {
  isSearch: boolean;
  query: string;
  maxPrice?: number;
  minPrice?: number;
} {
  const lower = message.toLowerCase();
  let maxPrice: number | undefined;
  let minPrice: number | undefined;

  // 8 price patterns in priority order
  // Note: order matters — entre range first, then k€, then specific, then generic €
  const patterns: RegExp[] = [
    /entre\s+(\d[\d.,]*)\s*(?:k\s*)?\s+y\s+(\d[\d.,]*)\s*(?:k\s*)?(?:€|euros?|eur)?/i, // entre X y Y
    /(\d[\d.,]*)\s*k\s*(?:€|euros?)?/i, // 15k, 15.5k €
    /menos\s+de\s+(\d[\d.,]*)\s*(?:k\s*)?(?:€|euros?)?/i,
    /hasta\s+(\d[\d.,]*)\s*(?:k\s*)?(?:€|euros?)?/i,
    /máximo|máx\.?\s*(\d[\d.,]*)/i,
    /(\d[\d.,]*)\s*(?:€|euros?|eur)/i,
    /por\s+(\d[\d.,]*)/i,
    /(?:presupuesto|budget)\s+(?:de\s+)?(\d[\d.,]*)/i,
  ];

  for (const pat of patterns) {
    const m = lower.match(pat);
    if (!m) continue;
    // entre pattern has 2 groups
    if (pat.source.includes("entre") && m[1] && m[2]) {
      const a = parsePriceSmart(m[1], m[0]);
      const b = parsePriceSmart(m[2], m[0]);
      if (a && b) {
        minPrice = Math.min(a, b);
        maxPrice = Math.max(a, b);
      }
    } else {
      // find first non-undefined group
      const raw = m[1] ?? m[2] ?? m[3] ?? m[4];
      // For máximo pattern, group may be at 1 but regex splits differently; handle fallback
      const candidate = raw || m[0].match(/(\d[\d.,]*)/)?.[1];
      if (candidate) {
        const parsed = parsePriceSmart(candidate, m[0]);
        if (parsed) maxPrice = parsed;
      }
    }
    if (maxPrice !== undefined) break;
  }

  // Also try to capture máx with separate handling if first attempt missed due to alternation
  if (maxPrice === undefined) {
    const maxPattern = /(?:máximo|máx\.?)\s*(\d[\d.,]*)\s*(?:k\s*)?(?:€|euros?)?/i;
    const m = lower.match(maxPattern);
    if (m && m[1]) maxPrice = parsePriceSmart(m[1], m[0]);
  }

  const searchKeywords = [
    "coche", "coches", "vehículo", "vehiculos", "car",
    "busco", "buscar", "quiero", "necesito", "hay",
    "opciones", "disponibles", "en venta", "segunda mano",
    "suv", "berlina", "utilitario", "familiar",
    "diésel", "diesel", "gasolina", "eléctrico", "hibrido", "híbrido",
    "seat", "volkswagen", "vw", "renault", "peugeot", "toyota",
    "bmw", "mercedes", "ford", "opel", "nissan", "hyundai", "kia",
    "audi", "león", "leon", "ibiza", "golf", "clio", "corolla", "serie", "focus",
  ];

  const hasSearchIntent = searchKeywords.some((kw) => lower.includes(kw));
  const hasPriceOrYear = maxPrice !== undefined || /\b20\d{2}\b/.test(lower);
  const hasKPattern = /\d[\d.,]*\s*k\b/i.test(lower);
  const hasModeloConocido = ["seat", "bmw", "audi", "león", "leon", "ibiza", "golf", "clio", "corolla", "focus", "toyota", "mercedes"].some((m) =>
    lower.includes(m)
  );

  let isSearch = hasSearchIntent || hasPriceOrYear || hasKPattern || hasModeloConocido;
  // If only price without keyword, still assume search (covers "menos de 3000" and "3000€")
  if (hasPriceOrYear && !hasSearchIntent) isSearch = true;

  // Anti-false-positive: year alone without coche context should not trigger
  if (!hasSearchIntent && !maxPrice && !hasKPattern && /\b20\d{2}\b/.test(lower)) {
    // Check if there's any car-related context; if not, false
    isSearch = false;
  }

  return {
    isSearch,
    query: message,
    maxPrice,
    minPrice,
  };
}

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

    const result = streamText({
      model: getChatModel(CHAT_MODEL),
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

    // Stream with optional data block for car cards
    if (extraData) {
      const uiStream = createUIMessageStream({
        execute: async ({ writer }) => {
          // Send data so MessageList can render car cards
          (writer as unknown as { write: (c: unknown) => void }).write({
            type: "data",
            data: extraData,
            transient: false,
          });
          writer.merge(toUIMessageStream({ stream: result.stream } as unknown as { stream: ReadableStream }));
        },
        onFinish: async () => {},
      });
      const response = createUIMessageStreamResponse({ stream: uiStream });
      response.headers.set("x-automisho-cars", encodeURIComponent(JSON.stringify(extraData)));
      return response;
    }

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream } as unknown as { stream: ReadableStream }),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[chat] Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
