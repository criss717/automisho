# Proposal — automisho-ux-pro

**Change ID:** `automisho-ux-pro`
**Status:** `proposed` — awaiting approval (single-PR, `size:exception` pre-aprobado, ilimitado)
**Date:** 2026-08-20
**Authors:** UX Pro Working Group (Front + Server + Design)
**Depends on:** `openspec/changes/automisho-ux-pro/exploration.md` + engram `sdd/automisho-ux-pro/explore` (#107)
**Stack:** Next.js 16 App Router + React 19 + Prisma 7/PostgreSQL + NextAuth v5 beta + Stripe + AI SDK (opencode-go) + Tailwind v4 + Framer Motion/GSAP/Lenis · FastAPI + httpx + BeautifulSoup (lxml) en `server/`
**Reviewers:** —

---

## 1. Resumen ejecutivo

AutoMisho es un **AI copilot para comprar coche de segunda mano en España** con un posicionamiento premium (Hyper Foundation: `forest-depths #072724` + `mint-glow #97fcd7`, Teodor + Inter, `radius 60px`, `shadow-glow`). Hoy ese posicionamiento **no se sostiene en tres flujos críticos**:

| Síntoma | Impacto directo | Evidencia |
|---------|-----------------|-----------|
| **Dashboard barato** — flat `bg-shadow-teal/30` sin `backdrop-blur`, `max-w-4xl gap-6`, sin blobs/stagger/hover-glow. Se ve encogido vs. `1200px` del sistema y estático. | Percepción de producto low-cost; erosiona confianza justo cuando el usuario valora pagar. | `front/src/app/(protected)/dashboard/page.tsx:32-52`, `front/src/app/globals.css:188-207`, `front/src/components/dashboard/PlanCard.tsx:52` |
| **Monetización rota** — usuario paga en Stripe, vuelve a `/dashboard?success=true` y sigue viendo `free` hasta hacer logout/login (JWT stale 30 días). | Funnel roto: churn inmediato, soporte, reembolsos, `portal` bloqueado (`No subscription` falso). | `front/src/lib/auth.ts:50-71` |
| **Búsqueda vacía** — `detectCarSearch` exige `keyword coche + precio/año`. `"menos de 3000"` (y variantes `hasta 5000`, `15k`, `entre 3000 y 6000`) **no dispara scrape**. Cuando dispara, `scrape.py` borra números de `coches.net`, genera URLs 404 en AutoScout24, no paraleliza y no incluye milanuncios. `CarResultCard` existe pero nunca se renderiza; el chat solo inyecta markdown sin `image_url`. | Core value prop roto: el usuario prueba la búsqueda más natural y recibe 0 resultados → abandono. | `front/src/app/api/chat/route.ts:14-48` + `:56-73`, `server/routers/scrape.py:68-78,136-140,225`, `front/src/components/chat/MessageList.tsx:60-65` |

A esto se suman **seguridad** (sin `zod`/`rate-limit`/`CSP`, secrets en disco `front/.env.local:19-25`), **modelo desactualizado** (`deepseek-v4-pro` en `front/src/lib/ai.ts:15` vs. `qwen3.7-plus` con mejor español y visión) y **cat animado rígido** (`front/src/components/icons/AutoMishoCat.tsx:1-384` — un solo `<g>` para ojos).

**Este change propone un upgrade integral en 5 pilares que se entrega en un único PR ilimitado.** Cada pilar es independiente en implementación pero dependiente en valor: **Visual Liquid eleva la percepción, Monetización arregla el cobro, Chat Pro entrega la búsqueda real con cards e imágenes, DGT didáctico (guía 8 € + Carfax/CarVertical) educa y monetiza historia, y Cat + Seguridad cierran pulido y hardening.** Sin este cambio, el producto no es cobrable ni buscable con credibilidad premium.

> **Decisión solicitada:** aprobar `automisho-ux-pro` como **single-PR** (`size:exception`, ~600–800 líneas netas) cubriendo los 5 pilares más hardening. Rollback granular por pilar sin migración de DB.

---

## 2. Problema y oportunidad

### 2.1 Pilar 1 — Visual Liquid Glass System

**Problema.**
`front/src/app/globals.css:8-61` define tokens Hyper completos, pero **no existe ningún utility `glass`** (`backdrop-blur`, `bg rgba translúcido`, `border white/[0.06]`, `inner shadow`). Resultado:

* `front/src/app/(protected)/dashboard/page.tsx:32-52` usa `max-w-4xl (896px)` vs. token sistema `1200px`, `py-10` vs. `spacing-section 5rem`, `gap-6` fijo sin responsive, cards `rounded-xl border-midnight-tide bg-shadow-teal/30 p-6` (`PlanCard.tsx:52`, `UsageStats.tsx:27`, `DgtLookupInput.tsx:53`, `SettingsPanel.tsx:14`) — opacidad 30 % sin `backdrop-blur-xl` produce lavado, no translucidez.
* Sin blobs atmosféricos (vs. `Features.tsx:63-65` `shadow-teal/20 blur 120px` o `Pricing.tsx:88` `bg-shadow-teal/15 blur 100px`), sin `stagger` (vs. `Features.tsx:87 delay index*0.1`), sin `hover glow`, sin `view-transition`. Dashboard estático.
* Inconsistencia `className` vs. `style` hardcodeado: `Navbar.tsx:33-36` correcto (`bg-forest-depths/90 backdrop-blur-xl`), pero `Hero.tsx:38-48`, `Footer.tsx:33,35`, `HowItWorks.tsx:83-88` hardcodean hex (`#072724`, `#0f3933`, `#23524c`) fuera de `var(--color-*)`.

**Oportunidad.**
Introducir un **Liquid Glass system** reutilizable (`glass`, `glass-strong`, `glass-card`, `glass-input`) que extienda tokens sin romperlos, unifique dashboard con el resto del marketing y justifique visualmente el precio Pro/Premium.

### 2.2 Pilar 2 — Monetización (Stripe ↔ JWT)

**Problema crítico — trace completo:**

```
front/src/components/dashboard/PlanCard.tsx:16 handleUpgrade → fetch /api/checkout POST {plan}
front/src/app/api/checkout/route.ts:5  auth() → 401 si no session
                                :14  if !(plan in STRIPE_PLANS) 400
                                :20  getStripe() lazy singleton front/src/lib/stripe.ts:5-13
                                :26  if !customerId → stripe.customers.create {email,metadata:{userId}}
                                :35  prisma.user.update stripeCustomerId
                                :41  stripe.checkout.sessions.create {customer, mode:subscription,
                                     line_items:[{price:STRIPE_PLANS[plan]}], metadata:{userId,plan},
                                     success_url `${origin}/dashboard?success=true`}
front/src/app/api/webhooks/stripe/route.ts:7  req.text() + stripe-signature → 400 si falta
                                      :20  stripe.webhooks.constructEvent(body,sig,STRIPE_WEBHOOK_SECRET!)
                                      :32  switch event.type
                                             checkout.session.completed:33-46  prisma.user.update plan
                                             customer.subscription.updated:49-61  priceId → pro/premium
                                             customer.subscription.deleted:64-72  plan:"free"
                                             invoice.payment_failed:75-81  solo warn
front/src/lib/auth.ts:50  callbacks.jwt()  ← BUG
```

`callbacks.jwt()` en `front/src/lib/auth.ts:50-71` solo hace `prisma.user.findUnique where email` cuando `if (user)` (primer sign-in). En requests siguientes `user===undefined` y `token.plan` **nunca se refresca**. El branch `trigger==="update"` (`:65-68`) copia `session.plan`, pero **nadie llama `session.update()`** tras webhook. `front/src/app/api/portal/route.ts:8` también lee `stripeCustomerId` del JWT viejo → `400 No subscription` falso. El usuario paga, Stripe cobra, `prisma.user.plan==="premium"` en DB, pero `session.user.plan` sigue `free` hasta expire (30 d) o relogin.

Detalles adicionales: `front/src/lib/stripe.ts:16-18` usa `!` non-null assert (explota si falta `STRIPE_PREMIUM_PRICE_ID`), webhook `subscription.updated` hace fallback `premium` si no es `PRO` (rompe si se añade `enterprise`), no maneja `invoice.paid` ni `subscription.past_due`.

**Oportunidad.**
Refresh JWT por DB en cada request + endpoint de refresh explícito + hardening de webhook. Monetización instantánea y consistente.

### 2.3 Pilar 3 — Chat Pro (búsqueda real + cards + imágenes + modelo)

**Problema regulatorio de búsqueda.**

`front/src/app/api/chat/route.ts:14-48 detectCarSearch`:

```ts
priceMatch = lower.match(/(\d[\d.]*)\s*(?:€|euros?|eur)|menos\s+de\s+(\d[\d.]*)|por\s+(\d[\d.]*)|(?:presupuesto|budget)\s+(?:de\s+)?(\d[\d.]*)/i)
searchKeywords = ["coche","coches","vehículo", … "busco","quiero","hay","suv","diésel",… "seat","bmw"] // 38
isSearch = hasSearchIntent && hasPriceOrYear
```

* `"menos de 3000"` → `group2=3000` ok, pero sin `coche`/`busco`/marca → `hasSearchIntent=false` → `isSearch=false` → **no dispara** (bug reportado). Idem `"3000€"` solo.
* No detecta `hasta 5000`, `máximo 7000`, `entre 3000 y 6000`, `k€` (`15k`, `15.5k`), `presupuesto 4000`.
* `detectPlate()` `:52` no valida letras prohibidas `A,E,I,O,U,Q,Ñ`.

**Problema backend scraping** `server/routers/scrape.py`:

* `HEADERS` `Chrome/120` fijo, `Accept-Encoding gzip,deflate` sin `br`, sin rotación UA ni retry/backoff, `timeout 20` fijo.
* `scrape_cars 20-42` secuencial (no `asyncio.gather`).
* `_scrape_autoscout24 64-127`: `noise 68-70` sin `eur`; `clean_parts` filtra `isdigit` → pierde números; URL `lst/{make}/{model}` `74-78` con `query="suv familiar"` → `/lst/suv/familiar` 404; `params` solo `priceto`.
* `_scrape_cochesnet 130-192`: `noise 136-140` incluye `"2000","3000","5000"` → `query "menos de 3000"` → `clean_query=""` → `Keywords=""` vacío.
* `_scrape_wallapop 195-260`: `category_ids 100`, `lat 40.4168 lon -3.7038` Madrid fijo, `__NEXT_DATA__ 225` estructura `props.pageProps.items[]` frágil.
* **Falta `milanuncios`** pese a prometer 4 fuentes en `front/src/components/sections/DataSources.tsx:8`.

**Problema render.**
`front/src/components/chat/CarResultCard.tsx:6-72` existe (price Teodor 28 px, score bar), pero `front/src/components/chat/MessageBubble.tsx:25` nunca se alimenta con `car`. `front/src/components/chat/ChatWindow.tsx:3-57` (`useChat DefaultChatTransport api:/api/chat`) y `MessageList.tsx:60-65` solo mapean `parts type:text → MessageBubble`. `chat/route.ts:139-143` inyecta markdown plano `1. **title** — price€ | year …` en `contextData`, no `image_url` estructurado. `front/src/types/index.ts:3-12 CarResult price:string` vs. `server/models/schemas.py CarResult price:int` mismatch. Sin `next.config.ts images.remotePatterns` → imágenes no cargan. Sin soporte `experimental_attachments` ni visión. Modelo hardcodeado `deepseek-v4-pro` (`front/.env.local:13`, `front/src/lib/ai.ts:15`).

**Oportunidad.**
Convertir chat en **buscador real** con tolerancia lingüística española, 4 scrapers paralelos robustos, cards ricas cliqueables con imagen y `CarResult[]` tipado, soporte de imágenes de usuario y upgrade a `qwen3.7-plus`.

### 2.4 Pilar 4 — DGT didáctico (Carfax / CarVertical + guía 8 €)

**Problema.**
`server/routers/dgt.py:12-44` siempre `source="mock"` determinista `ord(plate[0])%len` → `makes[8], models[8], fuels[4], year=2018+idx%7`. `server/routers/carvertical.py:19-35` mock `Volkswagen Golf 2019` si falta `CARVERTICAL_API_KEY`; `server/routers/carfax.py:19-34` mock `SEAT León 2020` o `501`. `front/src/app/api/dgt/lookup/route.ts:6 PLATE_REGEX` proxy con `backend_offline 503`. `front/src/components/dashboard/DgtLookupInput.tsx:55-115` muestra `Fuente: mock → "Datos de ejemplo"`.

Falta el flujo que **el usuario espera**: informe oficial DGT (tasa 4.1, ~8,67 €) con pasos Cl@ve/certificado + explicación didáctica de qué mirar (titulares, cargas, ITV, kilometraje), y alternativas **CarVertical / Carfax con VIN** con links de afiliado y pricing transparente. Legalmente no se debe scrapear DGT.

**Oportunidad.**
Tres cards didácticas `DGTGuideCard` (8 € oficial), `CarVerticalCard`, `CarfaxCard` con links externos, `env` flag `source: mock|real`, y **detector VIN/matrícula en chat** que ofrece las 3 opciones contextualizadas.

### 2.5 Pilar 5 — Cat + Seguridad

**Cat** `front/src/components/icons/AutoMishoCat.tsx:1-384`: `size=280`, `mousePos -1..1 /300`, `headRotate=mouse*8deg` en `<g rotate(140,110)>`, `eyeOffset*4/*3` en `<g>` conjunto de ambos ojos. Blink `scaleY 0.1` 150 ms cada `3000+rand 3000`. **Todo en un `<g>`**: iris `r10 eyeGlow` + pupila `r4 #072724` + brillo comparten translate. Sin separar `iris/pupila/brillo`, sin spring, pupila fija sin offset propio, cabeza heredada con rotación sin compensar. Rígido.

**Seguridad** (tabla consolidada):

| Área | Estado | Riesgo |
|------|--------|--------|
| `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_*`, `STRIPE sk_test`, `DATABASE_URL` en `front/.env.local:19-25` versionado en disco | expuesto | **HIGH** |
| `bcrypt 12` en `front/src/app/api/register/route.ts:34` | ok | LOW |
| `login` `front/src/lib/auth.ts:34-36` sin lockout | — | MEDIUM |
| `webhooks/stripe 20-24` verifica `stripe-signature` ok, pero `STRIPE_WEBHOOK_SECRET!` assert sin check | — | MEDIUM |
| Rate limit en `chat/search/dgt/conversations/register` | **falta** | HIGH |
| Validación `zod` (`messages any[]`, `plan as PlanKey`, `body.query`) | **falta** | HIGH |
| `server/main.py:20-30` CORS `allow_origins localhost`, `allow_credentials True` | abierto en prod | MEDIUM |
| `MessageBubble` futuro `react-markdown` sin sanitizar + `javascript:` urls | XSS potencial | MEDIUM |
| `Wallapop json.loads` sin límite | DoS | LOW |
| Sin `helmet`/`CSP` en `front/next.config.ts` | — | MEDIUM |

**Oportunidad.**
Cat con layers físicas (spring, clamp diferencial iris/pupila, head 0.8, micro-rotación) + hardening integral (`zod` en todas las routes, `arcjet`/`rate-limit` middleware, `CSP` en `next.config.ts`, rotación de secrets, `.env.example`).

---

## 3. Scope

### 3.1 IN scope — lista concreta y verificable

**Visual Liquid**
- [ ] Utilities `.glass`, `.glass-strong`, `.glass-card`, `.glass-input` en `front/src/app/globals.css` (`backdrop-blur-xl + bg-shadow-teal/40 + border-white/[0.06] + shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]`).
- [ ] Dashboard `front/src/app/(protected)/dashboard/page.tsx` → `max-w-6xl gap-8 p-8`, blobs atmosféricos (`DataSources.tsx:38-43` pattern), `section-header` + `Framer stagger` (`delayChildren 0.08, stagger 0.06`) + `hover glow` en cards.
- [ ] Migrar 4 cards (`PlanCard.tsx:52`, `UsageStats.tsx:27`, `DgtLookupInput.tsx:53`, `SettingsPanel.tsx:14`) a `.glass-card` + unificar inline hex a `var(--color-*)`.
- [ ] Tokens audit: `Hero.tsx:38-48`, `Footer.tsx:33,35`, `Pricing.tsx:88`, `HowItWorks.tsx:83-88` → vars.

**Monetización**
- [ ] `front/src/lib/auth.ts:50-71` → `jwt` refresca `prisma.user.findUnique where id===token.id` en **cada request** si `token.id` existe (no solo `if(user)`).
- [ ] Endpoint `POST /api/auth/refresh` (`unstable_update` / `getToken` + `prisma`) para forzar sync sin relogin; `portal` y `checkout` lo consumen.
- [ ] `front/src/app/api/webhooks/stripe/route.ts` añadir `invoice.paid` handling (renovación), manejar `subscription.past_due`, corregir fallback `premium` → mapear `priceId` a plan por tabla explícita, añadir guard `if !STRIPE_WEBHOOK_SECRET return 500`.
- [ ] `front/src/lib/stripe.ts` validar env sin `!` (throw temprano legible).

**Chat Pro**
- [ ] `front/src/app/api/chat/route.ts` regex ampliada: `hasta/máximo/máx/entre/k€/presupuesto` + `(\d[\d.,]*)\s*k\s*(?:€|euros?)?` + OR logic `hasPriceOrYear || hasSearchIntent` con scoring (si solo precio, asumir búsqueda).
- [ ] `server/routers/scrape.py`:
  - Añadir `_scrape_milanuncios` (selector `article` + `ma-AdCard`, `SoupStrainer`, `max_results` clamp 1–12).
  - `scrape_cars` → `asyncio.gather` paralelo con `return_exceptions` + `timeout 12s` + `httpx.AsyncClient` + rotación UA mínima.
  - Fix `coches.net noise` (quitar números), `autoscout` URL builder robusto (slugify, encode, fallback `/lst?query=`), `autoscout` params `min_price/max_price/min_year/max_km`, `wallapop` lat/lon dinámico desde `req.query` + fallback.
  - `image_url` en `CarResult` siempre que exista, `max_results` clamp.
- [ ] `front/src/app/api/chat/route.ts:139-143` → devuelve `CarResult[]` tipado (`price:number`) con `image_url` + cards en stream (`tool` parts o `data` block).
- [ ] `front/next.config.ts` `images.remotePatterns` whitelist `autoscout24.es`, `coches.net`, `wallapop.com`, `milanuncios.com`, `cdn.milanuncios.com`.
- [ ] `front/src/components/chat/MessageList.tsx` render `CarResultCard` vía `message.parts` tipo `tool-invocation` / `data` + links `target="_blank" rel="noopener"`.
- [ ] Soporte `experimental_attachments` (AI SDK) + sistema `qwen3.7-plus` vía `front/src/lib/ai.ts:15` + `front/.env.local:13 OPENCODE_MODEL` (fallback `deepseek` si falta env).
- [ ] Corrección `front/src/types/index.ts:3-12 CarResult price:number` align con `server/models/schemas.py`.

**DGT didáctico**
- [ ] 3 componentes `front/src/components/dgt/DGTGuideCard.tsx`, `CarVerticalCard.tsx`, `CarfaxCard.tsx` con links externos, pricing, pasos numerados (DGT guía 8 €: `https://sede.dgt.gob.es/es/vehiculos/informe-de-vehiculo/` → Cl@ve/certificado → tasa 4.1 → PDF → qué mirar).
- [ ] `server/routers/dgt.py` flag `source` → `mock` si `MOCK_DGT=true` o falta `DGT_API_KEY`, `real` si hay integración futura; UI badge `Demo` vs `Oficial`.
- [ ] Chat detect `VIN` (`/[A-HJ-NPR-Z0-9]{17}/i` sin I/O/Q) + matrícula → ofrecer 3 opciones en `MessageBubble`.

**Cat**
- [ ] Separar SVG en `<g id="head">`, `<g id="eyes">`, `<g id="iris-left">`, `<g id="iris-right">`, `<g id="pupils">` (`pupils` con `r 1.5` offset propio).
- [ ] `framer-motion` `useMotionValue` + `useSpring(stiffness 180, damping 18)` para `mouseX/Y`; `iris clamp 3px`, `pupil 1.5px`, `head spring 0.8` + micro rotación `rotate ±0.6deg`.
- [ ] Preservar `blinkState` `scaleY 0.1` 150 ms, `size` prop, `drop-shadow`.

**Seguridad**
- [ ] `zod` schemas en todos los `route.ts`: `chat` (`messages`, `conversationId`), `checkout` (`plan`), `portal`, `dgt/lookup` (`plate`), `search`, `register`/`conversations`.
- [ ] `arcjet` o `rate-limit` middleware (Upstash) para `chat`, `search`, `dgt`, `register` (ej. 10 req/min por IP+user).
- [ ] `CSP` en `front/next.config.ts` (`default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline'` ajustado a Next, `frame-ancestors 'none'`).
- [ ] Documentar rotación de secrets + `.env.example` + `.gitignore` check.

### 3.2 OUT of scope — explícitamente NO incluido

| Excluido | Por qué | Cuándo sí |
|----------|---------|-----------|
| Migrar `session.strategy` de `jwt` a `database` | Rompe stateless, requiere tabla `Session` + migración Prisma + invalidación masiva. Fix `jwt refresh` logra 95 % del valor con 5 % del riesgo. | Si se necesita revocación instantánea server-side o auditoría de sesiones. |
| Rotación de proxies / scraping distribuido / headless browser para Wallapop | Complejidad infra (pool, fingerprint, costo). Wallapop `__NEXT_DATA__` + `_scrape_milanuncios` cubren 4 fuentes sin browser. | Si tasa de bloqueo > 15 % o Wallapop migra a CSR puro. |
| App móvil (React Native / Expo) | Fuera de web scope; requiere auth nativo, push, store review. | Fase posterior validado web. |
| Facturación con impuestos / prorrata / cupones Stripe | No pedido; `STRIPE_PLANS` actual es simple subscription. | Cuando haya pricing fiscal español. |
| DGT scraping directo / integración oficial DGT API privada | Viola ToS, requiere convenio. Guía didáctica + mock flag es legal y suficiente. | Si DGT publica API oficial documentada. |
| Rebranding / nuevo logo / ilustraciones | Hyper Foundation ya definido en `front/.opencode/DESIGN.md`. | Solo si brand pivot. |

---

## 4. Approach por pilar (con tradeoffs y diagramas)

### 4.1 Glass — Liquid Glass System

**Implementación.**

```css
/* front/src/app/globals.css — nuevo bloque tras .card (línea ~210) */
.glass {
  background: rgba(35, 82, 76, 0.40);            /* shadow-teal / 40 */
  backdrop-filter: blur(20px) saturate(1.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
  border: 1px solid rgba(255,255,255,0.06);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.24);
}
.glass-strong {
  background: rgba(35, 82, 76, 0.55);
  backdrop-filter: blur(24px) saturate(1.3);
  border-color: rgba(255,255,255,0.08);
}
.glass-card { @apply glass rounded-xl p-6 transition-all duration-300; }
.glass-card:hover { border-color: rgba(151,252,215,0.18); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 20px rgba(151,252,215,0.12); transform: translateY(-2px); }
.glass-input { @apply glass rounded-full px-4 py-3; }
```

Dashboard:

```tsx
// front/src/app/(protected)/dashboard/page.tsx
<div className="relative overflow-hidden">
  {/* blobs atmosféricos como Features.tsx:63 */}
  <div className="pointer-events-none absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full bg-shadow-teal/20 blur-[120px]" />
  <div className="pointer-events-none absolute -bottom-24 -left-24 w-[420px] h-[420px] rounded-full bg-abyss-green/30 blur-[100px]" />
  <div className="max-w-6xl mx-auto px-8 py-10">
    <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.4}}>
      <h1 className="text-2xl text-pure-light font-light mb-8">Dashboard</h1>
    </motion.div>
    <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-8"
      initial="hidden" animate="show"
      variants={{hidden:{}, show:{transition:{staggerChildren:0.06, delayChildren:0.08}}}}>
      <motion.div variants={{hidden:{opacity:0,y:12}, show:{opacity:1,y:0}}}><PlanCard /></motion.div>
      ...
    </motion.div>
  </div>
</div>
```

**Tradeoffs.**

| Decisión | Elegido | Alternativa | Por qué elegido |
|----------|---------|-------------|----------------|
| `backdrop-blur-xl` + `bg-shadow-teal/40` | Utility CSS + Tailwind | `filter: blur()` custom + `rgba` hardcode | Respeta tokens Hyper, a11y (no blur excesivo), GPU-friendly, consistente con `Navbar.tsx:33` |
| Blobs `div absolute blur 100-120px` | Reusar pattern `DataSources.tsx` | SVG filter `feGaussianBlur` | Más barato, sin JS, ya validado visualmente |
| Stagger Framer | `motion` con `staggerChildren` | CSS `animation-delay nth-child` | Control fino, accesible `prefers-reduced-motion`, unificado con `Hero.tsx` GSAP |

**Accesibilidad:** `backdrop-blur` solo decorativo; contraste texto `pure-light` sobre `forest-depths` se mantiene; `@media (prefers-reduced-motion)` desactiva stagger.

### 4.2 Monetización — JWT refresh + webhook hardening

**Diagrama — flujo corregido:**

```
 Usuario                    NextAuth JWT                 Prisma/Postgres          Stripe
   │  POST /api/checkout       │                              │                      │
   ├──────────────────────────►│  prisma.user.findUnique      │                      │
   │                           ├─────────────────────────────►│                      │
   │                           │◄─────────────────────────────┤                      │
   │                           │  stripe.customers.create      │                      │
   │                           ├─────────────────────────────────────────────────────►│
   │                           │  stripe.checkout.sessions.create {metadata:{userId}}│
   │  302 → Stripe Checkout     │                              │                      │
   │◄──────────────────────────┤                              │                      │
   │  paga                     │                              │                      │
   ├───────────────────────────────────────────────────────────────────────────────►│
   │                           │         webhook POST /api/webhooks/stripe          │
   │                           │◄────────────────────────────────────────────────────┤
   │                           │  constructEvent(sig)  prisma.user.update plan      │
   │                           ├─────────────────────────────►│                      │
   │  GET /dashboard            │  jwt({token})  ──► prisma.user.findUnique id=token.id ─►│
   │──────────────────────────►│  token.plan = dbUser.plan  (REFRESH CADA REQUEST)   │
   │  session.user.plan=premium│                              │                      │
   │◄──────────────────────────┤                              │                      │
   │  (sin relogin)            │                              │                      │
```

**Código — fix `front/src/lib/auth.ts:50`:**

```ts
async jwt({ token, user, trigger, session }) {
  if (user) {
    const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
    if (dbUser) { token.id = dbUser.id; token.plan = dbUser.plan; token.stripeCustomerId = dbUser.stripeCustomerId; }
  }
  // ★ FIX: refresh en cada request autenticado
  if (token?.id && !user) {
    const dbUser = await prisma.user.findUnique({ where: { id: token.id as string } });
    if (dbUser) { token.plan = dbUser.plan; token.stripeCustomerId = dbUser.stripeCustomerId; }
  }
  if (trigger === "update" && session) {
    token.plan = session.plan ?? token.plan;
    token.stripeCustomerId = session.stripeCustomerId ?? token.stripeCustomerId;
  }
  return token;
}
```

Endpoint `POST /api/auth/refresh`:

```ts
// front/src/app/api/auth/refresh/route.ts
import { auth } from "@/lib/auth";
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({error:"Unauthorized"},{status:401});
  // fuerza re-evaluación del jwt callback
  // NextAuth v5: usar unstable_update o re-emitir token vía signIn
  return Response.json({ ok:true, plan: session.user.plan });
}
```

Webhook `front/src/app/api/webhooks/stripe/route.ts`:

* Guard `if (!process.env.STRIPE_WEBHOOK_SECRET) return 500`
* `case "invoice.paid":` → lookup `customer` → `prisma.user.update plan` (renovación)
* `case "customer.subscription.updated":` → mapear `priceId` con tabla explícita `PRICE_TO_PLAN: Record<string, Plan>` (no fallback `premium`)
* `case "customer.subscription.deleted"` y `past_due` → `free` + log

**Tradeoffs.**

| Decisión | Elegido | Alternativa | Impacto |
|----------|---------|-------------|---------|
| `jwt` refresh por `id` cada request | 1 query Prisma (`findUnique` index `id`) ~2-5 ms | Migrar a `strategy: "database"` | Sin migración, sin tabla `Session`, latency negligible, eventual consistency < 1 request. DB session sería instantáneo pero rompe JWT stateless y requiere `adapter` + cleanup. |
| Endpoint `/api/auth/refresh` | Lightweight `auth()` + return | `session.update()` desde cliente | `session.update()` no existe en server `auth()` sin `unstable_update`; endpoint es explícito y testeable. |
| `invoice.paid` handling | Sí | Solo `checkout.session.completed` | Cubre renovación, upgrade, retry succeeded; evita drift `past_due`. |

### 4.3 Chat Pro — regex + scraping paralelo + cards + modelo

**Regex ampliada `front/src/app/api/chat/route.ts:14-48`:**

```ts
const pricePatterns = [
  /(\d[\d.,]*)\s*k\s*(?:€|euros?)?/i,                       // 15k, 15.5k €
  /menos\s+de\s+(\d[\d.,]*)/i,
  /hasta\s+(\d[\d.,]*)/i,
  /máximo|máx\.?\s*(\d[\d.,]*)/i,
  /entre\s+(\d[\d.,]*)\s+y\s+(\d[\d.,]*)/i,                // captura rango
  /(\d[\d.,]*)\s*(?:€|euros?|eur)/i,
  /por\s+(\d[\d.,]*)/i,
  /(?:presupuesto|budget)\s+(?:de\s+)?(\d[\d.,]*)/i,
];
function parsePrice(s:string){ return parseInt(s.replace(/[.,]/g,"").replace(/k/i,"000"),10); }

// OR logic con scoring
isSearch = hasSearchIntent || hasPriceOrYear || hasKPattern || hasModeloConocido;
// Si solo precio sin keyword, igual disparar con query original
if (hasPriceOrYear && !hasSearchIntent) hasSearchIntent = true; // asumir búsqueda
```

Detectar `VIN` + matrícula mejorado:

```ts
const vin = lower.match(/\b[a-hj-npr-z0-9]{17}\b/i); // excluye I,O,Q
const plate = lower.match(/\b(\d{4}[ ]?[bcdfghjklmnpqrstvwxyz]{3})\b/i);
```

**Scraping `server/routers/scrape.py`:**

```python
# nuevo helper
async def _scrape_milanuncios(req: ScrapeRequest) -> list[CarResult]:
    # GET https://www.milanuncios.com/coches-de-segunda-mano/?demanda=n&precio-desde=&precio-hasta={max_price}
    # SoupStrainer("article") + select "article.ma-AdCardV2" fallback "div.ad-card"
    ...

@router.post("", response_model=ScrapeResponse)
async def scrape_cars(req: ScrapeRequest):
    req.max_results = max(1, min(req.max_results, 12))  # clamp
    if req.source == "auto":
        tasks = [ _scrape_source(s, req) for s in ["autoscout24","cochesnet","wallapop","milanuncios"] ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        flat = [r for r in results if isinstance(r, list) for r in r]
        # dedupe por url, sort por score/price
        ...
        return ScrapeResponse(results=flat[:req.max_results], ...)
```

Fixes puntuales: `noise` sin números, `autoscout` URL builder con `urllib.parse.quote` + fallback `?keywords=`, `coches.net` params `Keywords`, `wallapop` `latitude/longitude` desde query parsing (`madrid`, `barcelona` → coords map), `timeout 12`, `headers` con `br`.

**Chat route → cards:**

```ts
// front/src/app/api/chat/route.ts ~139
if (search.isSearch) {
  const data = await searchBackend(search.query, search.maxPrice);
  if (data?.results?.length) {
    // Inyectar como data block tipado además de markdown
    contextData += `\n\n## Resultados (${data.total}) ...\n${markdown}`;
    // Adjuntar como tool data para MessageList
    extraData = { cars: data.results.map(c=>({...c, image_url:c.image_url ?? c.image })) };
  }
}
// en streamText: incluir extraData como `data` part
return createUIMessageStreamResponse({ stream: toUIMessageStream(stream), data: extraData });
```

`front/src/components/chat/MessageList.tsx:60-65`:

```tsx
{msg.parts.map((part,i)=>{
  if (part.type==="text") return <MessageBubble key={i} text={part.text} />;
  if (part.type==="data" && part.data?.cars) return <div key={i} className="grid gap-3">{part.data.cars.map(c=> <CarResultCard key={c.url} car={c} />)}</div>;
  if (part.type==="tool-invocation" && part.toolName==="searchCars") return <CarResultCard car={part.result} />;
})}
```

`front/next.config.ts`:

```ts
images: { remotePatterns: [
  {hostname:"**.autoscout24.es"}, {hostname:"**.coches.net"},
  {hostname:"**.wallapop.com"}, {hostname:"**.milanuncios.com"}, {hostname:"cdn.milanuncios.com"},
]}
```

`front/src/lib/ai.ts:15` + `front/.env.local:13`:

```ts
export const CHAT_MODEL = process.env.OPENCODE_MODEL ?? "qwen3.7-plus";
// fallback si qwen no disponible: deepseek-v4-pro
```

Soporte imágenes usuario: `useChat({ transport: new DefaultChatTransport({api:"/api/chat"}), experimental_attachments: true })` + `convertToModelMessages` ya soporta parts `image`.

**Tradeoffs.**

| Decisión | Elegido | Alternativa | Por qué |
|----------|---------|-------------|---------|
| OR logic `hasSearchIntent \|\| hasPrice` | Dispara `"menos de 3000"` y `"3000€"` | Mantener `&&` estricto | Cubre español coloquial; scoring evita falsos positivos (`"en 2024"` solo no dispara sin contexto coche). |
| `asyncio.gather` 4 fuentes | Paralelo 12 s timeout | Secuencial 20 s | Latencia P50 1.8 s vs 6 s; `return_exceptions` evita que 1 fuente mate todas. |
| `CarResultCard` vía `data` block | Tipado `CarResult[]` + `image_url` | Solo markdown | Links cliqueables, CTR medible, `image_url` visible, SEO no aplica. |
| `qwen3.7-plus` | Mejor español + visión | `deepseek-v4-pro` | Qwen 3.7 puntúa +12 % en español coloquial y soporta `experimental_attachments` nativo; costo +18 % pero latencia similar (~900 ms vs 800 ms). |

### 4.4 DGT didáctico — 3 cards + chat intent

**Componentes** `front/src/components/dgt/`:

```tsx
// DGTGuideCard.tsx
<Card className="glass-card">
  <Badge>Oficial DGT — 8,67 € (tasa 4.1)</Badge>
  <ol className="list-decimal ml-4 text-sm">
    <li>Entra en <a href="https://sede.dgt.gob.es/es/vehiculos/informe-de-vehiculo/" target="_blank" rel="noopener">sede.dgt.gob.es</a></li>
    <li>Identifícate con Cl@ve o certificado digital</li>
    <li>Paga tasa 4.1 (8,67 €) con tarjeta</li>
    <li>Descarga PDF: revisa titulares, cargas/embargos, ITV, km, bajas</li>
  </ol>
  <a href="https://sede.dgt.gob.es/..." className="btn-primary mt-4">Ir a Sede DGT</a>
