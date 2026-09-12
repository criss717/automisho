export function parsePrice(s: string): number {
  const cleaned = s.replace(/[.,]/g, "").replace(/k/i, "000");
  const digits = cleaned.replace(/[^\d]/g, "");
  const n = parseInt(digits, 10);
  if (isNaN(n)) return 0;
  return Math.max(500, Math.min(100000, n));
}

export function parsePriceSmart(raw: string, fullMatch: string): number {
  const hasK = /k/i.test(fullMatch);
  if (hasK) {
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
  doors?: number;
} {
  const lower = message.toLowerCase();
  let maxPrice: number | undefined;
  let minPrice: number | undefined;

  const patterns: RegExp[] = [
    /entre\s+(\d[\d.,]*)\s*(?:k\s*)?\s+y\s+(\d[\d.,]*)\s*(?:k\s*)?(?:€|euros?|eur)?/i,
    /(\d[\d.,]*)\s*k\s*(?:€|euros?)?/i,
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
    if (pat.source.includes("entre") && m[1] && m[2]) {
      const a = parsePriceSmart(m[1], m[0]);
      const b = parsePriceSmart(m[2], m[0]);
      if (a && b) {
        minPrice = Math.min(a, b);
        maxPrice = Math.max(a, b);
      }
    } else {
      const raw = m[1] ?? m[2] ?? m[3] ?? m[4];
      const candidate = raw || m[0].match(/(\d[\d.,]*)/)?.[1];
      if (candidate) {
        const parsed = parsePriceSmart(candidate, m[0]);
        if (parsed) maxPrice = parsed;
      }
    }
    if (maxPrice !== undefined) break;
  }

  if (maxPrice === undefined) {
    const maxPattern = /(?:máximo|máx\.?)\s*(\d[\d.,]*)\s*(?:k\s*)?(?:€|euros?)?/i;
    const m = lower.match(maxPattern);
    if (m && m[1]) maxPrice = parsePriceSmart(m[1], m[0]);
  }

  let doors: number | undefined;
  if (/\b(?:3|tres)\s*(?:p|puertas?)\b/i.test(lower)) {
    doors = 3;
  } else if (/\b(?:5|cinco)\s*(?:p|puertas?)\b/i.test(lower)) {
    doors = 5;
  } else if (/\b(?:4|cuatro)\s*(?:p|puertas?)\b/i.test(lower)) {
    doors = 4;
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
    "puertas", "puerta",
    "descapotable", "cabrio", "cabriolet", "roadster", "spider", "coupé", "coupe",
    "rojo", "negro", "blanco", "azul", "gris",
    "reventa", "revender", "oferton", "ofertones", "chollo", "chollos", "oportunidad", "daño", "dañado", "arreglar", "reparar",
  ];

  const hasSearchIntent = searchKeywords.some((kw) => lower.includes(kw));
  const hasPriceOrYear = maxPrice !== undefined || /\b20\d{2}\b/.test(lower);
  const hasKPattern = /\d[\d.,]*\s*k\b/i.test(lower);
  const hasDoors = doors !== undefined;
  const hasModeloConocido = ["seat", "bmw", "audi", "león", "leon", "ibiza", "golf", "clio", "corolla", "focus", "toyota", "mercedes"].some((m) =>
    lower.includes(m)
  );

  let isSearch = hasSearchIntent || hasPriceOrYear || hasKPattern || hasModeloConocido || hasDoors;
  if (hasPriceOrYear && !hasSearchIntent) isSearch = true;

  if (!hasSearchIntent && !maxPrice && !hasKPattern && !hasDoors && /\b20\d{2}\b/.test(lower)) {
    isSearch = false;
  }

  return {
    isSearch,
    query: message,
    maxPrice,
    minPrice,
    doors,
  };
}

import type { CarResult } from "@/types";

export function isCarMatchingDoors(title: string, url: string = "", requestedDoors?: number): boolean {
  if (!requestedDoors) return true;
  const text = `${title} ${url}`.toLowerCase();
  
  if (requestedDoors === 3) {
    if (/\b[45]p\b|\b[45]\s*puertas?|\b[45]ptas?\b|[45]p-/i.test(text)) return false;
    if (/\b(?:sedan|berlina|familiar|avant|touring|station|combi|break|monovolumen|suv|sw)\b/i.test(text)) return false;
    if (/\b(?:a[468]|passat|bora|jetta|tiguan|touran|sharan|mondeo|c-max|s-max|galaxy|kuga|insignia|vectra|zafira|meriva|mokka|laguna|talisman|espace|scenic|modus|40[67]|508|[235]008|c[56]|picasso|berlingo|toledo|exeo|alhambra|s[468]0|v[4567]0|xc\d{2}|avensis|prius|rav4|primera|qashqai|accord|cr-v|octavia|superb|tucson|sportage)\b/i.test(text)) return false;
    if (/\b(?:fabia|c3(?!.*pluriel)|sandero|duster|logan|captur|juke|arona|ateca)\b/i.test(text)) return false;
    if (/\bmercedes.*?\b(?:[ces]\s*\d{3}|clase\s*[cesb])\b/i.test(text)) return false;
    if (/\bbmw.*?\b(?:serie\s*[357]|[357]\d{2}[a-z]?)\b/i.test(text)) return false;
    return true;
  }
  
  if (requestedDoors >= 4) {
    if (/\b(?:3p|3\s*puertas?|3ptas?|3p-|cabrio|roadster|2p)\b|coup[eé]/i.test(text)) return false;
    return true;
  }
  
  return true;
}

export function enrichCarResult(car: Record<string, unknown>, requestedMaxPrice?: number, requestedDoors?: number): CarResult {
  const price = typeof car.price === "number" ? car.price : (parseInt(String(car.price || "0").replace(/[^\d]/g, ""), 10) || 0);
  const year = car.year ? (typeof car.year === "number" ? car.year : parseInt(String(car.year), 10) || null) : null;
  const km = car.km ? (typeof car.km === "number" ? car.km : parseInt(String(car.km).replace(/[^\d]/g, ""), 10) || null) : null;
  const title = String(car.title || "Vehículo sin título");
  const fuel = car.fuel ? String(car.fuel) : null;
  const source = String(car.source || "web");
  const url = car.url ? String(car.url) : undefined;
  const image_url = (car.image_url as string | null) || (car.image as string | null) || null;
  const location = car.location ? String(car.location) : null;

  let score = 82;
  const pros: string[] = [];
  const cons: string[] = [];

  if (requestedMaxPrice && price > 0) {
    if (price <= requestedMaxPrice) {
      score += 5;
      pros.push(`Dentro de tu presupuesto (< ${requestedMaxPrice.toLocaleString("es-ES")}€)`);
    } else if (price > requestedMaxPrice * 1.15) {
      score -= 30;
      cons.push(`Excede tu presupuesto de ${requestedMaxPrice.toLocaleString("es-ES")}€ (${price.toLocaleString("es-ES")}€)`);
    } else {
      pros.push(`Precio cercano al presupuesto`);
    }
  } else if (price > 0) {
    pros.push(`Precio competitivo en el mercado actual`);
  }

  if (requestedDoors !== undefined) {
    const fullText = `${title} ${url || ""}`.toLowerCase();
    const matches = isCarMatchingDoors(title, url, requestedDoors);
    if (!matches) {
      score -= 50;
      cons.push(`No cumple tu requisito de ${requestedDoors} puertas`);
    } else {
      if (requestedDoors === 3) {
        const isExplicit3 = /\b3p\b|\b3\s*puertas?|3p-|coupe|coupé/i.test(fullText);
        if (isExplicit3) {
          score += 8;
          pros.push("Carrocería de 3 puertas confirmada");
        }
      } else {
        score += 5;
        pros.push(`Carrocería de ${requestedDoors} puertas`);
      }
    }
  }

  if (year && year >= 2018) {
    score += 6;
    pros.push(`Año reciente (${year}) con etiqueta medioambiental C`);
  } else if (year && year >= 2014) {
    score += 3;
    pros.push(`Modelo consolidado (${year})`);
  } else if (year && year < 2010) {
    score -= 4;
    cons.push(`Modelo veterano (${year}) — comprobar emisiones`);
  }

  if (km && km < 80000) {
    score += 5;
    pros.push(`Bajo kilometraje (${km.toLocaleString("es-ES")} km)`);
  } else if (km && km > 160000) {
    score -= 4;
    cons.push(`Kilometraje alto (${km.toLocaleString("es-ES")} km) — verificar correa y embrague`);
  } else if (km) {
    pros.push(`Kilometraje equilibrado (${km.toLocaleString("es-ES")} km)`);
  }

  if (fuel) {
    const fLower = fuel.toLowerCase();
    if (fLower.includes("diésel") || fLower.includes("diesel")) {
      pros.push("Motor diésel eficiente en trayectos largos");
    } else if (fLower.includes("gasolina")) {
      pros.push("Motor gasolina de mantenimiento sencillo");
    } else if (fLower.includes("híbrido") || fLower.includes("hibrido") || fLower.includes("eco")) {
      pros.push("Propulsión híbrida con distintivo ECO");
    }
  }

  if (cons.length === 0) {
    cons.push("Solicitar informe DGT y verificar libro de revisiones");
  }

  if (pros.length === 0) {
    pros.push("Excelente relación calidad/precio según análisis IA");
    pros.push("Disponibilidad con anuncio activo");
  }

  score = Math.min(98, Math.max(65, score));

  const rawImages = Array.isArray((car as Record<string, unknown>).images)
    ? ((car as Record<string, unknown>).images as string[]).filter(
        (u) => typeof u === "string" && u.startsWith("http")
      )
    : [];
  const images = rawImages.length > 0 ? rawImages : image_url ? [image_url] : [];

  return {
    title,
    price,
    year,
    km,
    fuel,
    location,
    source,
    url,
    image_url,
    images,
    doors: requestedDoors || ((car as Record<string, unknown>).doors as number | undefined),
    score,
    pros: pros.slice(0, 3),
    cons: cons.slice(0, 2),
    alerts: cons.length > 1 ? 1 : 0,
  };
}

export function extractCarsFromMessageContent(content: string): CarResult[] {
  if (!content) return [];
  const match = content.match(/<!--AUTOMISHO_CARS_DATA:([\s\S]*?)-->/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) return parsed as CarResult[];
    } catch {
      // ignore
    }
  }
  return [];
}

export function cleanMessageContent(content: string): string {
  if (!content) return "";
  return content.replace(/<!--AUTOMISHO_CARS_DATA:[\s\S]*?-->/g, "").trim();
}


