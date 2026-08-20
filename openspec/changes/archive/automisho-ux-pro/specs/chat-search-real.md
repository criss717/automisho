# Spec Delta — chat-search-real

**Change:** `automisho-ux-pro`
**Delta:** `chat-search-real`
**Status:** proposed
**Source:** `exploration.md` §3 + §7, `proposal.md` §2.3 + §4.3, `front/src/app/api/chat/route.ts:14-73`, `server/routers/scrape.py:11-260`, `front/src/components/chat/CarResultCard.tsx:6-72`, `MessageBubble.tsx:25`, `MessageList.tsx:60-65`, `ChatWindow.tsx:3-57`, `front/src/types/index.ts:3-12`, `server/models/schemas.py`, `front/next.config.ts`, `front/src/lib/ai.ts:15`, `front/.env.local:13`
**Stack:** Next.js 16 AI SDK + FastAPI + httpx + BeautifulSoup lxml + `asyncio.gather`

---

## 1. Objetivo

Convertir el chat en **buscador real** con tolerancia lingüística española coloquial, 4 scrapers paralelos robustos, cards ricas con `image_url` y links cliqueables, y soporte de imágenes de usuario con modelo `qwen3.7-plus`.

Hoy `detectCarSearch` exige `keyword coche + precio` (AND estricto) y deja fuera `"menos de 3000"` sin coche; `scrape.py` borra números de `coches.net`, hace URLs 404 en AutoScout24, es secuencial y sin `milanuncios`; `CarResultCard` existe pero nunca se renderiza y `image_url` nunca llega.

---

## 2. Requerimientos (RFC 2119)

### 2.1 Detección lingüística `detectCarSearch` (`front/src/app/api/chat/route.ts:14-48`)

| ID | Requerimiento | Keyword |
|----|---------------|---------|
| REQ-001 | `detectCarSearch` **MUST** detectar patterns de precio españoles: `menos de (\d[\d.,]*)`, `hasta (\d[\d.,]*)`, `máximo/máx\.? (\d[\d.,]*)`, `entre (\d[\d.,]*)\s+y\s+(\d[\d.,]*)`, `(\d[\d.,]*)\s*k\s*(?:€|euros?)?` (ej. `15k`, `15.5k €`), `(\d[\d.,]*)\s*(?:€|euros?|eur)`, `por (\d[\d.,]*)`, `(?:presupuesto|budget)\s+(?:de\s+)?(\d[\d.,]*)` | MUST |
| REQ-002 | La función **MUST** normalizar `k` → `*1000` y eliminar separadores `.,` antes de `parseInt` (helper `parsePrice(s:string):number { return parseInt(s.replace(/[.,]/g,"").replace(/k/i,"000"),10) }`) y **MUST** capturar rango `entre X y Y` como `maxPrice=Y` y `minPrice=X` opcional | MUST |
| REQ-003 | `detectCarSearch` **MUST** usar OR logic con scoring, no AND estricto: `isSearch = hasSearchIntent \|\| hasPriceOrYear \|\| hasKPattern \|\| hasModeloConocido`; si `hasPriceOrYear && !hasSearchIntent` **MUST** asumir búsqueda (`hasSearchIntent=true` implícito) con query original | MUST |
| REQ-004 | `hasSearchIntent` **MUST** ampliar keywords con al menos: `["coche","coches","vehículo","busco","quiero","hay","opciones","segunda mano","suv","berlina","utilitario","familiar","diésel","gasolina","eléctrico","híbrido","seat","volkswagen","vw","renault","peugeot","toyota","bmw","mercedes","ford","opel","nissan","hyundai","kia"]` (≥30) + modelos frecuentes | MUST |
| REQ-005 | `hasPriceOrYear` **MUST** incluir `maxPrice !== undefined \|\| /\b20\d{2}\b/.test(lower)` | MUST |
| REQ-006 | `detectPlate` **MUST** mejorar validación letras prohibidas: regex `/\b(\d{4}[\s-]?[BCDFGHJKLMNPRSTVWXYZ]{3})\b/i` (sin A,E,I,O,U,Q,Ñ) y retorno `1234-BCD` upper con guion | MUST |
| REQ-007 | `detectVIN` **MUST** exponerse como helper separado con `/\b[A-HJ-NPR-Z0-9]{17}\b/i` (excluye I,O,Q) para uso en dgt-didactic | MUST |