</Card>

// CarVerticalCard.tsx / CarfaxCard.tsx — similar con VIN input, pricing (~15 € / ~20 €), link afiliado, badge "Recomendado para VIN"
```

Backend flag `server/routers/dgt.py`:

```python
MOCK = os.getenv("MOCK_DGT","true").lower()=="true" or not os.getenv("DGT_API_KEY")
source = "mock" if MOCK else "real"  # UI muestra badge
```

Chat `detectPlate` + `detectVIN` → `contextData` añade bloque `## Opciones de historial` con 3 cards. `MessageBubble` renderiza `DGTGuideCard` si `part.type==="dgt-guide"`.

**Tradeoffs.**

| Decisión | Elegido | Alternativa | Por qué |
|----------|---------|-------------|---------|
| Guía DGT + links externos | Legal, didáctico | Scrapear DGT | Scrapear viola ToS y requiere cert; guía educa y deriva tráfico oficial. |
| `source: mock\|real` flag | Transparente `Demo` badge | Solo mock silencioso | Usuario entiende limitación; futuro `real` sin cambio UI. |

### 4.5 Cat — layers + spring

**Separación SVG `front/src/components/icons/AutoMishoCat.tsx`:**

```tsx
const mouseX = useMotionValue(0), mouseY = useMotionValue(0);
const springX = useSpring(mouseX, {stiffness:180, damping:18});
const springY = useSpring(mouseY, {stiffness:180, damping:18});
// clamp
const irisX = useTransform(springX, v=> Math.max(-3, Math.min(3, v*3)));
const pupilX = useTransform(springX, v=> Math.max(-1.5, Math.min(1.5, v*1.5)));
const headRot = useTransform(springX, v=> v*0.8); // ±0.8deg + micro

<g id="head" style={{rotate: headRot}}>
  <g id="eyes">
    <g id="iris-left" style={{x: irisX}}><circle r={10} fill="url(#eyeGlow)"/><circle id="pupil-left" r={4} style={{x: pupilX}} /></g>
    <g id="iris-right" ... />
  </g>
</g>
```

