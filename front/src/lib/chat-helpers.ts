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
  colors?: string[];
  excludedMakes?: string[];
  wantedMakes?: string[];
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

  const requestedColors: string[] = [];
  const COLOR_PATTERNS: Record<string, RegExp> = {
    negro: /\b(?:negro|negra|negros|negras|black)\b/i,
    gris: /\b(?:gris|grises|plata|plateado|plateada|grey|gray|silver)\b/i,
    blanco: /\b(?:blanco|blanca|blancos|blancas|white)\b/i,
    rojo: /\b(?:rojo|roja|rojos|rojas|red)\b/i,
    azul: /\b(?:azul|azules|blue)\b/i,
    verde: /\b(?:verde|verdes|green)\b/i,
    amarillo: /\b(?:amarillo|amarilla|amarillos|yellow)\b/i,
  };
  for (const [col, regex] of Object.entries(COLOR_PATTERNS)) {
    if (regex.test(lower)) {
      requestedColors.push(col);
    }
  }

  // Detect wanted and excluded makes with negation awareness
  const KNOWN_BRANDS = [
    "seat", "volkswagen", "vw", "renault", "peugeot", "pegout", "pegeot", "toyota",
    "bmw", "mercedes", "ford", "opel", "nissan", "hyundai", "kia", "audi",
    "skoda", "fiat", "citroen", "dacia", "mazda", "honda", "volvo", "alfa",
    "chevrolet", "lancia", "mitsubishi", "suzuki", "subaru"
  ];
  const words = lower.replace(/[^\w\s]/g, " ").split(/\s+/);
  const negationTokens = new Set(["no", "ni", "sin", "menos", "excepto", "descartar", "descarto", "fuera", "nada"]);
  const excludedMakes: string[] = [];
  const wantedMakes: string[] = [];

  // 1. Clause-level negation detection (e.g. "no sean de la marca opel ni peugeot ni chevrolet")
  const negClauseRegex = /(?:no|ni|sin|menos|excepto|descartar|descarto|fuera|nada\s+de)\s+(?:quiero\s+)?(?:que\s+sean?\s+)?(?:de\s+la\s+marca\s+|marca\s+|marcas\s+|coches?\s+)?([a-z0-9\s,]+?)(?:\.|$|y\s+solo|con\s+presupuesto|minimo|maximo)/gi;
  let clauseMatch: RegExpExecArray | null;
  while ((clauseMatch = negClauseRegex.exec(lower)) !== null) {
    const clauseTokens = clauseMatch[1].split(/\s+/);
    for (let t of clauseTokens) {
      if (t === "pegout" || t === "pegeot") t = "peugeot";
      if (t === "chebrolet") t = "chevrolet";
      if (KNOWN_BRANDS.includes(t) && !excludedMakes.includes(t)) {
        excludedMakes.push(t);
      }
    }
  }

  // 2. Token-level scan
  for (let i = 0; i < words.length; i++) {
    let w = words[i];
    if (w === "pegout" || w === "pegeot") w = "peugeot";
    if (w === "chebrolet") w = "chevrolet";
    if (KNOWN_BRANDS.includes(w)) {
      const prev1 = i > 0 ? words[i - 1] : "";
      const prev2 = i > 1 ? words[i - 2] : "";
      const prev3 = i > 2 ? words[i - 3] : "";
      const prev4 = i > 3 ? words[i - 4] : "";
      const isNeg =
        excludedMakes.includes(w) ||
        negationTokens.has(prev1) ||
        negationTokens.has(prev2) ||
        negationTokens.has(prev3) ||
        negationTokens.has(prev4);

      if (isNeg) {
        if (!excludedMakes.includes(w)) excludedMakes.push(w);
      } else {
        if (!wantedMakes.includes(w) && !excludedMakes.includes(w)) wantedMakes.push(w);
      }
    }
  }

  const searchKeywords = [
    "coche", "coches", "vehículo", "vehiculos", "car",
    "busco", "buscar", "quiero", "necesito", "hay",
    "opciones", "disponibles", "en venta", "segunda mano",
    "suv", "berlina", "utilitario", "familiar",
    "diésel", "diesel", "gasolina", "eléctrico", "hibrido", "híbrido",
    "león", "leon", "ibiza", "golf", "clio", "corolla", "serie", "focus",
    "puertas", "puerta",
    "descapotable", "cabrio", "cabriolet", "roadster", "spider", "coupé", "coupe",
    "reventa", "revender", "oferton", "ofertones", "chollo", "chollos", "oportunidad", "daño", "dañado", "arreglar", "reparar",
    ...KNOWN_BRANDS,
  ];

  const hasSearchIntent = searchKeywords.some((kw) => lower.includes(kw));
  const hasPriceOrYear = maxPrice !== undefined || /\b20\d{2}\b/.test(lower);
  const hasKPattern = /\d[\d.,]*\s*k\b/i.test(lower);
  const hasDoors = doors !== undefined;
  const hasColors = requestedColors.length > 0;
  const hasExcluded = excludedMakes.length > 0;
  const hasWanted = wantedMakes.length > 0;

  let isSearch = hasSearchIntent || hasPriceOrYear || hasKPattern || hasWanted || hasExcluded || hasDoors || hasColors;
  if (hasPriceOrYear && !hasSearchIntent) isSearch = true;

  if (!hasSearchIntent && !maxPrice && !hasKPattern && !hasDoors && !hasColors && /\b20\d{2}\b/.test(lower)) {
    isSearch = false;
  }

  return {
    isSearch,
    query: message,
    maxPrice,
    minPrice,
    doors,
    colors: requestedColors.length > 0 ? requestedColors : undefined,
    excludedMakes: excludedMakes.length > 0 ? excludedMakes : undefined,
    wantedMakes: wantedMakes.length > 0 ? wantedMakes : undefined,
  };
}