### 2.2 Backend scraping (`server/routers/scrape.py`)

| ID | Requerimiento | Keyword |
|----|---------------|---------|
| REQ-008 | `HEADERS` **MUST** incluir `Accept-Encoding: gzip, deflate, br` y **SHOULD** rotar `User-Agent` mínimo entre 2 variantes Chrome | MUST/SHOULD |
| REQ-009 | `scrape_cars` **MUST** clamp `max_results` a rango `1..12` (`req.max_results = max(1, min(req.max_results, 12))`) | MUST |
| REQ-010 | `scrape_cars` **MUST** ejecutar 4 fuentes en paralelo vía `asyncio.gather(*tasks, return_exceptions=True)` para `["autoscout24","cochesnet","wallapop","milanuncios"]` cuando `source==="auto"`; **MUST** aplanar `flat=[r for r in results if isinstance(r,list) for r in r]` y dedup por `url` | MUST |
| REQ-011 | El timeout por scraper **MUST** ser `12s` (httpx `timeout=12`) con **retry 1×** con backoff 500ms en `httpx.HTTPError`; Wallapop/autoscout/coches.net **MUST** compartir mismo `httpx.AsyncClient` pattern | MUST |
| REQ-012 | `noise` en `_scrape_autoscout24` **MUST NOT** incluir números; solo stopwords `{"coches","coche","por","de","del","un","una","el","la","menos","más","que","euros","€","euro","segunda","mano","hay","buenos","baratos"}` | MUST |
| REQ-013 | `_scrape_autoscout24` **MUST** construir URL robusta: slugify `clean_parts` + `urllib.parse.quote`; si `clean_parts` tiene `suv familiar` **MUST** fallback a `https://www.autoscout24.es/lst?keywords=<encoded>` sin generar `/lst/suv/familiar` 404 | MUST |
| REQ-014 | `_scrape_autoscout24` params **MUST** soportar `priceto` (max_price), `pricefrom` (min_price), `cy` year, `km` si `req.min_year/max_km` presentes | MUST |
| REQ-015 | `noise` en `_scrape_cochesnet` **MUST NOT** incluir `"2000","2500","3000","5000","10000"...` (números explícitos); solo stopwords lingüísticos | MUST |
| REQ-016 | `_scrape_cochesnet` **MUST** enviar `Keywords=clean_query` y respetar `MinPrice/MaxPrice` ya existentes | MUST |
| REQ-017 | `_scrape_wallapop` **MUST** parametrizar `latitude/longitude` dinámico desde `req.query` (map `{madrid:40.4168,-3.7038, barcelona:41.3851,2.1734, valencia:39.4699,-0.3763, sevilla:37.3891,-5.9845, fallback:Madrid}`) en lugar de fijo Madrid | MUST |
| REQ-018 | `_scrape_wallapop` **MUST** manejar `__NEXT_DATA__` con `props.pageProps.items[]` y fallback `ItemCard` genérico, limitado por `SoupStrainer` si aplica | MUST |
| REQ-019 | El sistema **MUST** incluir `_scrape_milanuncios(req)` nuevo: `GET https://www.milanuncios.com/coches-de-segunda-mano/?demanda=n&precio-desde=&precio-hasta={max_price}&keywords={clean_query}` con `SoupStrainer("article")`, selector `article.ma-AdCardV2` fallback `div.ad-card`, parse `title/price/year/km/url/image_url` | MUST |
| REQ-020 | `_scrape_milanuncios` **MUST** respetar clamp y timeout 12s y retornar `list[CarResult]` con `source="milanuncios"` | MUST |
| REQ-021 | Cada `_scrape_*` **MUST** incluir `image_url` cuando exista (`autoscout` desde `img src`, `coches.net` desde `img`, `wallapop` desde `images[0].original`, `milanuncios` desde `img data-src`) | MUST |
| REQ-022 | `server/models/schemas.py` `CarResult.price` **MUST** permanecer `int` y mapeo **MUST** coherente; si frontend necesita string, formateo es solo display | MUST |