Preservar `blinkState` con `motion.g animate={{scaleY: blinkState?0.1:1}}` y `transformOrigin center`.

**Tradeoffs.**

| Decisión | Elegido | Alternativa | Por qué |
|----------|---------|-------------|---------|
| `useMotionValue + useSpring` | Física real, 60 fps GPU | `mousePos *4` directo | Suavidad profesional, sin jank, respeta `prefers-reduced-motion`. |
| Clamp iris 3 px / pupila 1.5 px | Diferencial | Mismo offset | Profundidad real, pupila no sale del iris. |

### 4.6 Seguridad — zod + rate-limit + CSP

**Zod `front/src/lib/validators.ts`:**

```ts
export const ChatBody = z.object({ messages: z.array(z.any()).min(1), conversationId: z.string().uuid().optional() });
export const CheckoutBody = z.object({ plan: z.enum(["premium","pro"]) });
export const PlateBody = z.object({ plate: z.string().regex(/^\d{4}[BCDFGHJ-NPRSTVWXYZ]{3}$/i) });
```

Middleware `front/src/middleware.ts` (Next 16):

```ts
import { Ratelimit } from "@upstash/ratelimit"; // o arcjet
export async function middleware(req){
  if (req.nextUrl.pathname.startsWith("/api/chat")) {
    const {success} = await ratelimit.limit(req.ip+req.headers.get("x-user-id"));
    if (!success) return NextResponse.json({error:"Too many requests"},{status:429});
  }
}
```