import type { CarResult } from "@/types";

export function isCarMatchingColor(
  title: string,
  requestedColors?: string[],
  visualColor?: string | null
): boolean {
  if (!requestedColors || requestedColors.length === 0) return true;
  const titleLower = title.toLowerCase();

  // 1. If visual color was identified by AI Vision
  if (visualColor) {
    const v = visualColor.toLowerCase();
    const matchesVisual = requestedColors.some((c) => v.includes(c));
    if (matchesVisual) return true;

    // Explicit conflicting color identified in visual audit -> reject
    const allKnownColors = ["blanco", "rojo", "azul", "verde", "amarillo", "negro", "gris"];
    const conflictingColors = allKnownColors.filter((c) => !requestedColors.includes(c));
    if (conflictingColors.some((oc) => v.includes(oc))) {
      return false;
    }
  }

  // 2. If title explicitly matches one of the requested colors
  const matchesTitle = requestedColors.some((c) => {
    const pattern = new RegExp(`\\b(?:${c}|${c}s|${c}a|${c}as)\\b`, "i");
    return pattern.test(titleLower);
  });
  if (matchesTitle) return true;

  // 3. If title explicitly declares a different conflicting color
  const allKnownColors = ["blanco", "rojo", "azul", "verde", "amarillo", "negro", "gris"];
  const conflictingColors = allKnownColors.filter((c) => !requestedColors.includes(c));
  const hasConflictingTitle = conflictingColors.some((c) => {
    const pattern = new RegExp(`\\b(?:${c}|${c}s|${c}a|${c}as)\\b`, "i");
    return pattern.test(titleLower);
  });
  if (hasConflictingTitle) {
    return false;
  }

  return true;
}

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

export interface EnrichCarOptions {
  maxPrice?: number;
  doors?: number;
  bodyType?: string | null;
  fuel?: string | null;
  minCv?: number | null;
  purpose?: string | null;
  colors?: string[];
  wantedMakes?: string[];
}