### 2.3 Chat route + render (`front/src/app/api/chat/route.ts`, `front/src/types/index.ts`, `front/next.config.ts`, `front/src/lib/ai.ts`)

| ID | Requerimiento | Keyword |
|----|---------------|---------|
| REQ-023 | `searchBackend` **MUST** enviar `max_results: clamp 1..12` y `max_price` parseado, con `fetch` timeout `AbortController` 12s | MUST |
| REQ-024 | `chat/route.ts` **MUST** devolver `CarResult[]` tipado (`price:number`, `image_url:string|null`, `year:number|null`, `km:number|null`, `url:string`, `source:string`) además de markdown context; **MUST** exponer `extraData = { cars: data.results.map(c=>({...c, image_url:c.image_url ?? c.image})) }` vía `createUIMessageStreamResponse({ stream: toUIMessageStream(...), data: extraData })` o `tool` parts | MUST |
| REQ-025 | `front/src/types/index.ts` `CarResult` **MUST** corregirse a `price:number` (no string), `year:number|string`, `km:number|string`, con `image_url?:string`, `url:string`, `source:string`, `score?:number`, `location?:string` alineado con `server/models/schemas.py` | MUST |
| REQ-026 | `MessageList.tsx:60-65` **MUST** renderizar `CarResultCard` cuando `part.type==="data" && part.data?.cars` o `tool-invocation` `searchCars`, en `grid gap-3` con `target="_blank" rel="noopener"` en links | MUST |
| REQ-027 | `CarResultCard.tsx` **MUST** mostrar `image_url` con `next/image` o `img` con `alt`, `title` Teodor 28px, `price` formateado `es-ES`, `year·km·fuel`, `source` badge, barra score gradient, sin romper layout `max-w-[320px]` | MUST |
| REQ-028 | `front/next.config.ts` **MUST** whitelist `images.remotePatterns` para `**.autoscout24.es`, `**.coches.net`, `**.wallapop.com`, `**.milanuncios.com`, `cdn.milanuncios.com` | MUST |
| REQ-029 | `front/src/lib/ai.ts` `CHAT_MODEL` **MUST** usar `process.env.OPENCODE_MODEL ?? "qwen3.7-plus"` con fallback `deepseek-v4-pro` si `qwen` no disponible; `front/.env.local:13` **MUST** setear `OPENCODE_MODEL=qwen3.7-plus` | MUST |
| REQ-030 | `ChatWindow.tsx` **MUST** soportar `experimental_attachments` (AI SDK) y `convertToModelMessages` **MUST** preservar parts `image` para visión qwen | MUST |
| REQ-031 | `CarResultCard` links **MUST** incluir `rel="noopener noreferrer"` y `target="_blank"` | MUST |
| REQ-032 | `chat/route.ts` **SHOULD** clamp `max_results` defensivo y loggear `[chat] search results: <total> from <source>` con `max_price` | SHOULD |

---

## 3. Escenarios (Gherkin)

### SCN-001 — "menos de 3000" dispara sin keyword coche (bug fix principal)
```gherkin
GIVEN usuario envía "menos de 3000"
WHEN detectCarSearch("menos de 3000") evalúa
THEN priceMatch captura group "3000" via /menos\s+de\s+(\d[\d.,]*)/i
  AND maxPrice=3000
  AND hasPriceOrYear=true
  AND isSearch=true por OR logic (aunque hasSearchIntent=false, se asume búsqueda)
  AND searchBackend POST /scrape {query:"menos de 3000", max_price:3000, max_results:8} se dispara
  AND servidor retorna ≥3 resultados agregados de 4 fuentes en <3s
```