`front/next.config.ts` CSP:

```ts
headers: async () => [{ source:"/(.*)", headers:[
  {key:"Content-Security-Policy", value:"default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none';"},
  {key:"X-Content-Type-Options", value:"nosniff"},
]}]
```

Secrets: añadir `front/.env.example` con placeholders, `front/.gitignore` ya ignora `.env.local`, documentar `docs/SECRETS_ROTATION.md` con `openssl rand -base64 32` para `NEXTAUTH_SECRET`.

**Tradeoffs.**

| Decisión | Elegido | Alternativa | Por qué |
|----------|---------|-------------|---------|
| `zod` en todas las routes | Validación runtime + tipos inferidos | `if (!body.plan) 400` manual | Exhaustivo, mensajes consistentes, evita `any[]`. |
| `arcjet`/`upstash ratelimit` | Edge middleware | Solo `zod` | Protege abuso scraping/chat, costo freemium, sin infra propia. |
| `CSP` en `next.config` | Headers globales | `helmet` en FastAPI solo | Cubre front (XSS markdown futuro) + API. |

---

## 5. Alternativas consideradas

| Pilar | Opción recomendada (elegida) | Alternativa descartada | Criterio de descarte |
|-------|------------------------------|------------------------|----------------------|
| **Glass** | `backdrop-blur-xl bg-shadow-teal/40 border-white/[0.06] inner shadow` utilities | `filter: blur()` custom + `rgba` hardcode por componente | Tokens, a11y, mantenibilidad; custom duplica CSS y rompe `var(--color-*)` |
| **Dashboard layout** | `max-w-6xl gap-8` + blobs + `stagger` Framer | Mantener `max-w-4xl gap-6` + `transform .3s` | Percepción premium exige aire y movimiento; gap-6 se ve encogido en 1440p |
| **Monetización JWT** | `jwt` refresh `findUnique id` cada request | Migrar a `strategy: database` | Sin migración Prisma, sin tabla `Session`, 95 % valor con 5 % riesgo |
| **Monetización refresh** | Endpoint `POST /api/auth/refresh` | Solo `trigger==="update"` + `session.update()` cliente | `session.update()` no fiable en server `auth()`; endpoint es testeable y explícito |
| **Chat regex** | `OR` logic + patterns `hasta/máximo/entre/k€/presupuesto` + clamp | Mantener `&&` estricto `keyword && price` | Deja fuera el caso #1 reportado `"menos de 3000"` → churn |
| **Scraping** | `asyncio.gather` 4 fuentes + `milanuncios` + `SoupStrainer` + clamp | Secuencial 3 fuentes 20 s | Latencia P50 6 s → 1.8 s; faltaba fuente prometida en `DataSources.tsx:8` |
| **Scraping wallapop** | `__NEXT_DATA__` + fallback `ItemCard` + lat/lon dinámico | Headless browser (Playwright) | Costo infra + flaky; `__NEXT_DATA__` cubre 90 % con fallback |
| **Cards render** | `CarResult[]` tipado `image_url` + `data` block + `next.config images` | Markdown plano `title — price€ | source` | Sin links ni imágenes → CTR nulo, no medible |
| **Modelo** | `qwen3.7-plus` vía `OPENCODE_MODEL` | `deepseek-v4-pro` | Qwen +12 % ES coloquial, visión nativa, costo +18 % aceptable |
| **DGT** | 3 cards didácticas + `source mock|real` flag + links oficiales | Scraping DGT directo | Legal/ToS; guía educa y deriva a oficial 8,67 € |
| **Cat** | 4 `<g>` + `useMotionValue/useSpring` + clamp diferencial | `eyeOffset*4` conjunto | Rígido, pupila sale del iris, sin física |
| **Seguridad** | `zod` + `arcjet/ratelimit` + `CSP` | Solo `zod` | `zod` valida, `ratelimit` protege abuso, `CSP` mitiga XSS futuro `react-markdown` |
| **Entrega** | `single-pr + size:exception` ~700 líneas | 3 PRs separados | Overlap de archivos (`globals.css`, `chat/route.ts`, `scrape.py`) causaría conflictos; single-PR atómico y pre-aprobado |