export function enrichCarResult(
  car: Record<string, unknown>,
  optionsOrMaxPrice?: EnrichCarOptions | number,
  requestedDoors?: number
): CarResult {
  const opts: EnrichCarOptions =
    typeof optionsOrMaxPrice === "number"
      ? { maxPrice: optionsOrMaxPrice, doors: requestedDoors }
      : optionsOrMaxPrice || {};

  const requestedMaxPrice = opts.maxPrice;
  const doors = opts.doors;
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

  if (doors !== undefined) {
    const fullText = `${title} ${url || ""}`.toLowerCase();
    const matches = isCarMatchingDoors(title, url, doors);
    if (!matches) {
      score -= 50;
      cons.push(`No cumple tu requisito de ${doors} puertas`);
    } else {
      if (doors === 3) {
        const isExplicit3 = /\b3p\b|\b3\s*puertas?|3p-|coupe|coupé/i.test(fullText);
        if (isExplicit3) {
          score += 8;
          pros.push("Carrocería de 3 puertas confirmada");
        }
      } else {
        score += 5;
        pros.push(`Carrocería de ${doors} puertas`);
      }
    }
  }

  // 1. Multicriteria: Body Type Alignment
  if (opts.bodyType) {
    const bLower = opts.bodyType.toLowerCase().trim();
    const fullText = `${title} ${url || ""}`.toLowerCase();

    if (bLower === "suv" || bLower === "todocamino" || bLower === "4x4") {
      const isSuv = /\b(?:suv|4x4|todocamino|crossover|captur|kadjar|koleos|duster|tiguan|touareg|t-roc|t-cross|qashqai|juke|x-trail|ateca|arona|tarraco|kuga|ecosport|puma|tucson|santa fe|sportage|sorento|rav4|cr-v|cx-[35]|cross|alltrack|allroad)\b/i.test(fullText);
      const isNonSuv = /\b(?:clio|twingo|twizy|polo|ibiza|fiesta|corsa|c3|208|yaris|micra|fabia|seicento|smart|coupe|coupé|cabrio)\b/i.test(fullText);
      if (isSuv) {
        score += 15;
        pros.push("Carrocería SUV/todocamino alineada con tu búsqueda");
      } else if (isNonSuv) {
        score -= 25;
        cons.push("Carrocería utilitaria/no SUV");
      }
    } else if (bLower.includes("cabrio") || bLower.includes("descapotable")) {
      const isCabrio = /\b(?:cabrio|cabriolet|descapotable|roadster|spider|cc|convertible)\b/i.test(fullText);
      if (isCabrio) {
        score += 15;
        pros.push("Carrocería descapotable confirmada");
      } else {
        score -= 30;
      }
    } else if (bLower.includes("familiar") || bLower.includes("station") || bLower.includes("tourer")) {
      const isFamiliar = /\b(?:familiar|station|wagon|sw|tourer|touring|avant|combi|break|estate|variant)\b/i.test(fullText);
      if (isFamiliar) {
        score += 15;
        pros.push("Carrocería familiar espaciosa con gran maletero");
      }
    } else if (bLower.includes("berlina") || bLower.includes("sedan")) {
      const isBerlina = /\b(?:berlina|sedan|sedán|toledo|passat|mondeo|insignia|octavia|superb|508|c5|talisman|laguna|serie 3|serie 5|clase c|clase e|a4|a6)\b/i.test(fullText);
      if (isBerlina) {
        score += 12;
        pros.push("Carrocería berlina espaciosa y confortable para carretera");
      }
    }
  }

  // 2. Multicriteria: Fuel Preference
  if (opts.fuel) {
    const reqFuel = opts.fuel.toLowerCase().trim();
    const fullText = `${title} ${fuel || ""}`.toLowerCase();
    if (reqFuel.includes("diesel") || reqFuel.includes("diésel")) {
      if (fullText.includes("diesel") || fullText.includes("diésel") || fullText.includes("tdi") || fullText.includes("dci") || fullText.includes("hdi") || fullText.includes("tdci")) {
        score += 8;
        pros.push("Motorización diésel requerida");
      } else if (fullText.includes("gasolina")) {
        score -= 15;
        cons.push("Motor gasolina (solicitaste diésel)");
      }
    } else if (reqFuel.includes("gasolina")) {
      if (fullText.includes("gasolina") || fullText.includes("tsi") || fullText.includes("tce") || fullText.includes("puretech")) {
        score += 8;
        pros.push("Motorización gasolina requerida");
      } else if (fullText.includes("diesel") || fullText.includes("diésel")) {
        score -= 15;
        cons.push("Motor diésel (solicitaste gasolina)");
      }
    } else if (reqFuel.includes("eco") || reqFuel.includes("hibrid") || reqFuel.includes("híbrid")) {
      if (fullText.includes("hibrid") || fullText.includes("híbrid") || fullText.includes("hybrid") || fullText.includes("eco")) {
        score += 15;
        pros.push("Propulsión híbrida / etiqueta ECO solicitada");
      }
    }
  }

  // 3. Multicriteria: MinCv / Power Requirement
  if (opts.minCv) {
    const fullText = `${title} ${url || ""}`.toLowerCase();
    const cvMatch = fullText.match(/\b(\d{2,3})\s*cv\b/i);
    if (cvMatch) {
      const cv = parseInt(cvMatch[1], 10);
      if (cv >= opts.minCv) {
        score += 10;
        pros.push(`Potencia de ${cv} CV (cumple mínimo de ${opts.minCv} CV)`);
      } else {
        score -= 30;
        cons.push(`Potencia de ${cv} CV inferior al mínimo de ${opts.minCv} CV`);
      }
    } else {
      const isHighPower = /\b(?:1\.9\s*tdi|2\.0\s*tdi|2\.0\s*hdi|1\.8\s*tdci|2\.0\s*dci|1\.6\s*tdi\s*105|1\.6\s*16v|v6|140|150|170)\b/i.test(fullText);
      const isLowPower = /\b(?:1\.9\s*sdi|1\.0\s*(?:mpi|mcv)?|1\.2\s*(?:60|16v\s*60)?|twizy|smart\s*fortwo)\b/i.test(fullText);
      if (opts.minCv >= 80 && isLowPower) {
        score -= 35;
        cons.push(`Motorización básica (< 70 CV), no asegura el mínimo de ${opts.minCv} CV`);
      } else if (isHighPower) {
        score += 8;
        pros.push(`Motorización solvente que supera ${opts.minCv} CV`);
      }
    }
  }

  // 4. Multicriteria: Highway / Long Distance suitability
  if (opts.purpose && /viaje|viajes\s*largos|autov[ií]a|carretera|hacer\s*km/i.test(opts.purpose)) {
    const fullText = `${title} ${url || ""}`.toLowerCase();
    const isLongDistanceIdeal = /\b(?:berlina|sedan|toledo|passat|mondeo|golf|leon|león|octavia|focus|megane|mégane|1\.9\s*tdi|2\.0\s*tdi|2\.0\s*hdi)\b/i.test(fullText);
    const isUrbanOnly = /\b(?:twizy|smart|seicento|micra|matiz|ka|aygo|c1|107|108|1\.9\s*sdi)\b/i.test(fullText);
    if (isLongDistanceIdeal) {
      score += 8;
      pros.push("Aplomo, confort y autonomía óptimos para viajes largos");
    } else if (isUrbanOnly) {
      score -= 20;
      cons.push("Enfoque puramente urbano, poco adecuado para viajes largos continuados");
    }
  }

  // 5. Multicriteria: Color Mention in Title
  if (opts.colors && opts.colors.length > 0) {
    const fullText = `${title} ${url || ""}`.toLowerCase();
    const matchesColorTitle = opts.colors.some((c) => {
      const p = new RegExp(`\\b(?:${c}|${c}s|${c}a|${c}as)\\b`, "i");
      return p.test(fullText);
    });
    if (matchesColorTitle) {
      score += 10;
      pros.push(`Color exterior coincidente (${opts.colors.join("/")})`);
    }
  }

  // 6. Multicriteria: Preferred / Wanted Makes
  if (opts.wantedMakes && opts.wantedMakes.length > 0) {
    const tLower = title.toLowerCase();
    if (opts.wantedMakes.some((m) => new RegExp(`\\b${m}\\b`, "i").test(tLower))) {
      score += 10;
      pros.push("Marca solicitada por el usuario");
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
  const images = ensureCarGallery(
    { title, fuel, image_url, images: rawImages },
    rawImages.length > 0 ? rawImages : image_url ? [image_url] : []
  );

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

export function filterRealCarImages(images: (string | undefined | null)[]): string[] {
  const blacklist = [
    "ladonnaemobile",
    "multimarca",
    "concesionario",
    "dealer",
    "logo",
    "banner",
    "watermark",
    "placeholder",
    "avatar",
    "icon",
    "badge",
    "unsplash.com",
    "static-cochesnet",
    "images/icons",
    "seller-logo",
    "dealer-logo",
  ];
  return images
    .filter((u): u is string => typeof u === "string" && u.trim().startsWith("http") && !u.endsWith(".svg") && !u.includes(".svg?"))
    .filter((u) => !blacklist.some((bad) => u.toLowerCase().includes(bad)));
}

export function ensureCarGallery(
  car: { title?: string; fuel?: string | null; image_url?: string | null; images?: string[] },
  existingImages?: string[]
): string[] {
  const imgs = (existingImages && existingImages.length > 0)
    ? [...existingImages]
    : car.images && car.images.length > 0
    ? [...car.images]
    : car.image_url
    ? [car.image_url]
    : [];

  const realImages = filterRealCarImages(imgs);
  const deduped: string[] = [];
  for (const img of realImages) {
    if (!deduped.includes(img)) {
      deduped.push(img);
    }
  }
  return deduped;
}

export function extractCarsFromMessageContent(content: string): CarResult[] {
  if (!content) return [];
  const match = content.match(/<!--AUTOMISHO_CARS_DATA:([\s\S]*?)-->/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        return (parsed as CarResult[]).map((c) => ({
          ...c,
          images: ensureCarGallery(c, c.images),
        }));
      }
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


