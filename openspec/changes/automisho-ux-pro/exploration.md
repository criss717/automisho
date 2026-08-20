# Exploration — AutoMisho UX Pro

**Change:** `automisho-ux-pro` — Liquid glass visual system + fix ciclo monetización + chat pro con búsqueda real + seguridad + cat animado
**Date:** 2026-08-20
**Mode:** hybrid (engram `sdd/automisho-ux-pro/explore` #107 + openspec)
**Status:** complete (manual, tras latch SDD `deepseek-v4-pro empty` → workaround general mapper)

> SDD nativo quedó latcheado tras `sdd_task_result_empty` en `sdd-explore-open-new`. Este artefacto se generó vía mapper directo para desbloquear el ciclo. Próximas fases requieren nueva sesión opencode o seguir vía workers directos.

---

## Executive Summary

AutoMisho es **Next 16 App Router + React 19 + Prisma 7/Postgres + NextAuth v5 beta + Stripe + AI SDK (opencode-go, `deepseek-v4-pro` por defecto) + Tailwind v4 + Framer Motion/GSAP/Lenis** en `front/`, y **FastAPI + httpx + BeautifulSoup (lxml)** en `server/` para scraping **AutoScout24, coches.net, Wallapop** (falta **milanuncios**), más stubs `DGT / CarVertical / CarFax`.

- **Visual:** tokens Hyper Foundation completos en `globals.css` (`forest-depths #072724`, `mint-glow #97fcd7`, `Teodor+Inter`, `radius 60px`, `shadow-glow`) pero **cero liquid glass** (`backdrop-blur`, `rgba translúcido`, `inner shadow`). Dashboard `max-w-4xl gap-6 cards flat shadow-teal/30 sin blur` se ve encogido, estático, sin blobs, sin stagger. Mezcla `className` + `style hardcode` rompe sistema. Solo `Navbar` tiene `backdrop-blur-xl` correcto.
- **Monetización:** `Pricing → /api/checkout → stripe.customers.create (metadata userId) → stripe.checkout.sessions.create (success /dashboard) → webhook constructEvent → prisma.user.update plan` funciona, pero `lib/auth.ts jwt()` solo refresca `token.plan` en `sign-in`, luego **queda stale `free` hasta relogin** → "compra pero no cambia cuenta". `portal` también lee JWT viejo.
- **Chat:** `detectCarSearch` regex exige `keyword coche + (precio|año)` → `"menos de 3000"` sin `coche` no dispara. `scrape.py` `noise` borra números de `coches.net`, URL `autoscout lst/{make}/{model}` frágil, selectores `.cldt-summary-full-item / .mt-CardAd / __NEXT_DATA__` frágiles, Wallapop lat/lon Madrid fijo, **sin milanuncios**. `CarResultCard` existe pero `chat/route.ts` solo inyecta markdown plano sin `image_url`, sin `next.config images`, modelo `deepseek` no `qwen3.7-plus`, sin soporte imágenes.
- **DGT:** `server/routers/dgt.py` siempre `source="mock"` determinista `ord(plate)%len`. `carvertical/carfax` igual `source mock` o `501`. Falta flujo guía **8€ DGT oficial** + links didácticos Carfax/CarVertical con VIN.
- **Cat:** `AutoMishoCat.tsx 280px` con `mousePos -1..1 /300`, `headRotate*8`, `eyeOffset*4` pero **todo en un `<g>` conjunto**, sin separar `iris/pupila/brillo`, sin spring, pupilas fijas sin offset propio.
- **Seguridad:** `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_*`, `STRIPE sk_test`, `DATABASE_URL` en `.env.local` versionado en disco. `bcrypt 12` ok, `webhook signature` ok, pero **sin rate-limit, sin zod, sin CSP/helmet, CORS abierto localhost**, `MessageBubble` plain pero futuro markdown sin sanitizar, `Wallapop json.loads` sin límite.
- **Backend scraping:** `HEADERS Chrome/120` fijo, `timeout 20` sin retry/backoff/rotación UA, `lxml` sin `SoupStrainer`, secuencial no `gather`.

---

## 1. Visual / Design System — por qué se ve barato

### Tokens existentes (`front/src/app/globals.css:8-61`)

| Token | Valor | Uso |
|-------|-------|-----|
| `forest-depths` | `#072724` | canvas |
| `midnight-tide` | `#0f3933` | border fuerte |
| `shadow-teal` | `#23524c` | card surface |
| `abyss-green` | `#122d28` | blob oscuro |
| `mint-glow` | `#97fcd7` | acento único |
| `teal-pulse` | `#33998c` | rim/accento |
| `mist-gray` | `#b0c5c1` | body muted |
| `pure-light` | `#ffffff` | headline |

- Tipografía `Teodor 400` display `90px/0.75` + `Inter 300` body `16px/1.5`. Radius `cards 0.75rem`, `buttons 3.75rem`. Shadows `glow 0 0 20px 5px rgba(151,252,215,0.4)`.
- Base `body 300 Inter mist-gray on forest-depths`, `h1-6 Teodor pure-light`.

### Lo que existe bien

- `.btn-pill/.btn-primary/.btn-ghost 138-182` con `cubic-bezier .3s` + `hover translateY(-1px)` + `shadow-glow`.
- `.card 188-207` flat `bg-shadow-teal border-midnight-tide` + `.card-glow 196-202` con `shadow-glow`. `.tag 213-225` pill mint. `.section 231-236` `max 75rem padding 5rem 2rem`.
- Animaciones: `nut-spin 2s linear`, `glow-pulse 3s`, `float 6s`, `blob-morph 20-30s blur 60px opacity .6` + 3 blobs. `Hero.tsx 18-34` GSAP timeline morph + `x/y/rotation`. `Demo.tsx 45-58` reveal 700ms staggered.

### Faltas Liquid Glass — por qué Dashboard se ve mal

- **No hay utility `glass`**: cero `backdrop-blur`, `background: rgba(…,0.6)`, `border rgba(white,0.1)`, `inner shadow`. `globals.css` no define `.glass`, `.glass-strong`, `.glass-card`. Cards opacas `shadow-teal` no translúcidas.
- **Dashboard `front/src/app/(protected)/dashboard/page.tsx:32-52`**: `h-full overflow-y-auto > max-w-4xl mx-auto px-8 py-10 > h1 text-2xl font-light mb-8` + `grid grid-cols-1 md:grid-cols-2 gap-6` con `PlanCard, UsageStats, DgtLookupInput, SettingsPanel(md:col-span-2)`. Gap fijo 24px, sin `gap-8` responsive, sin `section-header`, sin blobs atmosféricos (vs `Features.tsx:63-65` blob `shadow-teal/20 blur 120px`). `PlanCard.tsx:52` `rounded-xl border-midnight-tide bg-shadow-teal/30 p-6` — opacidad 30% intenta glass pero sin `backdrop-blur-xl` queda lavado. Igual `UsageStats:27`, `DgtLookupInput:53`, `SettingsPanel:14`. Sin elevación, sin `hover glow`, sin entry transition.
- **Spacing**: `max-w-4xl (896px)` vs system `1200px` → encogido. `py-10` no usa token `spacing-section 5rem`. `grid-cols-2` deja hueco raro cuando `SettingsPanel` ocupa 2 cols.
- **Inconsistencia tokens vs inline**: `Navbar.tsx:33-36` `bg-forest-depths/90 backdrop-blur-xl border-b midnight-tide` correcto glass, pero `Hero:38-48` usa `style={{background: linear-gradient…}}` hardcode `#072724` no var(), `Footer:33,35` `borderTop 1px solid #0f3933` hardcode, `Pricing:88` `bg-shadow-teal/15 blur 100px` duplicado, `HowItWorks:83-88` cards hardcode `#23524c` no var. Mezcla `className` + `style` rompe mantenibilidad.
- **Transiciones**: solo `transform .3s` en buttons/cards. No `view-transition`, no `stagger` en dashboard (sí en `Features:87 transition delay index*0.1`), no `layout` animation. Dashboard estático.

**Recomendación:** introducir `glass-1: bg-shadow-teal/40 backdrop-blur-xl border-white/[0.06]`, `glass-2` elevado, re-usar blobs `DataSources.tsx:38-43` en Dashboard background + grid `gap-8 p-8 cards glass + framer delay children`. Ver `DESIGN.md` Background Atmosphere System (§ Background).

---

## 2. Monetización — trace completo y bug JWT

```
Pricing.tsx:61 handleCheckout → /api/checkout POST {plan}
checkout/route.ts:5 auth() → 401 if no session
                :14 if !(plan in STRIPE_PLANS) 400
                :20 getStripe() lazy singleton stripe.ts:5-13
                :24 let customerId=session.user.stripeCustomerId
                :26 if !customerId → stripe.customers.create {email,name,metadata:{userId}}:26-30 → prisma.user.update stripeCustomerId:35-38
                :41 stripe.checkout.sessions.create {customer,mode:subscription,line_items:[{price:STRIPE_PLANS[plan]}], success_url `${origin}/dashboard?success=true`, cancel_url `${origin}/pricing?canceled=true`, metadata:{userId,plan}}:41-56
                :58 return {url}
Pricing.tsx:70 window.location.href=data.url
Stripe hosted → user paga → webhook
webhooks/stripe/route.ts:7 req.text() + headers stripe-signature:8-9 → 400 if miss
                     :20 stripe.webhooks.constructEvent(body,sig,STRIPE_WEBHOOK_SECRET!):20-24 → 400 Invalid signature
                     :32 switch event.type
                       checkout.session.completed:33-46 → prisma.user.update where id=userId data{plan,stripeCustomerId:customer}
                       customer.subscription.updated:49-61 → priceId=subscription.items.data[0].price.id → plan = priceId===PRO ? "pro":"premium" → prisma.user.update where stripeCustomerId
                       customer.subscription.deleted:64-72 → plan:"free"
                       invoice.payment_failed:75-81 console.warn solo
                     :89 200
auth.ts jwt():50-80 → BUG
```

**Bug session refresh (crítico `front/src/lib/auth.ts:50-71`):**
- `jwt` solo hace `prisma.user.findUnique where email` cuando `if (user)` (primer sign-in). En requests posteriores `user===undefined`, `token.plan` **nunca se refresca** desde DB.
- Branch `trigger==="update"` `65-68` copia `session.plan` pero **nadie llama `session.update()`** tras webhook. `checkout/route.ts` no dispara nada, `dashboard/page.tsx:9 auth()` lee JWT viejo → sigue `free`.
- `session callback 72-79` copia `token.plan` → UI muestra plan viejo hasta logout/login o jwt expire (30d). `PlanCard` seguirá `free` aunque `prisma.user.plan==="premium"`.
- Además `portal/route.ts:8` chequea `stripeCustomerId` del JWT viejo → puede dar `400 No subscription` aunque ya pagó.
- `stripe.ts:16-18` `STRIPE_PLANS` usa `!` non-null assert; si env faltante explota runtime.
- `webhooks` `subscription.updated` fallback `premium` si no es PRO (si mañana añaden `enterprise` lo marcaría premium erróneo). No maneja `checkout.session.expired`, `subscription.past_due`.

**Evidencia env:** `front/.env.local:19-25` tiene `STRIPE_SECRET_KEY sk_test…`, `STRIPE_WEBHOOK_SECRET whsec_…` reales, `STRIPE_PREMIUM_PRICE_ID price_1U62vu…`, `STRIPE_PRO_PRICE_ID price_1U62wc…` testeable pero secreto expuesto.

**Fix:** en `jwt` añadir `if (!user && token.id) { dbUser=prisma.user.findUnique where id=token.id; token.plan=dbUser.plan }`. Añadir endpoint `POST /api/auth/refresh` con `unstable_update`.

---

## 3. Chat — regex, searchBackend, scraping

**`front/src/app/api/chat/route.ts:14-48 detectCarSearch`:**
```ts
priceMatch = lower.match(/(\d[\d.]*)\s*(?:€|euros?|eur)|menos\s+de\s+(\d[\d.]*)|por\s+(\d[\d.]*)|(?:presupuesto|budget)\s+(?:de\s+)?(\d[\d.]*)/i)
maxPrice = parseInt((group1||...group4).replace(/\./g,""))
searchKeywords = ["coche","coches","vehículo",… "busco","quiero","hay","suv","diésel",… "seat","bmw"] // 38
hasSearchIntent = keywords.some(kw=>lower.includes(kw))
hasPriceOrYear = maxPrice!==undef || /\b20\d{2}\b/.test
isSearch = hasSearchIntent && hasPriceOrYear
```

Limitaciones:
- `"menos de 3000"` → group2=3000 OK, pero requiere `hasSearchIntent` con `coche`/`busco`/marca. Solo `"menos de 3000"` → `isSearch=false` → **no dispara scrape** (bug report).
- `"3000€"` sin keyword coche tampoco dispara.
- No detecta `hasta 5000`, `máximo 7000`, `entre 3000 y 6000`, `k€` (`15k`).
- `detectPlate:52` `/\b(\d{4}[\s-]?[BCDFGHJ…]{3})\b/i` formatea `1234BCD→1234-BCD` pero no valida letras prohibidas `A,E,I,O,U,Q,Ñ`.

**`searchBackend 56-73`**: `fetch(BACKEND_URL/scrape POST {query,source:auto,max_results:8,max_price})` sin timeout, sin AbortController.

**`server/routers/scrape.py`:**
- `HEADERS 11-16` `Chrome/120` + `Accept-Language es-ES` + `gzip,deflate` sin `br`, sin rotación.
- `scrape_cars 20-42` si `source==="auto"` itera `autoscout24, cochesnet, wallapop` secuencial (no `gather`), `results[:max_results]`.
- `_scrape_autoscout24 64-127`: noise `68-70` sin `eur`; `clean_parts` filtra `isdigit` → `"menos de 3000"` pierde número pero `max_price` sí se envía `priceto`. URL `lst/{make}/{model}` `74-78` si query=`"suv familiar"` → `/lst/suv/familiar` 404. Params solo `priceto`, ignora `min_price/min_year/max_km`. Selector `.cldt-summary-full-item` + `ListItemTitle_title`, `data-testid regular-price`, `ListItemTitle_anchor`, `vehicleDetails` frágil. `fuel` solo 5 valores.
- `_scrape_cochesnet 130-192`: noise `136-140` incluye `"2000","3000","5000"…` → query `"menos de 3000"` → `clean_query=""` → fallback `req.query` pierde filtro keywords pero envía `Keywords=""` vacío → genérico no filtrado. Selector `.mt-CardAd`, `card-adPrice-price` frágil.
- `_scrape_wallapop 195-260`: `category_ids 100` Cars, `latitude 40.4168 longitude -3.7038` Madrid fijo. SSR `__NEXT_DATA__ 225` → `props.pageProps.items[]` `230` estructura `title,price,year,km,fuel,location.city,web_slug,images[0].original` `232-241` puede cambiar a `searchObjects`. Fallback `ItemCard` genérico. Sin paginación.
- **Falta `milanuncios`**: `DataSources.tsx:8` lista `Milanuncios` pero `scrape.py:25` no lo incluye.

**Cards / imágenes:** `CarResultCard.tsx:6-72` existe (price/teodor 28px, score bar gradient) pero `MessageBubble.tsx:25` `car? <CarResultCard>` nunca se alimenta: `ChatWindow.tsx:3-57` usa `useChat DefaultChatTransport api:/api/chat` y `MessageList.tsx:60-65` solo mapea `msg.parts text → MessageBubble`, sin `tool` parts ni `data` con `car`. `route.ts:139-143` genera markdown plano `1. **title** — price€ | year … | Fuente:… | url` inyectado en `contextData`, no `image_url`. `types/index.ts:3-12 CarResult price:string` vs `schemas.py CarResult price:int` mismatch. No `next.config.images` domains.

**Modelo:** `front/.env.local:13 OPENCODE_MODEL=deepseek-v4-pro`, `lib/ai.ts:15 CHAT_MODEL=deepseek-v4-pro`, `createOpenAICompatible opencode-go https://opencode.ai/zen/go/v1`. System prompt dice usar datos reales, no inventar, ranking 3-5. No usa `qwen3.7-plus`.

**Falta:** rate limit, validación `zod` body `messages` `conversationId`, `max_results` clamp.

---

## 4. DGT / Historia mock

**`server/routers/dgt.py:12-44` `POST /dgt lookup_plate`:**
- Mock determinista `ord(plate[0])%len` → `makes[8], models[8], fuels[4], year=2018+idx%7, power, enrollment_date, itv_status`, `source="mock"`.
- `front/src/app/api/dgt/lookup/route.ts:6 PLATE_REGEX`, `33-45` proxy a `BACKEND_URL/dgt` con `backend_offline 503`.
- `DgtLookupInput.tsx:55-115` muestra `Fuente: mock → "Datos de ejemplo"`.

**Falta flujo real pedido:** guía oficial DGT 8€ `https://sede.dgt.gob.es/es/vehiculos/informe-de-vehiculo/` + didáctico `carVertical`/`Carfax` links con `VIN` input. `carvertical.py:19-35` mock `Volkswagen Golf 2019` si `!CARVERTICAL_API_KEY`. `carfax.py:19-34` mock `SEAT León 2020` o `501`. `VehicleHistory` model `models/schemas.py:52-64` ok pero no expuesto en UI.

**Recomendado chat didáctico:**
1. Ofrecer 3 opciones: **CarVertical** (VIN, ~15€), **Carfax** (VIN, ~20€) con link afiliado, **DGT oficial 8,67€** con pasos: certificado digital/Cl@ve → sede DGT → pagar tasa 4.1 → descargar PDF → qué mirar (titulares, cargas, ITV).
2. En `MessageBubble` mostrar cards con `CarVerticalCard`, `CarfaxCard`, `DGTGuideCard` con `external link + pasos numerados`.
3. Si usuario da matrícula, primero hacer lookup mock pero aclarar "demo" y ofrecer upgrade a informe real.

---

## 5. Cat — `AutoMishoCat.tsx:1-384`

**Actual:**
- Props `size=280`, `svgRef`, `blinkState`, `mousePos {x,y} -1..1 /300`.
- `mousemove window`, `center calc`, `setMousePos`.
- Blink cada `3000+random*3000`, `scaleY 0.1` 150ms.
- Transforms: `headRotate=mouse*8deg` en `g rotate(head,140,110)`, `headRotate*0.3` cuerpo, `*0.2` legs; `eyeOffsetX*4 eyeOffsetY*3` translate en `g` ambos ojos.
- Defs gradients `metalBody/metalHead`, radial `eyeGlow #97fcd7→#33998c`, filters `mintGlow blur4`, `eyeGlowFilter blur6*2`.
- Layers: `tail coil + hex nut`, `body rect 100x70 rx20 + plate lines + chest gear rotate 8s + rivets`, `legs 4 rect + knee + foot`, `head neck+bolts ellipse 48x40 ears 252-280 eyes 283-307 nose hex whiskers + forehead gear rotate -12s shadow`.

**Falta separar:**
- No hay capas independientes `iris/pupila/brillo`. `g translate eyeOffset` mueve socket+iris+pupila juntos; pupila `circle r4 #072724` dentro mismo `g scale blink` que `iris r10 eyeGlow`. No hay `iris follow` con clamp diferente a `head`.
- Cabeza rota `rotate(…,140,110)` → ojos heredan rotación, pero `eyeOffset` translate sin compensar rotación.
- Pupilas fijas en centro iris sin offset propio; falta `pupilOffset = mouse*1.5px clamp 3px + irisOffset*2px`.
- Sin micro spring: `headRotate` directo `*8` sin `framer motion spring` ni `lerp`. Rígido.
- Sin separación `head|eyes|pupils|eyelids` con `transform-origin` independiente.

**Propuesta liquid:** separar en 4 grupos `<g id="head">`, `<g id="eye-left">`, `<g id="eye-right">`, `<g id="pupils">` + `useMotionValue` + `useSpring` + `iris clamp 3px` + `pupil clamp 1.5px` + `head rotate spring 0.8`.

---

## 6. Seguridad

| Área | Estado | Riesgo |
|------|--------|--------|
| `NEXTAUTH_SECRET KAzR5…` en `.env.local` | hardcode en repo | HIGH — debe ser `openssl rand` solo local, rotar |
| `GOOGLE_CLIENT_ID/SECRET` | expuesto | HIGH |
| `STRIPE sk_test` + `DATABASE_URL postgres:1088300461@...` | plano | HIGH |
| `bcrypt 12` en `register/route.ts:34` | ok | LOW |
| `login auth.ts:34-36` | sin lockout/brute limit | MEDIUM |
| `webhooks/stripe 20-24` signature | verifica `stripe-signature` ok, pero `!` assert sin check | MEDIUM |
| Rate limit en `chat/search/dgt/conversations/register` | **falta** | HIGH |
| Validación `zod` | `messages any[]`, `plan as PlanKey`, `body.query` sin schema | HIGH |
| CORS `server/main.py:20-30` `allow_origins localhost` `allow_credentials True` `*` | abierto, prod debe ser vercel domain | MEDIUM |
| `MessageBubble` XSS | React escapa, pero futuro `react-markdown` sin sanitizar + `javascript:` urls | MEDIUM |
| `Wallapop json.loads` sin límite | DoS | LOW |
| No helmet, no CSP en `next.config.ts` |  | MEDIUM |

**Mitigaciones recomendadas:** `arcjet`/`upstash ratelimit`, `zod` en todos los `route.ts`, `CSP` + `helmet` en `next.config`, rotar secrets, `.env.local` no versionar, `rel noopener` en links externos.

---

## 7. Backend Search — headers/timeout/selectores

- `HEADERS` estático `Chrome/120`, `Accept-Language es-ES`, `Accept-Encoding gzip,deflate` sin `br`, sin rotación UA ni proxy.
- `timeout 20` fijo, catch `httpx.HTTPError` genérico, sin retry/backoff.
- `BeautifulSoup lxml` ok pero selectores frágiles. `autoscout .cldt-summary-full-item`, `coches.net .mt-CardAd`, `wallapop __NEXT_DATA__` vs `ItemCard` genérico.
- Wallapop lat/lon Madrid duro sin tomar `req.query location`.
- `milanuncios` faltante.
- `lxml` sin `SoupStrainer` overhead.

---

## 8. Decisiones / Tradeoffs explorados

| Decisión | Opción A (recomendada) | Opción B | Tradeoff |
|----------|------------------------|----------|----------|
| Liquid glass | `backdrop-blur-xl bg-shadow-teal/40 border-white/6` utility + blobs | `filter blur` CSS custom | A es tokens + a11y, B más control pero más CSS |
| Monetización fix | `jwt` refresh `findUnique id` cada request | `session strategy database` | A mínimo cambio, B rompe JWT stateless pero instantáneo |
| Chat search | `hasSearchIntent OR hasPrice` + `hasta/máximo/entre/k€` regex + `milanuncios` scraper + `gather` | Mantener solo keyword && price | A cubre "menos de 3000" y 4 fuentes, B deja bug |
| DGT | Cards didácticas + links 8€ + carVertical mock→real con env flag | Scraping DGT directo | A legal/didáctico, B viola ToS |
| Cat | Separar layers + `useSpring` | Solo translate actual | A profesional, B rígido |
| Modelo | `qwen3.7-plus` via opencode `OPENCODE_MODEL` | `deepseek-v4-pro` | qwen mejor español + visión (imágenes), deepseek más barato |
| Seguridad | `zod + arcjet ratelimit + CSP` | Solo zod | A protege abuso, B solo validación |

---

## 9. Riesgos & Next Steps

### Riesgos críticos
- **Stripe JWT stale** bloquea monetización (usuario paga y no ve premium, abandona).
- **Scraping selectors** frágiles + sin milanuncios → "menos de 3000" vacío frustra.
- **Secrets expuestos** en disco → rotar antes de prod.
- **Dashboard sin liquid** → percepción "barato" vs Hyper Foundation premium.

### Next steps SDD

1. **Proposal** `automisho-ux-pro` con scope: glass system + dashboard rediseño, checkout webhook fix + refresh, chat regex + 4 scrapers + cards con links + imágenes + qwen, DGT didáctico (3 cards), cat layers + spring, hardening (zod/ratelimit/CSP/rotación secrets).
2. **Specs** con `GIVEN/WHEN/THEN` + RFC 2119 por cada flujo (checkout, search, DGT, chat image).
3. **Design** con diagramas secuencia Stripe webhook, search `gather`, DGT guide, tokens glass.
4. **Tasks** agrupadas por fase con `single-pr + size:exception` (estimado ~600-800 líneas).

---

## Anexos — Evidencia file:line

- `front/src/app/globals.css` @theme tokens, .card, animations
- `front/src/app/(protected)/dashboard/page.tsx:32-52` grid gap6 sin glass
- `front/src/components/dashboard/PlanCard.tsx:52`, `UsageStats:27`, `DgtLookupInput:53`
- `front/src/lib/auth.ts:50-71` jwt bug
- `front/src/app/api/chat/route.ts:14-48` detectCarSearch, `56-73` searchBackend
- `server/routers/scrape.py:11-16` HEADERS, `20-42` auto loop, `64-127` autoscout, `130-192` cochesnet, `195-260` wallapop
- `server/routers/dgt.py:12-44` mock
- `front/src/components/icons/AutoMishoCat.tsx:1-384` layers
- `front/.env.local:13` OPENCODE_MODEL, `:19-25` STRIPE secrets
- `server/main.py:20-30` CORS
- Etc.