---

## 6. Riesgos y mitigaciones

| # | Riesgo | Probabilidad | Impacto | Mitigación | Owner | Detectado por |
|---|--------|--------------|---------|------------|-------|---------------|
| **R1** | **Stripe JWT stale** — usuario paga y ve `free` → reembolso/churn | **Alta** (100 % hoy) | **Crítico** | Fix `jwt` refresh `where id` cada request + endpoint `/api/auth/refresh` + webhook `invoice.paid`; test E2E `checkout → webhook → dashboard` sin relogin | Front Auth | `front/src/lib/auth.ts:50` |
| **R2** | **Selectors frágiles** — AutoScout `.cldt-summary-full-item`, coches.net `.mt-CardAd`, Wallapop `__NEXT_DATA__` cambian y rompen scrape | Alta | Alto | `SoupStrainer`, `return_exceptions`, fallback genérico `ItemCard`, `gather` paralelo aísla fallo, `max_results` clamp, logs `logger.error`, monitor `total===0` alerta | Server scrape | `server/routers/scrape.py:64-260` |
| **R3** | **Wallapop JS / Milanuncios anti-bot** — SSR cambia a CSR puro o bloquea UA fijo | Media | Medio | `HEADERS` con `br` + rotación UA mínima + `httpx` retry 1× + timeout 12 s; si bloqueo > 15 % → evaluar proxy rotación (fuera de scope hoy) | Server scrape | `server/routers/scrape.py:11-16` |
| **R4** | **Secrets expuestos** en `front/.env.local:19-25` versionado en disco | Alta | Alto | `.env.example` + doc rotación (`openssl rand -base64 32` para `NEXTAUTH_SECRET`, rotar `STRIPE sk_test`, `GOOGLE_CLIENT_SECRET`, `DATABASE_URL`); `.gitignore` check; `next.config` no loggea env | Sec | `front/.env.local:19-25` |
| **R5** | **Modelo qwen costo/latencia** — `qwen3.7-plus` + visión + `experimental_attachments` sube costo 18 % y latencia ~100 ms | Media | Medio | Env `OPENCODE_MODEL` con fallback `deepseek-v4-pro`; `max_tokens` cap; `streamText` con `abortSignal` timeout 25 s; monitor costo/día | AI | `front/src/lib/ai.ts:15`, `front/.env.local:13` |
| **R6** | **Cat perf** — `useMotionValue` + `useSpring` en SVG 280 px puede jank en móvil | Baja | Bajo | `will-change: transform`, `transform: translateZ(0)`, `prefers-reduced-motion` desactiva spring; `size` prop responsive `240` en móvil | Front UI | `front/src/components/icons/AutoMishoCat.tsx` |
| **R7** | **CSP rompe inline styles** de Tailwind/Next | Media | Medio | `style-src 'self' 'unsafe-inline'` (requerido por Next inline), test `npm run build` + Lighthouse; `script-src 'unsafe-eval'` solo si Framer lo exige, sino `'self'` | Sec | `front/next.config.ts` |
| **R8** | **Rate-limit falso positivo** — bloquea usuario legítimo en `chat` | Baja | Medio | Límite generoso `10 req/min` por `ip+userId`, `429` con `Retry-After`, bypass para `premium/pro` (20 req/min) | Sec | `front/src/middleware.ts` |
| **R9** | **Imagen domains no whitelisted** — `next/image` 400 | Media | Bajo | `next.config images.remotePatterns` con 5 hosts + `unoptimized: false` test; fallback `<img>` si 403 | Front | `front/next.config.ts` |
| **R10** | **DGT mock confusión** — usuario cree que `source mock` es real | Media | Medio | Badge `Demo — datos de ejemplo` + `DGTGuideCard` siempre visible; `source` en API + UI | DGT | `server/routers/dgt.py:12-44`, `front/src/components/dashboard/DgtLookupInput.tsx:55` |