### SCN-002 — Variantes lingüísticas disparan
```gherkin
GIVEN fixtures lingüísticos:
  | query                    | maxPrice |
  | "hasta 5000"             | 5000     |
  | "máximo 7000"            | 7000     |
  | "máx. 4500"              | 4500     |
  | "entre 3000 y 6000"      | 6000 (min 3000) |
  | "15k"                    | 15000    |
  | "15.5k €"                | 15500    |
  | "presupuesto 4000"       | 4000     |
  | "3000€" solo             | 3000     |
WHEN detectCarSearch(query) para cada uno
THEN isSearch=true y maxPrice/minPrice correctos
```

### SCN-003 — "3000€" solo dispara (no requiere coche)
```gherkin
GIVEN usuario dice "3000€"
WHEN detectCarSearch evalúa
THEN priceMatch captura 3000 via /(\d[\d.,]*)\s*(?:€|euros?)/i
  AND isSearch=true
```

### SCN-004 — "busco suv diésel" sin precio también dispara
```gherkin
GIVEN usuario dice "busco suv diésel barato"
WHEN detectCarSearch evalúa
THEN hasSearchIntent=true (suv, diésel, busco)
  AND isSearch=true por hasSearchIntent aunque maxPrice undefined
  AND searchBackend se dispara con max_price undefined
```

### SCN-005 — "en 2024" solo NO dispara (falso positivo evitado)
```gherkin
GIVEN usuario dice "en 2024 me casé"
WHEN detectCarSearch evalúa
THEN hasPriceOrYear=true por 2024 pero hasSearchIntent=false y sin k/presupuesto
  AND isSearch=false (scoring: requiere al menos keyword o precio+k)
  # Nota: si política es OR puro, este caso dispara; spec exige scoring que evite disparar solo por año sin contexto coche
```

### SCN-006 — scrape_cars paralelo 4 fuentes + clamp + dedupe
```gherkin
GIVEN req {query:"suv familiar", max_price:8000, max_results:20}
WHEN POST /scrape source auto
THEN server clampa max_results a 12
  AND lanza gather para autoscout24, cochesnet, wallapop, milanuncios en paralelo con timeout 12s
  AND si una fuente falla (return_exceptions), las otras 3 siguen y flat dedup por url retorna len ≤12
```

### SCN-007 — Fix coches.net noise no borra números
```gherkin
GIVEN query "menos de 3000 diesel"
WHEN _scrape_cochesnet evalúa noise sin números
THEN clean_query="diesel" (no vacío) y Keywords="diesel" (no "")
  AND params MaxPrice=3000 se envía correctamente
  AND no fallback a req.query vacía genérica
```

### SCN-008 — Fix autoscout URL no 404 para "suv familiar"
```gherkin
GIVEN query "suv familiar"
WHEN _scrape_autoscout24 construye URL
THEN clean_parts=["suv","familiar"] detecta 2 tokens pero aplica slugify + fallback a https://www.autoscout24.es/lst?keywords=suv%20familiar si path /lst/suv/familiar daría 404 en verificación
  AND params priceto=5000 si max_price 5000
```

### SCN-009 — Wallapop lat/lon dinámico por ciudad en query
```gherkin
GIVEN query "seat león barcelona hasta 6000"
WHEN _scrape_wallapop parsea query
THEN detecta "barcelona" y usa lat 41.3851 lon 2.1734 (no Madrid 40.4168 -3.7038)
GIVEN query sin ciudad
WHEN evalúa
THEN fallback Madrid 40.4168 -3.7038
```

### SCN-010 — Milanuncios scraper retorna con image_url
```gherkin
GIVEN query "utilitario 5000" max_price 5000
WHEN _scrape_milanuncios GET https://www.milanuncios.com/coches-de-segunda-mano/?precio-hasta=5000
THEN selector article.ma-AdCardV2 encuentra ≥1 item con title, price int, url https://www.milanuncios.com/..., image_url https://cdn.milanuncios.com/...
  AND source="milanuncios"
```