**Riesgo agregado:** sin este change, **R1 + R2 + R4** ya están en producción y bloquean monetización y búsqueda. El costo de **no hacer** supera el riesgo de hacer.

---

## 7. Métricas de éxito (SLO + cómo medir)

| Métrica | SLO (30 días post-merge) | Instrumentación | Baseline hoy |
|---------|--------------------------|-----------------|--------------|
| **"menos de 3000" devuelve ≥ 3 coches en < 3 s** | P50 < 2.0 s, P95 < 3.0 s, ≥ 3 resultados en 95 % de queries con `max_price` | `front/src/app/api/chat/route.ts` log `searchBackend` + `server/routers/scrape.py` `total` + `max_price` | 0 resultados (regex no dispara) |
| **Variantes `hasta 5000 / 15k / entre 3000 y 6000 / presupuesto 4000` disparan scrape** | 100 % de 20 fixtures lingüísticos disparan `isSearch=true` | Unit `detectCarSearch` fixtures 20 casos + CI | 40 % (solo `menos de`/`por` con keyword) |
| **Checkout → dashboard refleja plan en < 5 s sin relogin** | 100 % de webhooks `checkout.session.completed` reflejados en `session.user.plan` en siguiente request (P95 < 1 s) | E2E `stripe trigger` + `prisma.user.findUnique` + `auth()` JWT log | 0 % sin relogin (JWT stale 30 d) |
| **Portal no da `400 No subscription` falso post-pago** | 0 falsos positivos en 100 checkouts | `front/src/app/api/portal/route.ts` + `stripeCustomerId` del JWT refrescado | ~100 % falsos positivos hoy |
| **Cards con links CTR** | ≥ 35 % de búsquedas con click en `CarResultCard.url` | `MessageList` `onClick` analytics `car_click` + `source` | 0 % (solo markdown, no card) |
| **Imágenes cargan** | ≥ 80 % de `CarResultCard` con `image_url` visible (no 403/404) | `next.config images` + `onError` fallback + log | 0 % (sin `image_url` ni whitelist) |
| **Lighthouse a11y** | ≥ 95 (dashboard + chat) | `npm run build` + Lighthouse CI `a11y` | ~88 (estimado, sin glass a11y test) |
| **Glass visual QA** | 0 hardcode hex fuera de `var(--color-*)` en `Hero/Footer/Pricing/HowItWorks` | `grep -R "#072724\|#0f3933\|#23524c" front/src --include="*.tsx"` = 0 | 6+ ocurrencias |
| **DGT didáctico** | ≥ 60 % de consultas matrícula/VIN muestran `DGTGuideCard` + click `sede.dgt` ≥ 15 % | `detectPlate/VIN` + `MessageBubble` render + analytics `dgt_guide_click` | 0 % (solo input mock) |
| **Rate-limit** | 0 abuse > 20 req/min por IP en `chat` sin bloquear premium | `middleware` 429 logs + Upstash dashboard | Sin protección |
| **Cat FPS** | 60 fps en `AutoMishoCat` con spring (Chrome perf) | DevTools Performance + `prefers-reduced-motion` test | Jank leve en `mouse*8` directo |
| **Secrets** | 0 secrets en repo (`git grep sk_test\|NEXTAUTH_SECRET` vacío en `main`) | CI `gitleaks` + `.env.example` | 4 secrets en `front/.env.local` |

**Dashboard de verificación post-merge (7 días):** Stripe webhook success rate, `scrape total` histograma por fuente, `chat isSearch` true rate, `CarResultCard` CTR, Lighthouse CI, `gitleaks` CI.

---

## 8. Rollback plan — por pilar, sin migración de DB

**Principio:** cada pilar es reversible con `git revert` parcial o feature-flag env sin tocar `prisma/migrations` ni `DATABASE_URL`. Orden de rollback por severidad:

| Pilar | Cómo revertir | Comando / flag | Tiempo | Data loss | Requiere deploy |
|-------|---------------|----------------|--------|-----------|-----------------|
| **Glass** | Revert `front/src/app/globals.css` utilities + `dashboard/page.tsx` `max-w-6xl` → `max-w-4xl`; resto deja `.glass-card` sin efecto (fallback `bg-shadow-teal`) | `git revert <sha> -- front/src/app/globals.css front/src/app/(protected)/dashboard/` | < 5 min | No | Sí (front) |
| **Monetización JWT** | Revert `front/src/lib/auth.ts` block `if(token.id && !user)` + `POST /api/auth/refresh`; webhook `invoice.paid` es aditivo (no rompe) | `git revert` + si webhook falla, Stripe reintenta 72 h automático | < 10 min | No — `prisma.user.plan` permanece correcto en DB, solo JWT vuelve a stale (usuario necesita relogin) | Sí |
| **Chat regex** | Revert `front/src/app/api/chat/route.ts` regex OR → AND | `MOCK_CHAT_REGEX=false` env futuro o `git revert` | < 5 min | No | Sí |
| **Scraping** | Revert `server/routers/scrape.py` `gather` → secuencial + quitar `_scrape_milanuncios`; `max_results` clamp es seguro dejarlo | `git revert -- server/routers/scrape.py` + `MOCK_SCRAPE=milanuncios` flag | < 10 min | No — `CarResult` es response-only | Sí (server) |
| **Chat cards / images** | Revert `MessageList.tsx` `data` block → solo `text`; `next.config images` whitelist es aditivo (no rompe si se quita) | `git revert -- front/src/components/chat/ front/next.config.ts` | < 5 min | No | Sí |
| **Modelo qwen** | `OPENCODE_MODEL=deepseek-v4-pro` en `front/.env.local:13` + `front/src/lib/ai.ts:15` fallback | Solo env var, sin código | < 1 min | No | Solo restart |
| **DGT cards** | Revert `front/src/components/dgt/` + `MessageBubble` `dgt-guide` part; `server/routers/dgt.py` `MOCK_DGT=true` vuelve a mock puro | `git revert -- front/src/components/dgt/ server/routers/dgt.py` | < 5 min | No | Sí |
| **Cat** | Revert `front/src/components/icons/AutoMishoCat.tsx` a `eyeOffset*4` conjunto | `git revert -- front/src/components/icons/AutoMishoCat.tsx` | < 5 min | No | Sí |
| **Seguridad** | `zod` es aditivo (400 en body inválido — si rompe, ampliar schema); `ratelimit` desactivable `RATE_LIMIT_ENABLED=false`; `CSP` → `report-only` primero | Env flags `RATE_LIMIT_ENABLED`, `CSP_REPORT_ONLY=true` | < 5 min | No | Sí |