### SCN-011 — chat/route devuelve CarResult[] con image_url y renderiza cards
```gherkin
GIVEN searchBackend retorna {results:[{title:"SEAT León 2019", price:5500, year:2019, km:95000, fuel:"diésel", url:"https://www.coches.net/...", image_url:"https://cdn.milanuncios.com/img.jpg", source:"milanuncios"}], total:1}
WHEN POST /api/chat con messages [{role:"user", parts:[{type:"text", text:"menos de 6000 diesel"}]}]
THEN contextData incluye markdown de resultados y extraData.cars contiene array con image_url
  AND MessageList renderiza CarResultCard con img src image_url y link <a href="..." target="_blank" rel="noopener">
  AND next.config images no bloquea (remotePatterns whitelist)
```

### SCN-012 — next.config images whitelist
```gherkin
GIVEN imagen https://cdn.milanuncios.com/foto.jpg o https://images.autoscout24.es/...
WHEN CarResultCard usa next/image
THEN no error 400 remote image; domains permitidos: autoscout24.es, coches.net, wallapop.com, milanuncios.com, cdn.milanuncios.com
```

### SCN-013 — Soporte attachments imagen + qwen3.7-plus visión
```gherkin
GIVEN usuario adjunta foto coche (experimental_attachments) y dice "¿qué modelo es?"
WHEN ChatWindow envía messages con parts [{type:"text", text:"¿qué modelo es?"}, {type:"image", image:"data:image/jpeg;base64,..."}]
THEN convertToModelMessages preserva part image
  AND streamText usa model opencode("qwen3.7-plus") (OPENCODE_MODEL env)
  AND no fallback a deepseek si qwen disponible
```

### SCN-014 — Modelo fallback deepseek si qwen no env
```gherkin
GIVEN env OPENCODE_MODEL vacío
WHEN front/src/lib/ai.ts evalúa CHAT_MODEL
THEN es "deepseek-v4-pro" fallback y streamText sigue funcional
```

### SCN-015 — Tipo CarResult price:number alineado
```gherkin
GIVEN front/src/types/index.ts CarResult con price:number
WHEN chat/route mapea c.price.toLocaleString("es-ES")
THEN no mismatch con server schemas.py price:int (no string); display formatea en cliente
```

---

## 4. Criterios de Aceptación

- [ ] `detectCarSearch` fixtures 20 casos (tabla SCN-002 + "menos de 3000", "3000€") → `isSearch=true` 100%, verificado por unit test `vitest` o `npm test`.
- [ ] `"menos de 3000"` sin coche dispara `searchBackend` y retorna ≥3 coches agregados en <3s (integration test mock fetch o live scrape).
- [ ] `server/routers/scrape.py` contiene `_scrape_milanuncios`, `asyncio.gather` 4 fuentes, `SoupStrainer`, clamp `max(1,min(12))`, timeout 12s + retry, `image_url` en cada parser, wallapop lat/lon dinámico, noise sin números—verificado por `ruff` + `grep`.
- [ ] `front/next.config.ts` tiene `images.remotePatterns` con 5 hosts.
- [ ] `front/src/types/index.ts` tiene `price:number`.
- [ ] `MessageList.tsx` renderiza `CarResultCard` con `image_url` y links `rel noopener`; Playwright `expect(page.locator('a[href*="coches.net"]')).toBeVisible()`.
- [ ] `front/.env.local:13` y `front/src/lib/ai.ts:15` usan `qwen3.7-plus` via `OPENCODE_MODEL` con fallback deepseek; `experimental_attachments` habilitado en `ChatWindow`.
- [ ] `npm run build --prefix front` pasa sin error remote image.

## 5. Riesgos

- **Selectors frágiles**: mitigado con `return_exceptions`, fallback genérico, logs y alerta `total===0`.
- **Milanuncios anti-bot**: HEADERS con `br` + UA rotación; si bloqueo >15% evaluar proxy (fuera de scope).

## 6. Métricas de Éxito

- P50 scrape <2.0s, P95 <3.0s, ≥3 resultados en 95% queries con `max_price`.
- 100% de 20 fixtures lingüísticos disparan `isSearch=true`.
- CTR `CarResultCard` ≥35% (analytics `car_click`).
- ≥80% cards con `image_url` visible (no 403/404).