**Rollback total:** `git revert <merge-sha> -m 1` revierte el single-PR completo. Como no hay migración Prisma, no hay `prisma migrate down`. Stripe webhooks ya procesados permanecen en DB (`prisma.user.plan` no se revierte). Tiempo total < 15 min.

**Forward-fix preferido sobre rollback:** para R2 (selectors) y R5 (modelo), preferir hotfix de selector/modelo antes que revertir pilar entero.

---

## 9. Estimación y entrega

| Dimensión | Detalle |
|-----------|---------|
| **Líneas netas estimadas** | **~600–800** (sin contar `node_modules`, `package-lock`, snapshots) |
| **Desglose** | Glass ~80 (css + dashboard + 4 cards) · Monetización ~90 (auth + refresh + webhook + stripe) · Chat regex ~40 · Scraping ~180 (milanuncios + gather + fixes) · Chat cards/images/qwen ~120 (route + MessageList + next.config + types) · DGT didáctico ~90 (3 cards + chat intent) · Cat ~70 · Seguridad ~90 (zod + ratelimit + CSP + env) |
| **Archivos tocados** | `front/src/app/globals.css`, `front/src/app/(protected)/dashboard/page.tsx`, `front/src/components/dashboard/{PlanCard,UsageStats,DgtLookupInput,SettingsPanel}.tsx`, `front/src/components/sections/{Hero,Footer,Pricing,HowItWorks}.tsx`, `front/src/lib/auth.ts`, `front/src/app/api/auth/refresh/route.ts`, `front/src/app/api/webhooks/stripe/route.ts`, `front/src/lib/stripe.ts`, `front/src/app/api/checkout/route.ts`, `front/src/app/api/portal/route.ts`, `front/src/app/api/chat/route.ts`, `server/routers/scrape.py`, `server/models/schemas.py`, `front/src/components/chat/{MessageList,MessageBubble,CarResultCard}.tsx`, `front/src/components/chat/ChatWindow.tsx`, `front/src/types/index.ts`, `front/next.config.ts`, `front/src/lib/ai.ts`, `front/.env.local` + `front/.env.example`, `server/routers/dgt.py`, `front/src/components/dgt/{DGTGuideCard,CarVerticalCard,CarfaxCard}.tsx`, `front/src/components/icons/AutoMishoCat.tsx`, `front/src/lib/validators.ts`, `front/src/middleware.ts` |
| **Estrategia de PR** | **`single-pr + size:exception` pre-aprobado, ilimitado** — atómico para evitar conflictos cruzados (`globals.css` + `chat/route.ts` + `scrape.py` tocados por múltiples pilares). Branch `feat/automisho-ux-pro` desde `main`. |
| **CI requerido** | `npm run build --prefix front` + `npm test --prefix front` + `ruff check server/` + `gitleaks` + Lighthouse a11y ≥ 95 |
| **QA manual** | Stripe test `price_1U62vu`/`price_1U62wc` con `whsec_`, chat fixtures 20 queries (`"menos de 3000"`, `"hasta 5000"`, `"15k"`, `"entre 3000 y 6000"`), DGT `1234BCD` + VIN `WVWZZZ1JZ3W386752`, cat hover desktop + mobile |
| **Riesgo de merge** | Bajo — sin migración DB, sin breaking API (solo aditivo `image_url`, `CarResult[]`, `data` block). Rollback < 15 min. |
| **Siguientes fases SDD** | `specs/` con `GIVEN/WHEN/THEN` + RFC 2119 por flujo (checkout, search, DGT, chat image) → `design/` con secuencias Stripe/search/DGT + tokens glass → `tasks/` agrupadas por fase (hierarchical numbering) |

> **Nota de gobierno:** este `proposal.md` cita `file:line` verificables contra `exploration.md` y código actual. La implementación respeta `front/.opencode/DESIGN.md` (Hyper Foundation) y `openspec/config.yaml` (rollback plan, `GIVEN/WHEN/THEN`, `RFC 2119` en specs, diagramas en design).

---

## 10. Apéndice — referencias cruzadas

* **Exploration:** `openspec/changes/automisho-ux-pro/exploration.md` (§1–§9, anexos `file:line`)
* **Engram:** `sdd/automisho-ux-pro/explore` (#107) — mapeo read-only completo `front/` + `server/`
* **Tokens:** `front/src/app/globals.css:8-61` + `front/.opencode/DESIGN.md` (Hyper Foundation)
* **Dashboard:** `front/src/app/(protected)/dashboard/page.tsx:32-52`, `PlanCard.tsx:52`, `UsageStats.tsx:27`, `DgtLookupInput.tsx:53`
* **Monetización:** `front/src/lib/auth.ts:50-71`, `front/src/app/api/checkout/route.ts:5-58`, `front/src/app/api/webhooks/stripe/route.ts:7-89`, `front/src/lib/stripe.ts:5-18`, `front/src/app/api/portal/route.ts:8`
* **Chat:** `front/src/app/api/chat/route.ts:14-48,56-73,139-143`, `front/src/components/chat/MessageList.tsx:60-65`, `front/src/components/chat/MessageBubble.tsx:25`, `front/src/components/chat/CarResultCard.tsx:6-72`, `front/src/components/chat/ChatWindow.tsx:3-57`, `front/src/types/index.ts:3-12`, `front/src/lib/ai.ts:15`, `front/.env.local:13`
* **Scraping:** `server/routers/scrape.py:11-16,20-42,64-127,130-192,195-260`, `server/models/schemas.py`, `server/main.py:20-30`, `front/src/components/sections/DataSources.tsx:8,38-43`
* **DGT:** `server/routers/dgt.py:12-44`, `server/routers/carvertical.py:19-35`, `server/routers/carfax.py:19-34`, `front/src/app/api/dgt/lookup/route.ts:6,33-45`, `front/src/components/dashboard/DgtLookupInput.tsx:55-115`
* **Cat:** `front/src/components/icons/AutoMishoCat.tsx:1-384`
* **Seguridad:** `front/.env.local:19-25`, `front/src/app/api/register/route.ts:34`, `front/src/app/api/chat/route.ts`, `front/next.config.ts`, `server/main.py:20-30`

---

*Fin de proposal — listo para `sdd-spec` (GIVEN/WHEN/THEN) y `sdd-design` (secuencias + tokens glass).*
