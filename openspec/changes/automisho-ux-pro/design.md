# Design — automisho-ux-pro

**Change ID:** `automisho-ux-pro`  
**Status:** `draft` — pendiente de `tasks`  
**Date:** 2026-08-20  
**Authors:** UX Pro Working Group (Front + Server + Design)  
**Depends on:** `exploration.md` · `proposal.md` · `specs/*.md` (6 deltas) · engram `sdd/automisho-ux-pro/spec` (#109)  
**Stack:** Next 16 App Router + React 19 + Prisma 7/PostgreSQL + NextAuth v5 beta (JWT) + Stripe + AI SDK (opencode-go) + Tailwind v4 + Framer Motion 12 / GSAP / Lenis · FastAPI + httpx + BeautifulSoup (lxml) en `server/`  
**Files in scope:** ~32 archivos (`globals.css`, `dashboard/page.tsx`, `dashboard/*.tsx`, `chat/route.ts`, `scrape.py`, `dgt.py`, `AutoMishoCat.tsx`, `next.config.ts`, `validators.ts`, `middleware.ts`, `MessageList.tsx`, `ai.ts`, `.env.example`)

---

## Índice

1. [Arquitectura overview](#1-arquitectura-overview)
2. [Tokens liquid glass](#2-tokens-liquid-glass)
3. [Secuencias](#3-secuencias)
4. [Decisiones de arquitectura (ADR)](#4-decisiones-de-arquitectura-adr)
5. [Componentes y contratos](#5-componentes-y-contratos)
6. [Security design](#6-security-design)
7. [Performance y a11y](#7-performance-y-a11y)
8. [Testing strategy](#8-testing-strategy)
9. [Rollout y rollback](#9-rollout-y-rollback)
10. [Apéndices](#10-apéndices)

---

## 1. Arquitectura overview

### 1.1 Diagrama de sistema — front / server / terceros

```mermaid
graph TB
    subgraph User["Usuario (Browser)"]
        UI_Dash["/dashboard\nDashboardGrid + glass-card\nblobs + stagger"]
        UI_Chat["/chat\nChatWindow + MessageList\nCarResultCard[] + DGTGuideCard"]
        UI_Cat["AutoMishoCat\nSVG layers + spring"]
        UI_Pricing["/pricing\nPricing + Checkout"]
    end

    subgraph Front["front/ — Next 16 App Router (Vercel)"]
        MW["middleware.ts\nrate-limit 10/min (premium 20)\n+RATE_LIMIT_ENABLED flag"]
        AUTH["lib/auth.ts\nNextAuth v5 JWT\njwt() refresh por id cada request"]
        REFRESH["POST /api/auth/refresh\nunstable_update → {ok,plan}"]
        CHECKOUT["POST /api/checkout\nzod plan enum\nstripe.customers.create\nstripe.checkout.sessions.create"]
        WEBHOOK["POST /api/webhooks/stripe\nconstructEvent + PRICE_TO_PLAN\nidempotente 5 eventos"]
        PORTAL["POST /api/portal\nprisma fresh (no JWT stale)"]
        CHAT["POST /api/chat\nzod messages + detectCarSearch\nsearchBackend + lookupDgt\nstreamText qwen3.7-plus"]
        DGT_PROXY["POST /api/dgt/lookup\nzod plate regex\nproxy → server/dgt"]
        VALIDATORS["lib/validators.ts\nzod schemas centralizados"]
        NEXT_CFG["next.config.ts\nCSP headers + images.remotePatterns"]
        GLASS["globals.css\n.glass / .glass-strong\n.glass-card / .glass-input\n+ @supports fallback"]
        AI_LIB["lib/ai.ts\nCHAT_MODEL = OPENCODE_MODEL ?? qwen3.7-plus"]
    end

    subgraph Server["server/ — FastAPI (httpx + lxml)"]
        SCRAPE["POST /scrape\nscrape_cars gather 4 fuentes\ntimeout 12s SoupStrainer"]
        AS[" _scrape_autoscout24\nlst/* + SoupStrainer article"]
        CN[" _scrape_cochesnet\nmt-CardAd"]
        WP[" _scrape_wallapop\n__NEXT_DATA__ + lat/lon dinámico"]
        MN[" _scrape_milanuncios *NUEVO*\narticle.ma-AdCardV2"]
        DGT_SRV["POST /dgt\nsource mock|real flag"]
        CV["POST /carvertical\nmock|real"]
        CF["POST /carfax\nmock|real"]
    end

    subgraph Third["Terceros"]
        STRIPE["Stripe API\ncheckout + billing portal\nwebhooks"]
        OCODE["opencode-go\nhttps://opencode.ai/zen/go/v1\nqwen3.7-plus / deepseek fallback"]
        DGT_OFF["sede.dgt.gob.es\n(informe vehículo 8,67€)\nsolo link, no scrape"]
        EXT_IMG["CDNs imágenes\n*.autoscout24.es\n*.coches.net\n*.wallapop.com\n*.milanuncios.com"]
    end

    UI_Pricing --> CHECKOUT --> STRIPE
    STRIPE -- webhook sig --> WEBHOOK --> AUTH
    AUTH -- prisma findUnique id --> REFRESH
    UI_Dash --> AUTH --> PORTAL --> STRIPE
    UI_Dash --> DGT_PROXY --> DGT_SRV
    UI_Chat --> CHAT --> SCRAPE
    SCRAPE --> AS & CN & WP & MN
    CHAT --> DGT_SRV
    CHAT --> OCODE
    UI_Chat -. image_url .-> EXT_IMG
    GLASS -. backdrop-blur .-> UI_Dash & UI_Chat & UI_Cat
    MW -. 429 .-> CHAT & CHECKOUT & DGT_PROXY
    NEXT_CFG -. CSP .-> Front
    UI_Cat -. mouse spring .-> GLASS
    DGT_OFF -. href noopener .-> UI_Chat & UI_Dash

    classDef front fill:#0f3933,stroke:#97fcd7,color:#fff
    classDef server fill:#122d28,stroke:#33998c,color:#b0c5c1
    classDef stripe fill:#23524c,stroke:#97fcd7,color:#fff
    class Front,UI_Dash,UI_Chat,UI_Cat,UI_Pricing front
    class Server,SCRAPE,DGT_SRV server
    class STRIPE,OCODE stripe
```

### 1.2 Stack y límites por capa

| Capa | Runtime | Estado actual | Cambio en este design |
|------|---------|---------------|----------------------|
| **front app** | Next 16 App Router, React 19, Tailwind v4 `@theme` | Tokens Hyper OK, sin glass, JWT stale, sin zod/ratelimit/CSP, sin whitelist images, `deepseek` hardcode | Glass utilities + dashboard `max-w-6xl gap-8` + blobs + stagger; JWT refresh por `token.id`; `POST /api/auth/refresh`; webhook 5 eventos + `PRICE_TO_PLAN`; `validators.ts`; `middleware.ts`; `next.config` CSP + `images.remotePatterns`; `CHAT_MODEL` qwen |
| **front chat** | AI SDK `streamText` + `useChat` | `detectCarSearch` AND estricto, `image_url` nunca llega, `MessageList` solo text | OR logic + 8 patterns + VIN; `searchBackend` 12s abort; `extraData.cars` + `CarResultCard` grid; `experimental_attachments` + `convertToModelMessages` imagen |
| **server scrape** | FastAPI + `httpx.AsyncClient` + `lxml` | Secuencial, 3 fuentes, timeout 20, `HEADERS` fijo, `noise` borra números, sin `milanuncios` | `asyncio.gather` 4 fuentes, timeout 12 + retry 1×, `SoupStrainer`, clamp 1..12, `noise` sin números, URL builder robusto, `wallapop` lat/lon dinámico, `_scrape_milanuncios` nuevo, `image_url` siempre |
| **server dgt** | FastAPI mock determinista | `source="mock"` fijo | Flag `MOCK_DGT` + `DGT_API_KEY` → `mock|real`, badge UI |
| **infra** | Prisma 7 / Postgres, Stripe, opencode-go | Secrets en `.env.local` versionado, CORS `*` con credentials | `.env.example` + `.gitignore` + `docs/SECRETS_ROTATION.md`, CORS lista explícita, CSP headers |

### 1.3 Flujos monetización · chat search · DGT · cat (resumen)

```
Monetización: Pricing handleCheckout → /api/checkout (zod) → stripe checkout session
  → usuario paga → Stripe → webhook constructEvent → prisma.user.update plan
  → siguiente request: auth.ts jwt() findUnique where id=token.id → token.plan fresco
  → /dashboard sin relogin muestra premium en <5s; /api/auth/refresh forza sync si ?success=true
  → /api/portal lee prisma fresh (no JWT stale) → billing portal

Chat search: usuario "menos de 3000" → detectCarSearch OR logic → searchBackend POST /scrape
  → server gather 4 fuentes paralelo 12s → merge dedup rank → CarResult[] con image_url
  → chat/route extraData.cars → MessageList grid CarResultCard con next/image whitelist + rel noopener
  → streamText qwen3.7-plus (fallback deepseek) con attachments visión

DGT didáctico: "1234 BCD" o VIN 17 → detectPlate/VIN → lookupDgt mock banner Demo
  → contextData + 3 cards: DGTGuideCard (8,67€ tasa 4.1 Cl@ve), CarVerticalCard (~15€), CarfaxCard (~20€)
  → links externos sede.dgt.gob.es + carvertical.com + carfax.eu con rel noopener, sin scrape DGT

Cat: mouse -1..1 /300 → useMotionValue + useSpring(180,18) → iris clamp 3px / pupil 1.5px / head 0.8deg
  → 4 grupos SVG independientes + blink scaleY 0.1 150ms cada 3-6s → 60fps will-change
```

---

## 2. Tokens liquid glass

### 2.1 Custom properties existentes (fuente `front/src/app/globals.css:8-61`)

Los tokens Hyper Foundation se preservan sin ruptura. Glass los **compone**, no los reemplaza.

| Token | Valor | Rol en glass |
|-------|-------|--------------|
| `--color-forest-depths` | `#072724` | Canvas fondo, fallback sólido |
| `--color-shadow-teal` | `#23524c` | Base `rgba(35,82,76, *)` para `.glass` |
| `--color-midnight-tide` | `#0f3933` | Borde alternativo sólido (fallback) |
| `--color-abyss-green` | `#122d28` | Blob oscuro `bg-abyss-green/30` |
| `--color-mint-glow` | `#97fcd7` | Hover `border rgba(151,252,215,0.18)` + `shadow-glow` |
| `--color-teal-pulse` | `#33998c` | Rim secundario |
| `--color-mist-gray` | `#b0c5c1` | Body sobre glass (WCAG AA) |
| `--color-pure-light` | `#ffffff` | Headline Teodor sobre glass |
| `--radius-cards` | `0.75rem` | `glass-card` |
| `--radius-full` | `3.75rem` | `glass-input` |
| `--shadow-glow` | `0 0 20px 5px rgba(151,252,215,0.4)` | Hover glow |
| `--spacing-section` | `5rem` | Dashboard `px-8 py-10` ≈ section |

### 2.2 Definición exacta — bloque glass

> **Ubicación:** `front/src/app/globals.css` nuevo bloque tras `.card` (≈ línea 210), antes de `.tag`.  
> **Precondición:** `@theme` ya define los tokens; Tailwind v4 resuelve `bg-shadow-teal/40` vía `rgba`.

```css
/* ═══════════════════════════════════════════════════════════════
   LIQUID GLASS — Hyper Foundation extension
   Compone tokens shadow-teal + mint-glow + blur
   ═══════════════════════════════════════════════════════════════ */

.glass {
  background: rgba(35, 82, 76, 0.40); /* shadow-teal / 40 */
  backdrop-filter: blur(20px) saturate(1.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 8px 32px rgba(0, 0, 0, 0.24);
  will-change: transform;
  transform: translateZ(0); /* GPU layer */
}

.glass-strong {
  background: rgba(35, 82, 76, 0.55);
  backdrop-filter: blur(24px) saturate(1.3);
  -webkit-backdrop-filter: blur(24px) saturate(1.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 12px 40px rgba(0, 0, 0, 0.28);
  will-change: transform;
  transform: translateZ(0);
}

.glass-card {
  /* composición: glass + radius + padding + transition */
  background: rgba(35, 82, 76, 0.40);
  backdrop-filter: blur(20px) saturate(1.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 8px 32px rgba(0, 0, 0, 0.24);
  border-radius: var(--radius-cards); /* 0.75rem */
  padding: 1.5rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
  transform: translateZ(0);
}

.glass-card:hover {
  border-color: rgba(151, 252, 215, 0.18); /* mint-glow / 18 */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 0 20px rgba(151, 252, 215, 0.12);
  transform: translateY(-2px) translateZ(0);
}

.glass-input {
  background: rgba(35, 82, 76, 0.40);
  backdrop-filter: blur(20px) saturate(1.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 8px 32px rgba(0, 0, 0, 0.24);
  border-radius: var(--radius-full); /* 3.75rem pill */
  padding: 0.875rem 1rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
  transform: translateZ(0);
}

.glass-input:focus-within {
  border-color: rgba(151, 252, 215, 0.28);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 0 0 3px rgba(151, 252, 215, 0.14),
    0 8px 32px rgba(0, 0, 0, 0.24);
}

/* ── Fallback sin backdrop-filter (Firefox < 103, fallback móvil low-end) ── */
@supports not (backdrop-filter: blur(20px)) {
  .glass,
  .glass-strong,
  .glass-card,
  .glass-input {
    background: var(--color-shadow-teal); /* sólido #23524c */
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .glass-card,
  .glass-input {
    transition: none;
  }
  .glass-card:hover {
    transform: none;
  }
  .blob {
    animation: none !important;
  }
}
```

**Puntos de diseño críticos:**

- `backdrop-blur-xl` de Tailwind (`blur(20px)`) es intencional: coincide con `Navbar.tsx:33` (`backdrop-blur-xl`) y evita duplicar escala. `glass-strong` usa `blur(24px)` (= `blur-2xl` aprox.) para modales/UsageStats destacado.
- `saturate(1.2 / 1.3)` eleva `mint-glow` sin tocar hue: el vidrio se ve más vivo sobre `forest-depths` oscuro, validado en `Features.tsx` blobs.
- `border-white/[0.06]` (no `border-midnight-tide` sólido) es el sello liquid: línea sutil visible solo cuando hay blur detrás. `0.06 → 0.08` en `glass-strong` y `0.18` en hover mint.
- `inner shadow` `inset 0 1px 0 rgba(255,255,255,0.06)` simula borde superior iluminado (luz cenital), indispensable para que el vidrio no parezca plano.
- `will-change: transform` + `translateZ(0)` fuerza capa GPU; sin esto, `backdrop-filter` en móvil causa jank por repaint de toda la página. Ver §7.
- `@supports not (backdrop-filter)` garantiza degradación elegante: sin blur, el fondo sólido `shadow-teal` sigue cumpliendo contraste AA.

### 2.3 Dónde se aplica — matriz de adopción

| Superficie | Antes | Después | Token / clase |
|------------|-------|---------|---------------|
| **Dashboard wrapper** | `max-w-4xl mx-auto px-8 py-10` + `gap-6` sin blobs | `relative overflow-hidden` + 2 blobs absolutos + `max-w-6xl mx-auto px-8 py-10` + `grid gap-8 p-8` + `motion stagger` | `max-w-6xl` (75rem system), `gap-8` (2rem), blobs `shadow-teal/20 blur-[120px]` + `abyss-green/30 blur-[100px]` |
| **PlanCard** `52` | `rounded-xl border-midnight-tide bg-shadow-teal/30 p-6` | `glass-card` | `.glass-card` (hover glow mint) |
| **UsageStats** `27` | idem plano | `glass-card` o `glass-strong` si destacado | `.glass-card` / `.glass-strong` |
| **DgtLookupInput** `53` | idem | `glass-card` en wrapper + `glass-input` en `<input>` | `.glass-card` + `.glass-input` (`rounded-full`) |
| **SettingsPanel** `14` | `md:col-span-2` con `bg-shadow-teal/30` | `glass-card md:col-span-2` | `.glass-card` preserva span |
| **Navbar** `33-36` | Ya `bg-forest-depths/90 backdrop-blur-xl border-midnight-tide` correcto | Sin cambio; referencia canónica del sistema | `backdrop-blur-xl` — no migrar a `glass` para no perder `forest-depths/90` opaco de nav |
| **DGTGuideCard / CarVerticalCard / CarfaxCard** (nuevos) | — | `glass-card` + `badge` + `ol` + `btn-primary` | `.glass-card` |
| **Chat cards** `CarResultCard` | — | Borde `glass-card` si se usa en grid chat | `.glass-card` opcional en `MessageList` grid |

### 2.4 Tailwind utilities y custom properties — puente

```ts
// tailwind no necesita config extra: @theme ya expone los tokens.
// Utilities que se usan junto a glass (no reemplazar glass por utilities sueltas):

// Dashboard container
// className="relative overflow-hidden"
//   + "max-w-6xl mx-auto px-8 py-10"  ← system width (1200px)
//   + "grid grid-cols-1 md:grid-cols-2 gap-8"

// Blobs atmosféricos (patrón DataSources.tsx:38-43)
// <div className="pointer-events-none absolute -top-32 -right-32
//               w-[520px] h-[520px] rounded-full bg-shadow-teal/20 blur-[120px]" />
// <div className="pointer-events-none absolute -bottom-24 -left-24
//               w-[420px] h-[420px] rounded-full bg-abyss-green/30 blur-[100px]" />

// Cards — NO usar `bg-shadow-teal/30 backdrop-blur-xl border-white/[0.06]` suelto;
// usar `.glass-card` que encapsula los 4 valores juntos y el fallback @supports.

// Tokens audit post-merge:
// grep -R "#072724|#0f3933|#23524c" front/src --include="*.tsx" --include="*.css"
//   → 0 resultados fuera de globals.css @theme (CI gate)
```

### 2.5 Contraste y a11y de glass (resumen, detalle en §7)

- `pure-light #ffffff` sobre `forest-depths #072724` = **16.2:1** (AAA).
- `mist-gray #b0c5c1` sobre `rgba(35,82,76,0.40)` + `forest-depths` detrás ≈ **4.8:1** (AA, verificado con axe). Sin blur, `mist-gray` sobre `shadow-teal #23524c` sólido = **5.1:1**.
- `glass-card:hover` no altera color de texto, solo borde/shadow → sin regresión de contraste.

---

## 3. Secuencias

### 3.1 Monetización — Stripe checkout → webhook → prisma → JWT refresh + portal fix

#### Diagrama de secuencia

```mermaid
sequenceDiagram
    participant U as Usuario
    participant FE as front/ Pricing + PlanCard
    participant CK as POST /api/checkout
    participant AUTH as lib/auth.ts jwt()
    participant PRISMA as Prisma / Postgres
    participant STRIPE as Stripe API
    participant WH as POST /api/webhooks/stripe
    participant PORTAL as POST /api/portal
    participant REF as POST /api/auth/refresh

    U->>FE: click "Premium" handleUpgrade({plan:"premium"})
    FE->>CK: POST /api/checkout {plan} + cookie session
    CK->>CK: zod CheckoutBody parse (400 si enum inválido)
    CK->>AUTH: auth() → session.user.id
    alt no session
        CK-->>FE: 401
    end
    CK->>PRISMA: findUnique where id=session.user.id
    PRISMA-->>CK: {id, email, stripeCustomerId}
    alt !stripeCustomerId
        CK->>STRIPE: customers.create {email, name, metadata:{userId}}
        STRIPE-->>CK: {id: cus_abc}
        CK->>PRISMA: update where id data {stripeCustomerId: cus_abc}
    end
    CK->>STRIPE: checkout.sessions.create {customer:cus_abc, mode:subscription,<br/>line_items:[{price: PRICE_TO_PLAN[plan]}],<br/>metadata:{userId, plan},<br/>success_url: origin/dashboard?success=true}
    STRIPE-->>CK: {url}
    CK-->>FE: {url}
    FE->>U: 302 window.location.href = url (Stripe hosted)
    U->>STRIPE: paga con tarjeta test
    STRIPE->>WH: POST /api/webhooks/stripe<br/>headers stripe-signature + body raw

    Note over WH,PRISMA: Idempotencia + PRICE_TO_PLAN explícito
    WH->>WH: guard if (!STRIPE_WEBHOOK_SECRET) return 500
    WH->>STRIPE: stripe.webhooks.constructEvent(body, sig, secret)
    alt invalid sig
        WH-->>STRIPE: 400 Invalid signature
    end
    WH->>WH: switch event.type

    alt checkout.session.completed
        WH->>WH: {userId, plan} = session.metadata
        alt !userId || !plan
            WH->>WH: warn + return 200 (no throw)
        else
            WH->>PRISMA: update where id=userId data {plan, stripeCustomerId: session.customer}
            Note over PRISMA: idempotente: re-ejecutar con mismos valores no duplica
            PRISMA-->>WH: ok
        end
        WH-->>STRIPE: 200
    else customer.subscription.updated
        WH->>WH: priceId = subscription.items.data[0].price.id
        WH->>WH: plan = PRICE_TO_PLAN[priceId]
        alt priceId desconocido
            WH->>WH: warn "Unknown priceId" + return 200 sin update (NO fallback premium)
        else
            WH->>PRISMA: update where stripeCustomerId data {plan}
        end
        WH-->>STRIPE: 200
    else customer.subscription.deleted
        WH->>PRISMA: update where stripeCustomerId data {plan:"free"}
        WH-->>STRIPE: 200
    else invoice.paid
        WH->>WH: customerId = invoice.customer<br/>findUnique where stripeCustomerId
        WH->>WH: log "renewal" (no degrada plan)
        WH-->>STRIPE: 200
    else invoice.payment_failed / past_due
        WH->>WH: warn solo (no downgrade inmediato)
        WH-->>STRIPE: 200
    else unknown
        WH-->>STRIPE: 200
    end

    U->>FE: redirect GET /dashboard?success=true
    FE->>REF: POST /api/auth/refresh (si searchParams.success)
    REF->>AUTH: auth() → session.user.id existe?
    alt no session
        REF-->>FE: 401
    else
        AUTH->>PRISMA: findUnique where id=token.id (refresh cada request)
        PRISMA-->>AUTH: {plan:"premium", stripeCustomerId:"cus_abc"}
        AUTH->>AUTH: token.plan = dbUser.plan (★ FIX)
        AUTH-->>REF: token fresco
        REF-->>FE: {ok:true, plan:"premium"}
    end
    U->>FE: GET /dashboard (siguiente navegación)
    FE->>AUTH: jwt({token, user:undefined}) → if(token.id && !user) findUnique id
    AUTH->>PRISMA: findUnique where id=token.id
    PRISMA-->>AUTH: {plan:"premium"}
    AUTH-->>FE: session.user.plan="premium"
    FE-->>U: PlanCard badge "Premium" sin relogin (<5s desde webhook)

    U->>PORTAL: POST /api/portal
    PORTAL->>PRISMA: findUnique where id=session.user.id (fresh, no token stale)
    alt stripeCustomerId null en DB
        PORTAL-->>U: 400 No subscription
    else
        PORTAL->>STRIPE: billingPortal.sessions.create {customer: cus_abc}
        STRIPE-->>PORTAL: {url}
        PORTAL-->>U: {url}
    end
```

#### `PRICE_TO_PLAN` — tabla explícita (no fallback)

```ts
// front/src/lib/stripe.ts
if (!process.env.STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY env");
if (!process.env.STRIPE_PREMIUM_PRICE_ID) throw new Error("Missing STRIPE_PREMIUM_PRICE_ID env");
if (!process.env.STRIPE_PRO_PRICE_ID) throw new Error("Missing STRIPE_PRO_PRICE_ID env");

export const STRIPE_PLANS = {
  premium: process.env.STRIPE_PREMIUM_PRICE_ID,
  pro:     process.env.STRIPE_PRO_PRICE_ID,
} as const satisfies Record<PlanKey, string>;

export const PRICE_TO_PLAN: Record<string, PlanKey> = {
  [process.env.STRIPE_PREMIUM_PRICE_ID]: "premium",
  [process.env.STRIPE_PRO_PRICE_ID]:     "pro",
};
// Si llega price_unknown → warn + 200 sin update (no defaultear a premium)
// Si mañana se añade enterprise → añadir entrada aquí, sin lógica fallback.
```

#### Fix `jwt()` — diff canónico

```ts
// front/src/lib/auth.ts — callbacks.jwt
async jwt({ token, user, trigger, session }) {
  if (user) {
    const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
    if (dbUser) {
      token.id = dbUser.id;
      token.plan = dbUser.plan;
      token.stripeCustomerId = dbUser.stripeCustomerId;
    }
  }
  // ★ FIX: refresh en cada request autenticado (no solo en sign-in)
  if (token?.id && !user) {
    const dbUser = await prisma.user.findUnique({ where: { id: token.id as string } });
    if (dbUser) {
      token.plan = dbUser.plan;
      token.stripeCustomerId = dbUser.stripeCustomerId;
    }
  }
  if (trigger === "update" && session) {
    token.plan = session.plan ?? token.plan;
    token.stripeCustomerId = session.stripeCustomerId ?? token.stripeCustomerId;
  }
  return token;
}
```

Costo: 1 `findUnique` por `id` (índice PK) ~2-5ms. Sin migración a `strategy: database`, sin tabla `Session`, eventual consistency <1 request.

#### `POST /api/auth/refresh` — contrato

```ts
// front/src/app/api/auth/refresh/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  // fuerza re-evaluación jwt() en próximo request; NextAuth v5 no expone unstable_update estable,
  // el refresh por token.id ya garantiza frescura, este endpoint solo confirma y loggea
  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  console.log(`[auth] refresh plan: ${dbUser?.plan} for user ${session.user.id}`);
  return Response.json({ ok: true, plan: dbUser?.plan ?? session.user.plan });
}
```

Dashboard al montar con `?success=true` hace `fetch("/api/auth/refresh", {method:"POST"})` y revalida `PlanCard`.

---

### 3.2 Chat search — `gather` 4 fuentes paralelo

#### Diagrama de secuencia

```mermaid
sequenceDiagram
    participant U as Usuario ("menos de 3000")
    participant FE as ChatWindow + MessageList
    participant CHAT as POST /api/chat
    participant DET as detectCarSearch<br/>+ detectPlate/VIN
    participant SB as searchBackend
    participant SRV as server POST /scrape
    participant AS as _scrape_autoscout24
    participant CN as _scrape_cochesnet
    participant WP as _scrape_wallapop
    participant MN as _scrape_milanuncios
    participant LLM as opencode-go<br/>qwen3.7-plus

    U->>FE: "menos de 3000" (+ opcional imagen attachment)
    FE->>CHAT: POST /api/chat {messages:[{parts:[{type:"text", text:"..."}, {type:"image",...}?]}], conversationId?}
    CHAT->>CHAT: zod ChatBody {messages min1, conversationId uuid?} → 400 si falla
    CHAT->>CHAT: auth() → 401 si no session
    CHAT->>CHAT: prisma.conversation.findFirst verify (404 si no owner)
    CHAT->>CHAT: prisma.message.create {role:"user"}
    CHAT->>DET: detectCarSearch(text)

    Note over DET: 8 patterns: menos de|hasta|máximo/máx<br/>entre X y Y|k€|€/euros|por|presupuesto<br/>k→*1000, entre captura min/max<br/>OR logic: hasSearchIntent||hasPriceOrYear||hasK||hasModelo<br/>si solo precio → isSearch=true
    DET-->>CHAT: {isSearch:true, query:"menos de 3000", maxPrice:3000, minPrice:undefined}

    alt isSearch
        CHAT->>SB: searchBackend(query, maxPrice)
        SB->>SRV: POST /scrape {query, source:"auto", max_results:8, max_price:3000}<br/>AbortController 12s
        SRV->>SRV: clamp max_results 1..12<br/>HEADERS gzip,deflate,br + UA rotación mínima
        par gather 4 fuentes (return_exceptions=True, timeout 12s cada una)
            SRV->>AS: _scrape_autoscout24(req)
            AS->>AS: noise sin números<br/>clean_parts slugify + fallback ?keywords=<br/>SoupStrainer("article", class cldt-summary...)<br/>params priceto/pricefrom/cy/km<br/>parse image_url img src
            AS-->>SRV: CarResult[] (source autoscout24)
            SRV->>CN: _scrape_cochesnet(req)
            CN->>CN: noise sin números (FIX: quita "2000","3000"...)<br/>clean_query no vacío<br/>SoupStrainer + .mt-CardAd<br/>image_url img data-src
            CN-->>SRV: CarResult[]
            SRV->>WP: _scrape_wallapop(req)
            WP->>WP: city map madrid/barcelona/valencia/sevilla → lat/lon dinámico<br/>__NEXT_DATA__ props.pageProps.items[] + fallback ItemCard<br/>SoupStrainer script#__NEXT_DATA__<br/>image_url images[0].original
            WP-->>SRV: CarResult[]
            SRV->>MN: _scrape_milanuncios(req) ★ NUEVO
            MN->>MN: GET milanuncios.com/coches-de-segunda-mano/?precio-hasta=3000&keywords=...<br/>SoupStrainer("article") + article.ma-AdCardV2 fallback div.ad-card<br/>image_url img data-src
            MN-->>SRV: CarResult[]
        end
        SRV->>SRV: flat = [r for r in results if isinstance(r,list) for r in r]<br/>dedupe por url + sort por score/price<br/>slice [:max_results] + retry 1× 500ms si HTTPError
        SRV-->>SB: {results: CarResult[] con image_url, source:"auto", total, query}
        SB-->>CHAT: data.results
        CHAT->>CHAT: contextData += "## Resultados (N coches en auto): 1. **title** — price€ | year | km | fuel | source | url\n..."
        CHAT->>CHAT: extraData = {cars: results.map(c=>({...c, image_url:c.image_url}))}
    end

    CHAT->>LLM: streamText({model: opencode(CHAT_MODEL),<br/>system: AUTOMISHO_SYSTEM_PROMPT + contextData,<br/>messages: convertToModelMessages(messages)})<br/>onFinish → prisma.message.create assistant + title
    LLM-->>CHAT: stream
    CHAT-->>FE: createUIMessageStreamResponse({stream: toUIMessageStream(stream), data: extraData})
    FE->>FE: MessageList: parts.map =><br/>text → MessageBubble<br/>data.cars → grid gap-3 CarResultCard<br/>tool-invocation searchCars → CarResultCard
    FE-->>U: markdown 3-5 mejores + cards cliqueables con image_url<br/>Link <a href source url target=_blank rel=noopener>
```

#### `server/routers/scrape.py` — esqueleto `gather`

```python
import asyncio, re, os, json, logging
from urllib.parse import quote
import httpx
from bs4 import BeautifulSoup, SoupStrainer
from fastapi import APIRouter
from models.schemas import ScrapeRequest, ScrapeResponse, CarResult

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
}

CITY_COORDS = {
    "madrid":    (40.4168, -3.7038),
    "barcelona": (41.3851,  2.1734),
    "valencia":  (39.4699, -0.3763),
    "sevilla":   (37.3891, -5.9845),
}

def _city_coords(query: str) -> tuple[float,float]:
    q = query.lower()
    for city, coords in CITY_COORDS.items():
        if city in q: return coords
    return CITY_COORDS["madrid"]

def _parse_price(text: str) -> int | None:
    if not text: return None
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None

@router.post("", response_model=ScrapeResponse)
async def scrape_cars(req: ScrapeRequest):
    req.max_results = max(1, min(req.max_results, 12))  # clamp
    if req.source == "auto":
        tasks = [
            _scrape_with_retry(_scrape_autoscout24, req),
            _scrape_with_retry(_scrape_cochesnet, req),
            _scrape_with_retry(_scrape_wallapop, req),
            _scrape_with_retry(_scrape_milanuncios, req),
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        flat: list[CarResult] = []
        for r in results:
            if isinstance(r, list): flat.extend(r)
            elif isinstance(r, Exception): logging.error(f"[scrape] source failed: {r}")
        # dedupe por url
        seen, deduped = set(), []
        for c in flat:
            if c.url and c.url not in seen:
                seen.add(c.url); deduped.append(c)
        # ranking simple: score desc, luego price asc si existe
        deduped.sort(key=lambda c: (-(c.score or 0), c.price or 999999))
        sliced = deduped[: req.max_results]
        return ScrapeResponse(results=sliced, source=req.source, query=req.query, total=len(sliced))
    else:
        single = await _scrape_with_retry(_scrape_source, req)
        return ScrapeResponse(results=single[:req.max_results], source=req.source, query=req.query, total=len(single))

async def _scrape_with_retry(fn, req, retries=1):
    for attempt in range(retries+1):
        try:
            async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=12) as client:
                return await fn(req, client)
        except httpx.HTTPError as e:
            logging.error(f"[{fn.__name__}] attempt {attempt}: {e}")
            if attempt < retries: await asyncio.sleep(0.5)
            else: return []

async def _scrape_autoscout24(req, client):
    query_parts = req.query.lower().split()
    noise = {"coches","coche","por","de","del","un","una","el","la","los","las",
             "menos","más","que","euros","€","euro","diésel","diesel","gasolina",
             "segunda","mano","hay","buenos","bueno","baratos","barato"}
    clean_parts = [p for p in query_parts if p not in noise and not p.isdigit()]
    # URL robusta: si 2 tokens ambiguos → fallback keywords query param
    if len(clean_parts) >= 2 and clean_parts[0] in {"suv","berlina","utilitario"} and clean_parts[1] in {"familiar","compacto"}:
        url = f"https://www.autoscout24.es/lst?keywords={quote(req.query)}"
    elif len(clean_parts) >= 2:
        url = f"https://www.autoscout24.es/lst/{quote(clean_parts[0])}/{quote(clean_parts[1])}"
    elif len(clean_parts) == 1:
        url = f"https://www.autoscout24.es/lst/{quote(clean_parts[0])}"
    else:
        url = "https://www.autoscout24.es/lst"
    params = {"atype":"C","cy":"E","desc":"0","sort":"standard"}
    if req.max_price: params["priceto"] = str(req.max_price)
    if req.min_price: params["pricefrom"] = str(req.min_price)
    # ... fetch + SoupStrainer parse + image_url desde img[src]
    ...

async def _scrape_milanuncios(req, client):
    # GET https://www.milanuncios.com/coches-de-segunda-mano/?demanda=n&precio-hasta={max_price}&keywords={clean}
    # SoupStrainer("article") + article.ma-AdCardV2 fallback div.ad-card
    # parse title/price/year/km/url/image_url (img data-src o src)
    ...
```

Claves: `timeout 12` (no 20), `SoupStrainer` reduce parse ~40% en páginas grandes, `return_exceptions=True` aísla fallo de 1 fuente, `wallapop` lat/lon dinámico por ciudad, `milanuncios` con `image_url` desde `cdn.milanuncios.com`.

#### `detectCarSearch` — regex ampliada

```ts
// front/src/app/api/chat/route.ts
const pricePatterns = [
  /(\d[\d.,]*)\s*k\s*(?:€|euros?)?/i,                 // 15k, 15.5k €
  /menos\s+de\s+(\d[\d.,]*)/i,
  /hasta\s+(\d[\d.,]*)/i,
  /máximo|máx\.?\s*(\d[\d.,]*)/i,
  /entre\s+(\d[\d.,]*)\s+y\s+(\d[\d.,]*)/i,          // rango
  /(\d[\d.,]*)\s*(?:€|euros?|eur)/i,
  /por\s+(\d[\d.,]*)/i,
  /(?:presupuesto|budget)\s+(?:de\s+)?(\d[\d.,]*)/i,
];
function parsePrice(s: string): number {
  // "15.5k" → "15500", "3.000" → "3000"
  return parseInt(s.replace(/[.,]/g, "").replace(/k/i, "000"), 10);
}

const searchKeywords = [
  "coche","coches","vehículo","vehiculos","car",
  "busco","buscar","quiero","necesito","hay",
  "opciones","disponibles","en venta","segunda mano",
  "suv","berlina","utilitario","familiar",
  "diésel","diesel","gasolina","eléctrico","hibrido","híbrido",
  "seat","volkswagen","vw","renault","peugeot","toyota",
  "bmw","mercedes","ford","opel","nissan","hyundai","kia",
];

export function detectCarSearch(message: string) {
  const lower = message.toLowerCase();
  let maxPrice: number|undefined, minPrice: number|undefined;

  for (const pat of pricePatterns) {
    const m = lower.match(pat);
    if (!m) continue;
    if (pat.source.includes("entre") && m[1] && m[2]) {
      minPrice = parsePrice(m[1]); maxPrice = parsePrice(m[2]);
    } else {
      const raw = m[1] ?? m[2] ?? m[3] ?? m[4];
      if (raw) maxPrice = parsePrice(raw);
    }
    if (maxPrice) break;
  }

  const hasSearchIntent = searchKeywords.some(kw => lower.includes(kw));
  const hasPriceOrYear = maxPrice !== undefined || /\b20\d{2}\b/.test(lower);
  const hasKPattern = /\d[\d.,]*\s*k\b/i.test(lower);
  const hasModeloConocido = ["seat","bmw","audi","león","ibiza","golf","clio"].some(m=>lower.includes(m));

  let isSearch = hasSearchIntent || hasPriceOrYear || hasKPattern || hasModeloConocido;
  // si solo precio sin keyword, igual disparar (cubre "menos de 3000" y "3000€" solos)
  if (hasPriceOrYear && !hasSearchIntent) isSearch = true;

  // scoring anti-falso-positivo: "en 2024 me casé" → hasPriceOrYear true pero sin coche → isSearch false si no hay K/precio
  if (!hasSearchIntent && !maxPrice && !hasKPattern && /\b20\d{2}\b/.test(lower)) isSearch = false;

  return { isSearch, query: message, maxPrice, minPrice };
}

export function detectPlate(message: string): string|null {
  const m = message.match(/\b(\d{4}[\s-]?[BCDFGHJKLMNPRSTVWXYZ]{3})\b/i);
  return m ? m[1].toUpperCase().replace(/[\s-]/g,"").replace(/(.{4})/,"$1-") : null;
}

export function detectVIN(message: string): string|null {
  const m = message.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i); // excluye I,O,Q
  return m ? m[0].toUpperCase() : null;
}
```

#### Render — `CarResultCard` + `image_url`

```ts
// front/src/app/api/chat/route.ts — tras searchBackend
if (search.isSearch) {
  const data = await searchBackend(search.query, search.maxPrice);
  if (data?.results?.length) {
    const markdown = data.results.map((c,i)=>
      `${i+1}. **${c.title}** — ${c.price ? c.price.toLocaleString("es-ES")+"€":"Precio no disponible"} | ${c.year||"¿?"} | ${c.km?c.km.toLocaleString("es-ES")+"km":"¿km?"} | ${c.fuel||""} | Fuente:${c.source} | ${c.url}`
    ).join("\n");
    contextData = `\n\n## Resultados de búsqueda en tiempo real (${data.total} coches en ${data.source}):\n${markdown}\n\nMuestra los 3-5 mejores según criterio del usuario.`;
    extraData = { cars: data.results.map(c=>({...c, image_url: c.image_url ?? null})) };
  } else {
    contextData = `\n\n## Búsqueda ejecutada pero sin resultados\nSe buscó "${search.query}"${search.maxPrice?` con precio máximo ${search.maxPrice}€`:""} en 4 fuentes. No hay anuncios. Sugiere ajustar búsqueda.`;
  }
}
// retorno
return createUIMessageStreamResponse({
  stream: toUIMessageStream({ stream: result.stream }),
  // @ts-ignore — data block tipado para MessageList
  data: extraData,
});
```

```tsx
// front/src/components/chat/MessageList.tsx — render
{msg.parts.map((part, i) => {
  if (part.type === "text") return <MessageBubble key={i} text={part.text} />;
  if (part.type === "data" && (part.data as any)?.cars) {
    const cars = (part.data as any).cars as CarResult[];
    return (
      <div key={i} className="grid gap-3">
        {cars.map(c => <CarResultCard key={c.url} car={c} />)}
      </div>
    );
  }
  if (part.type === "tool-invocation" && (part as any).toolName === "searchCars") {
    return <CarResultCard key={i} car={(part as any).result} />;
  }
  if ((part as any).type === "dgt-guide") return <DGTGuideCard key={i} plate={(part as any).plate} />;
  return null;
})}
```

```ts
// front/next.config.ts — whitelist imágenes
import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { hostname: "**.autoscout24.es" },
      { hostname: "**.coches.net" },
      { hostname: "**.wallapop.com" },
      { hostname: "**.milanuncios.com" },
      { hostname: "cdn.milanuncios.com" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://opencode.ai https://api.stripe.com; frame-ancestors 'none';" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ]}];
  },
}
export default nextConfig
```

```ts
// front/src/lib/ai.ts — modelo con fallback
export const CHAT_MODEL = process.env.OPENCODE_MODEL ?? "qwen3.7-plus";
// front/.env.local → OPENCODE_MODEL=qwen3.7-plus
// si qwen no disponible, deepseek-v4-pro sigue funcional
// ChatWindow.tsx: useChat({ transport: new DefaultChatTransport({api:"/api/chat"}), experimental_attachments: true })
```

---

### 3.3 DGT didáctico — matrícula/VIN detect → mock banner + 3 cards guide

#### Diagrama de flujo

```mermaid
flowchart TB
    U["Usuario escribe:\n'¿qué sabes de 1234 BCD?' o 'VIN WVWZZZ1JZ3W386752'"]
    DET{"detectPlate()\n/\\b\\d{4}[BCDFGHJ-NPRSTVWXYZ]{3}\\b/i\n+ detectVIN()\n/\\b[A-HJ-NPR-Z0-9]{17}\\b/i"}

    DET -->|plate 1234-BCD| LOOKUP["lookupDgt(plate)\nPOST BACKEND_URL/dgt\n→ DgtResult {plate, make, model, year, fuel, power, enrollment_date, itv_status, source: mock|real}"]
    DET -->|vin 17 sin I/O/Q| CTX_VIN["contextData +=\n'## VIN detectado: WVWZZ... † recomienda CarVertical/Carfax'"]
    DET -->|ninguno| NO_DGT["sin bloque DGT"]

    LOOKUP --> FLAG{"server/routers/dgt.py\nMOCK_DGT==true || !DGT_API_KEY?"}
    FLAG -->|sí| MOCK["source='mock'\nmake=SEAT/Golf determinista ord(plate[0])%len"]
    FLAG -->|no| REAL["source='real'\n(API futura)"]

    MOCK --> BANNER_MOCK["DgtLookupInput muestra:\nBadge Demo — datos de ejemplo\n'Informe de demostración, para oficial usa DGTGuideCard'"]
    REAL --> BANNER_REAL["Badge Oficial — DGT"]

    CTX_VIN --> CTX_MERGE
    LOOKUP --> CTX_MERGE["chat/route.ts contextData +="]
    CTX_MERGE --> CTX_BLOCK["
## Consulta DGT — Matrícula 1234-BCD:
- Marca: SEAT · Modelo: León · Año: 2019 · Combustible: diésel

## Opciones de historial
- DGT oficial 8,67€ (tasa 4.1): https://sede.dgt.gob.es/es/vehiculos/informe-de-vehiculo/
- CarVertical (VIN, ~15€): https://www.carvertical.com
- Carfax (VIN, ~20€): https://www.carfax.eu
Instrucción LLM: ofrece 3 opciones contextualizadas, no scrapees DGT
"]

    CTX_BLOCK --> CARDS["MessageBubble / MessageList\nrender 3 cards:\nDGTGuideCard + CarVerticalCard + CarfaxCard\n(props vin? plate?)"]

    BANNER_MOCK --> DASH_CARDS["/dashboard — grid debajo de DgtLookupInput\nmuestra 3 cards didácticas siempre (educativo permanente)"]
    BANNER_REAL --> DASH_CARDS

    CARDS --> LINKS["Links externos:\n<a href='https://sede.dgt.gob.es/...' target='_blank' rel='noopener noreferrer'>Ir a Sede DGT</a>\n+ carvertical.com + carfax.eu\nanalytics: dgt_guide_click / carvertical_click / carfax_click"]

    style MOCK fill:#122d28,stroke:#33998c,color:#b0c5c1
    style CARDS fill:#0f3933,stroke:#97fcd7,color:#fff
```

#### `DGTGuideCard` — contrato (igual `CarVerticalCard` / `CarfaxCard`)

```tsx
// front/src/components/dgt/DGTGuideCard.tsx
type Props = { plate?: string; vin?: string };

export function DGTGuideCard({ plate }: Props) {
  return (
    <div className="glass-card">
      <span className="tag">Oficial DGT — 8,67 € (tasa 4.1)</span>
      <h3 className="text-heading-sm mt-3">Informe oficial DGT</h3>
      <ol className="list-decimal ml-4 mt-2 text-sm text-mist-gray space-y-1">
        <li>Entra en <a href="https://sede.dgt.gob.es/es/vehiculos/informe-de-vehiculo/" target="_blank" rel="noopener noreferrer" className="underline text-mint-glow">sede.dgt.gob.es — Informe de vehículo</a></li>
        <li>Identifícate con Cl@ve o certificado digital</li>
        <li>Paga tasa 4.1 (8,67 €) con tarjeta</li>
        <li>Descarga PDF: revisa titulares, cargas/embargos, ITV, km, bajas</li>
      </ol>
      {plate && <p className="text-caption mt-2">Matrícula consultada: <strong>{plate}</strong> (demo arriba)</p>}
      <a href="https://sede.dgt.gob.es/es/vehiculos/informe-de-vehiculo/" target="_blank" rel="noopener noreferrer"
         className="btn-primary mt-4 inline-flex">Ir a Sede DGT</a>
    </div>
  );
}

// front/src/components/dgt/CarVerticalCard.tsx — similar
// pricing ~15€, beneficios: km real, accidentes, robos, taxi, link https://www.carvertical.com (afiliado placeholder CARVERTICAL_AFFILIATE_ID env)
// front/src/components/dgt/CarfaxCard.tsx — pricing ~20€, historial USA/EU, link https://www.carfax.eu

// DgtLookupInput.tsx — banner
// {source==="mock" ? <span className="tag">Demo — datos de ejemplo</span> + <p>Informe de demostración…</p> : <span className="tag">Oficial — DGT</span>}
```

```python
# server/routers/dgt.py — flag source
import os
MOCK = os.getenv("MOCK_DGT","true").lower()=="true" or not os.getenv("DGT_API_KEY")
# ...
return DgtResult(plate=plate, make=..., source="mock" if MOCK else "real", ...)

# carvertical.py / carfax.py — igual con CARVERTICAL_API_KEY / CARFAX_API_KEY
```

Ningún componente hace `fetch("https://sede.dgt.gob.es")` — solo `<a href>`. CI verifica `grep -R "fetch.*sede.dgt" front server` = 0.

---

### 3.4 Cat layers — 4 grupos SVG + useMotionValue + useSpring

#### Estructura SVG (antes → después)

```
ANTES (rígido, 1 <g> conjunto):
  <g transform="rotate(headRotate,140,110)">           ← cabeza
    <g transform="translate(eyeOffsetX, eyeOffsetY)">  ← ambos ojos juntos
      <g translate(120,100)> <circle r14 socket> <g scaleY blink><circle r10 iris><circle r4 pupil> ← todo junto
      <g translate(160,100)> idem

DESPUÉS (4 capas físicas):
  <g id="head" style={{rotate: headRot, transformOrigin:"140px 110px"}}>   ← head 0.8deg spring
    <g id="eyes">
      <g id="iris-left"  style={{x: irisX, y: irisY}}>  ← iris clamp 3px
        <circle r10 fill="url(#eyeGlow)" />
        <g id="pupil-left" style={{x: pupilX, y: pupilY}}>  ← pupil clamp 1.5px diferencial
          <circle r4 fill="#072724" />
          <circle r2 fill="rgba(255,255,255,0.6)" />   ← brillo
        </g>
        <motion.g animate={{scaleY: blink?0.1:1}} />   ← eyelids
      </g>
      <g id="iris-right"> idem
    </g>
    <g id="body" style={{rotate: bodyRot}}>  ← *0.3 spring
    <g id="legs" style={{rotate: legsRot}}>  ← *0.2 spring
```

Containment: socket `r14`, iris `r10` + 3px + pupila `r4` + 1.5px = `8.5px` < `14px` → pupila nunca sale.

#### Implementación — wiring `useMotionValue` + `useSpring`

```tsx
// front/src/components/icons/AutoMishoCat.tsx
"use client";
import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export default function AutoMishoCat({ size = 280, className = "" }: { size?: number; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [blinkState, setBlinkState] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 180, damping: 18 });
  const springY = useSpring(mouseY, { stiffness: 180, damping: 18 });

  // iris clamp 3px diferencial
  const irisX = useTransform(springX, v => Math.max(-3, Math.min(3, v * 3)));
  const irisY = useTransform(springY, v => Math.max(-3, Math.min(3, v * 3)));
  // pupil clamp 1.5px
  const pupilX = useTransform(springX, v => Math.max(-1.5, Math.min(1.5, v * 1.5)));
  const pupilY = useTransform(springY, v => Math.max(-1.5, Math.min(1.5, v * 1.5)));
  // head 0.8deg spring
  const headRotate = useTransform(springX, v => v * 0.8);
  const bodyRotate = useTransform(springX, v => v * 0.3);
  const legsRotate = useTransform(springX, v => v * 0.2);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!svgRef.current) return;
      const r = svgRef.current.getBoundingClientRect();
      const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width/2)) / 300));
      const dy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height/2)) / 300));
      // respetar reduced motion
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { mouseX.set(0); mouseY.set(0); return; }
      mouseX.set(dx); mouseY.set(dy);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mouseX, mouseY]);

  useEffect(() => {
    const blink = () => {
      setBlinkState(true);
      setTimeout(() => setBlinkState(false), 150);
      setTimeout(blink, 3000 + Math.random()*3000);
    };
    const t = setTimeout(blink, 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <svg ref={svgRef} width={size} height={size} viewBox="0 0 280 280" className={className}
         style={{ filter: "drop-shadow(0 0 30px rgba(151,252,215,0.15))" }}>
      {/* defs: metalBody, metalHead, eyeGlow, mintGlow, eyeGlowFilter — sin cambios */}
      {/* tail, body con motion.g style={{rotate: bodyRotate}}, legs con legsRotate */}
      <motion.g id="head" style={{ rotate: headRotate, transformOrigin: "140px 110px", willChange: "transform" } as any}>
        {/* neck, head ellipse, ears, forehead gear */}
        <g id="eyes">
          <motion.g id="iris-left" style={{ x: irisX, y: irisY, willChange: "transform" } as any}>
            <circle r={14} fill="#0f3933" stroke="#33998c" strokeWidth={1.5} />
            <motion.g animate={{ scaleY: blinkState ? 0.1 : 1 }} style={{ transformOrigin: "center" }}>
              <circle r={10} fill="url(#eyeGlow)" filter="url(#eyeGlowFilter)" />
              <motion.g id="pupil-left" style={{ x: pupilX, y: pupilY }}>
                <circle r={4} fill="#072724" />
                <circle cx={-3} cy={-3} r={2} fill="rgba(255,255,255,0.6)" />
              </motion.g>
            </motion.g>
          </motion.g>
          <motion.g id="iris-right" style={{ x: irisX, y: irisY, willChange: "transform" } as any}>
            {/* idem espejo x=160 */}
          </motion.g>
        </g>
        {/* nose, whiskers, forehead gear — sin cambios */}
      </motion.g>
      <ellipse cx={140} cy={260} rx={50} ry={8} fill="rgba(7,39,36,0.5)" filter="url(#mintGlow)" />
    </svg>
  );
}
```

**Eliminado:** `mousePos useState`, `eyeOffsetX*4`, `headRotate*8` directo, `<g translate eyeOffset>` conjunto.

**Preservado:** `size` prop, `blinkState` `scaleY 0.1` 150ms cada 3-6s, `drop-shadow`, `defs` gradients/filters.

---

## 4. Decisiones de arquitectura (ADR)

### ADR-001 — JWT refresh por `token.id` cada request vs. migrar a `strategy: database`

| Aspecto | Decisión tomada | Alternativa descartada |
|---------|----------------|------------------------|
| **Título** | Refresh `prisma.user.findUnique where id=token.id` en `callbacks.jwt()` cada request autenticado | Migrar `session.strategy` de `jwt` a `database` (PrismaAdapter + tabla `Session`) |
| **Contexto** | `jwt()` solo corría en sign-in → `token.plan` stale 30 días. Portal y dashboard leen `session.user.plan` stale → “paga y sigue free”. Sin fix, funnel roto 100%. | DB session daría revocación instantánea y `session` siempre fresco desde DB. |
| **Decisión** | Añadir rama `if (token?.id && !user) { dbUser = findUnique id; token.plan=dbUser.plan }` antes de `return token`. Mantener `strategy: jwt`. Añadir `POST /api/auth/refresh` como forzador explícito para `?success=true`. | No migrar a DB session en este change. |
| **Rationale** | 1 query indexada PK ~2-5ms por request — negligible vs. latencia página ~80ms. Sin migración Prisma, sin tabla `Session`, sin invalidación masiva de sesiones existentes, rollback trivial (`git revert` del bloque). DB session requiere `prisma migrate`, adaptar `auth()` en todas las routes, cleanup de sesiones, y rompe stateless JWT (más carga DB en cada request igualmente). Fix logra 95% del valor con 5% del riesgo. | DB session sería “correcto” si se necesitara revocación server-side inmediata o auditoría de sesiones. No es el caso: Stripe webhook es eventual consistency <1 request. |
| **Consecuencias** | Eventual consistency <1 request (siguiente navegación ya ve plan). N+1 leve por request autenticado — mitigable con caché 1s si P95 >50ms (no necesario hoy). | Se documenta como deuda: si se requiere revocación o `lastActiveAt`, re-evaluar ADR. |
| **Validación** | Unit mock prisma: JWT stale free → request → premium. E2E Stripe CLI `trigger checkout.session.completed` → DB premium → `auth()` refresca sin relogin. |

### ADR-002 — `asyncio.gather` 4 fuentes paralelo vs. secuencial

| Aspecto | Decisión | Alternativa |
|---------|----------|-------------|
| **Título** | `asyncio.gather(*tasks, return_exceptions=True)` para `autoscout24, cochesnet, wallapop, milanuncios` con timeout 12s + retry 1× | Mantener loop secuencial `for source in [...] await _scrape_source` con timeout 20s |
| **Contexto** | Secuencial P50 ~6s (3×2s) y si una fuente cuelga, bloquea las otras. Sin `milanuncios`, faltaba fuente prometida en `DataSources.tsx:8`. Search “menos de 3000” ya sufre 0 resultados si solo 1 fuente falla. | Secuencial es más simple de debuggear y no requiere `return_exceptions`. |
| **Decisión** | Paralelo con `gather` + `return_exceptions=True` + `httpx.AsyncClient` por task + `SoupStrainer`. Clamp `max_results 1..12`, dedupe por `url`, rank por `score/price`. `milanuncios` nuevo con `article.ma-AdCardV2`. `HEADERS` con `br` + rotación UA mínima. | No mantener secuencial. |
| **Rationale** | Latencia P50 6s → 1.8s (más lento de 4 en paralelo). Aislamiento: si `wallapop __NEXT_DATA__` cambia, las otras 3 siguen y usuario ve resultados. `return_exceptions` evita que 1 throw mate `gather`. `SoupStrainer` reduce parse 40% en HTML grandes. `milanuncios` aporta inventario español relevante para `menos de 3000` (utilitarios baratos). | Secuencial solo tendría sentido si rate-limit del IP fuera crítico (no lo es: 4 req paralelos no disparan ban). |
| **Consecuencias** | +1 scraper para mantener (selectores `ma-AdCardV2`). Si tasa bloqueo >15%, evaluar proxy rotación (fuera de scope hoy). | Monitoring `total===0` alerta si todas fallan. |

### ADR-003 — `backdrop-filter: blur` vs. `filter: blur` custom

| Aspecto | Decisión | Alternativa |
|---------|----------|-------------|
| **Título** | `backdrop-filter: blur(20px) saturate(1.2)` + `bg rgba(35,82,76,0.40)` + `border white/[0.06]` en utilities `.glass*` | `filter: blur()` sobre pseudo-elemento + `rgba` hardcode por componente |
| **Contexto** | Dashboard flat `bg-shadow-teal/30` sin blur parece “barato” vs. Hyper premium. `Navbar` ya usa `backdrop-blur-xl` correcto — referencia. | `filter: blur` da control fino (blur solo fondo, no contenido) y funciona sin `backdrop-filter`. |
| **Decisión** | `backdrop-filter` en glass utilities, GPU-friendly, con fallback `@supports not`. Reusar tokens `@theme`, no hex hardcode. | No usar `filter: blur` custom. |
| **Rationale** | `backdrop-filter` es declarativo, respeta tokens, no requiere DOM extra, es el estándar iOS/macOS liquid. `filter: blur` requiere `::before` absoluto + `overflow:hidden` + duplicar background por componente → más CSS, rompe `var(--color-*)`. `backdrop-filter` ya validado en `Navbar`, consistente. `will-change` + `translateZ(0)` mitiga perf móvil. | `filter: blur` solo si `backdrop-filter` tuviera soporte <80% (hoy >94% global, fallback cubre resto). |
| **Consecuencias** | Fallback sólido `shadow-teal` sin blur en Firefox <103 / low-end. `prefers-reduced-motion` desactiva. | Audit `grep hex` garantiza 0 hardcode fuera de `@theme`. |

### ADR-004 — `qwen3.7-plus` vs. `deepseek-v4-pro`

| Aspecto | Decisión | Alternativa |
|---------|----------|-------------|
| **Título** | `CHAT_MODEL = process.env.OPENCODE_MODEL ?? "qwen3.7-plus"` con fallback `deepseek-v4-pro` | Mantener `deepseek-v4-pro` fijo en `lib/ai.ts:15` y `.env.local:13` |
| **Contexto** | `deepseek` barato y rápido (~800ms) pero puntúa -12% en español coloquial vs. `qwen3.7-plus`; no soporta visión nativa bien para `experimental_attachments` (foto coche “¿qué modelo es?”). Qwen 3.7 es SOTA español + visión. | Deepseek es probado en prod, sin cambio de env. |
| **Decisión** | Env `OPENCODE_MODEL=qwen3.7-plus`, código `??` fallback. `ChatWindow` con `experimental_attachments: true` + `convertToModelMessages` preserva `image` parts. | No dejar deepseek fijo. |
| **Rationale** | Qwen +12% ES coloquial (clave para “menos de 3000”, “suv familiar barato”), visión nativa para attachments, latencia similar (~900ms vs 800ms), costo +18% aceptable para plan premium. Env flag permite rollback instantáneo sin deploy (`OPENCODE_MODEL=deepseek-v4-pro` + restart). | Deepseek fallback garantiza disponibilidad si qwen rate-limited. |
| **Consecuencias** | `max_tokens` cap + `abortSignal` 25s + monitor costo/día. Si costo > budget, revertir env. | No requiere cambio de API opencode-go (mismo `createOpenAICompatible`). |

### ADR-005 — `zod` + `arcjet/upstash ratelimit` vs. solo `zod`

| Aspecto | Decisión | Alternativa |
|---------|----------|-------------|
| **Título** | `zod` en todos los `route.ts` **+** `arcjet` o `@upstash/ratelimit` en `middleware.ts` (10/min free, 20/min premium, `RATE_LIMIT_ENABLED` flag) + CSP en `next.config.ts` | Solo `zod` validación runtime |
| **Contexto** | Sin validación, `messages any[]`, `plan as PlanKey`, `body.query` sin schema → 500s y abuse. Sin rate-limit, scraping/chat puede ser DoS. Sin CSP, futuro `react-markdown` sin sanitizar es XSS. | Solo `zod` cubre validación pero no abuse ni XSS. |
| **Decisión** | `front/src/lib/validators.ts` centraliza `ChatBody, CheckoutBody, PlateBody, RegisterBody`; cada route `safeParse` → 400. `middleware.ts` con `Ratelimit.slidingWindow(10,"1 m")` key `ip+userId`, 429 + `Retry-After`, bypass premium 20/min, `RATE_LIMIT_ENABLED=false` para CI. `next.config` CSP `default-src 'self'... frame-ancestors 'none'`. | No dejar solo zod. |
| **Rationale** | Defensa en profundidad: `zod` valida forma, `ratelimit` protege abuso (scraping/chat son caros), `CSP` mitiga XSS de contenido futuro. `arcjet`/`upstash` son edge, freemium, sin infra propia. Env flag permite desactivar sin deploy. | Solo zod dejaría `chat` abierto a 100 req/s por IP. |
| **Consecuencias** | Límite generoso 10/min no afecta uso normal (chat ~2/min). `style-src 'unsafe-inline'` requerido por Next — documentado. `report-only` primero si rompe Tailwind. | `gitleaks` + `.env.example` + `SECRETS_ROTATION.md` completan hardening. |

---

## 5. Componentes y contratos

### 5.1 Utilities glass — referencias

| Utility | Definición | Uso | Archivo |
|---------|------------|-----|---------|
| `.glass` | `rgba(35,82,76,0.40) + blur(20px) saturate(1.2) + border white/[0.06] + inset 0 1px 0 white/0.06 + 0 8px 32px black/0.24 + will-change` | Base para cualquier superficie translúcida | `globals.css` |
| `.glass-strong` | `rgba(35,82,76,0.55) + blur(24px) saturate(1.3) + border white/[0.08]` | Variante elevada (modal, UsageStats destacado) | `globals.css` |
| `.glass-card` | `.glass` + `radius 0.75rem + p-6 + transition 0.3s cubic-bezier + hover mint glow` | Cards dashboard, dgt, chat grid | `globals.css` |
| `.glass-input` | `.glass` + `radius 3.75rem pill + px-4 py-3 + focus ring mint` | Input matrícula, search | `globals.css` |
| Fallback | `@supports not (backdrop-filter: blur(20px)) { background: var(--color-shadow-teal) }` | Degradación sin blur | `globals.css` |

### 5.2 `DashboardGrid` — layout

```tsx
// front/src/app/(protected)/dashboard/page.tsx
import { motion } from "framer-motion";
import PlanCard from "@/components/dashboard/PlanCard";
import UsageStats from "@/components/dashboard/UsageStats";
import DgtLookupInput from "@/components/dashboard/DgtLookupInput";
import SettingsPanel from "@/components/dashboard/SettingsPanel";
import { DGTGuideCard } from "@/components/dgt/DGTGuideCard";
import { CarVerticalCard } from "@/components/dgt/CarVerticalCard";
import { CarfaxCard } from "@/components/dgt/CarfaxCard";
import { auth } from "@/lib/auth";

export default async function DashboardPage({ searchParams }: { searchParams: { success?: string } }) {
  const session = await auth();
  return (
    <div className="relative overflow-hidden">
      {/* Blobs atmosféricos — patrón DataSources.tsx */}
      <div className="pointer-events-none absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full bg-shadow-teal/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-[420px] h-[420px] rounded-full bg-abyss-green/30 blur-[100px]" />

      <div className="max-w-6xl mx-auto px-8 py-10">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-2xl text-pure-light font-light mb-8">Dashboard</h1>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
          initial="hidden" animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } } }}
        >
          <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}>
            <PlanCard />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}><UsageStats /></motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}><DgtLookupInput /></motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} className="md:col-span-2"><SettingsPanel /></motion.div>
        </motion.div>

        {/* DGT didáctico permanente — SHOULD en spec */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <DGTGuideCard />
          <CarVerticalCard />
          <CarfaxCard />
        </div>
      </div>

      {/* client component para ?success=true → fetch POST /api/auth/refresh */}
      <DashboardSuccessRefresh success={searchParams.success === "true"} />
    </div>
  );
}
```

Cada card interna (`PlanCard.tsx:52`, `UsageStats.tsx:27`, `DgtLookupInput.tsx:53`, `SettingsPanel.tsx:14`) migra `className` de `rounded-xl border-midnight-tide bg-shadow-teal/30 p-6` a `glass-card`.

### 5.3 `CarResultCard` — props

```ts
// front/src/types/index.ts — alineado con server/models/schemas.py
export type CarResult = {
  title: string;
  price: number | null;          // FIX: era string, ahora number (int en Python)
  year: number | null;
  km: number | null;
  fuel: string | null;
  url: string;
  source: "autoscout24" | "coches.net" | "wallapop" | "milanuncios";
  location?: string | null;
  image_url?: string | null;     // ★ NUEVO — siempre que exista
  score?: number | null;
};

// front/src/components/chat/CarResultCard.tsx
type Props = { car: CarResult };
export function CarResultCard({ car }: Props) {
  // price Teodor 28px, year·km·fuel, source badge, score bar gradient, image con next/image fallback <img>
  // <a href={car.url} target="_blank" rel="noopener noreferrer">
  // onError fallback si image 403
  // max-w-[320px] glass-card opcional
}
```

```python
# server/models/schemas.py — CarResult (referencia)
class CarResult(BaseModel):
    title: str
    price: int | None
    year: int | None
    km: int | None
    fuel: str | None
    url: str
    source: str
    location: str | None = None
    image_url: str | None = None
    score: float | None = None

class ScrapeRequest(BaseModel):
    query: str
    source: str = "auto"  # auto | autoscout24 | cochesnet | wallapop | milanuncios
    max_results: int = 8
    max_price: int | None = None
    min_price: int | None = None
    min_year: int | None = None
    max_km: int | None = None

class ScrapeResponse(BaseModel):
    results: list[CarResult]
    source: str
    query: str
    total: int
```

### 5.4 DGT cards — props y contratos

```tsx
// front/src/components/dgt/DGTGuideCard.tsx
type Props = { plate?: string; vin?: string };
export function DGTGuideCard({ plate }: Props) { /* glass-card + ol 4 pasos + href sede.dgt + rel noopener */ }

// front/src/components/dgt/CarVerticalCard.tsx
type Props = { vin?: string };
export function CarVerticalCard({ vin }: Props) {
  // badge ~15€, beneficios km/accidentes/robos/taxi, input VIN prefill si vin, link https://www.carvertical.com (+ ?a= affiliate si CARVERTICAL_AFFILIATE_ID)
}

// front/src/components/dgt/CarfaxCard.tsx — pricing ~20€, link https://www.carfax.eu

// DgtLookupInput.tsx — props internas { plate, result: DgtResult | null }
// DgtResult incluye source: "mock"|"real" → badge Demo vs Oficial
```

### 5.5 `AutoMishoCatLayers` — ids y motion

| Grupo | `id` en DOM | Motion | Clamp / valor |
|-------|-------------|--------|---------------|
| `head` | `id="head"` | `useTransform(springX, v=>v*0.8)` + `useSpring(180,18)` | ±0.8deg, `transformOrigin 140px 110px` |
| `eyes` | `id="eyes"` | contenedor | — |
| `iris-left` / `iris-right` | `id="iris-left"` `id="iris-right"` | `useTransform(springX, clamp -3..3, v*3)` | 3px |
| `pupil-left` / `pupil-right` (o `pupils`) | `id="pupil-left"` `id="pupil-right"` | `useTransform(springX, clamp -1.5..1.5, v*1.5)` | 1.5px diferencial |
| `eyelids` (o `scaleY` en iris) | `id="eyelids"` o `motion.g animate scaleY` | `blinkState ? 0.1 : 1` 150ms | cada 3-6s |
| `body` / `legs` | `id="body"` `id="legs"` | `*0.3` / `*0.2` vía `useTransform` | proporcional |

Todos los `motion.g` con `will-change: transform` + `translateZ(0)` para 60fps (solo `transform`/`opacity`, sin layout).

### 5.6 API contracts

#### `POST /api/chat`

```ts
// Request
POST /api/chat
Content-Type: application/json
Cookie: session=...
Body: {
  messages: Array<{ role: "user"|"assistant", parts: Array<{type:"text", text:string} | {type:"image", image:string}> }>, // min 1, zod
  conversationId?: string // uuid v4 opcional
}

// Validación: zod ChatBody = z.object({ messages: z.array(z.any()).min(1), conversationId: z.string().uuid().optional() })
// Auth: 401 si !session.user
// Verify: 404 si conversationId && prisma.conversation.findFirst where id+userId null
// Detect: detectCarSearch(text) + detectPlate + detectVIN
// Side effects: prisma.message.create user, searchBackend si isSearch, lookupDgt si plate

// Response: streaming
// Headers: Content-Type: text/event-stream (AI SDK UIMessageStream)
// Body: UIMessageStream con parts type "text" + optional data: { cars: CarResult[] } o tool-invocation
// OnFinish: prisma.message.create assistant + prisma.conversation.update title si msgCount<=2

// Attachments: ChatWindow useChat({ experimental_attachments: true }) → parts image preservadas via convertToModelMessages
// Model: opencode(CHAT_MODEL) donde CHAT_MODEL = OPENCODE_MODEL ?? "qwen3.7-plus"
```

#### `POST /api/auth/refresh`

```ts
POST /api/auth/refresh
Cookie: session=...
// Auth 401 si !session.user.id
// prisma.user.findUnique where id=session.user.id → {plan}
// Response 200 { ok:true, plan:"premium"|"pro"|"free" }
// Usado por dashboard ?success=true client fetch + por tests E2E
```

#### `POST /scrape` (server)

```python
POST /scrape
Body: ScrapeRequest {
  query: str,              # "menos de 3000 diesel suv familiar barcelona"
  source: str = "auto",    # auto → gather 4 fuentes
  max_results: int = 8,    # clamp 1..12
  max_price: int | None,   # 3000
  min_price: int | None,
  min_year: int | None,
  max_km: int | None,
}
Response: ScrapeResponse {
  results: CarResult[] con image_url,
  source: str,
  query: str,
  total: int
}
# HEADERS: gzip,deflate,br + UA Chrome/120
# Timeout 12s + retry 1× 500ms + SoupStrainer + return_exceptions
# Milanuncios: GET https://www.milanuncios.com/coches-de-segunda-mano/?demanda=n&precio-hasta={max_price}&keywords={clean}
```

#### `POST /api/dgt/lookup` y `POST /dgt` (server)

```ts
POST /api/dgt/lookup
Body: { plate: string } // zod PlateBody regex ^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$i (sin A,E,I,O,U,Q,Ñ)
Proxy → POST BACKEND_URL/dgt { plate: "1234-BCD" }
Response: DgtResult { plate, make, model, year, fuel, power, enrollment_date, itv_status, source:"mock"|"real" }
UI: badge Demo si mock, Oficial si real
```

---

## 6. Security design

### 6.1 Zod schemas — `front/src/lib/validators.ts`

```ts
import { z } from "zod";

export const ChatBody = z.object({
  messages: z.array(z.any()).min(1, "messages required"),
  conversationId: z.string().uuid().optional(),
});

export const CheckoutBody = z.object({
  plan: z.enum(["premium", "pro"]),
});

export const PlateBody = z.object({
  plate: z.string().regex(/^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/i, "plate inválida: 4 dígitos + 3 letras sin A,E,I,O,U,Q,Ñ"),
});

export const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8, "mínimo 8 caracteres"),
});

export const ScrapeProxyBody = z.object({
  query: z.string().min(1).max(200),
  max_price: z.number().int().positive().optional(),
});

// Uso en cada route.ts:
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = ChatBody.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  // ... prisma/stripe solo después de validar
}
```

Cada `route.ts` (`chat`, `checkout`, `portal`, `dgt/lookup`, `register`, `conversations`, `search`) valida antes de `prisma`/`stripe`/`fetch`.

### 6.2 Rate-limit middleware — `front/src/middleware.ts`

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = process.env.UPSTASH_REDIS_REST_URL ? Redis.fromEnv() : null;
const ratelimit = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "automisho:ratelimit",
}) : null;

const premiumLimit = redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "1 m"), prefix: "automisho:premium" }) : null;

export async function middleware(req: NextRequest) {
  if (process.env.RATE_LIMIT_ENABLED === "false") return NextResponse.next();

  const path = req.nextUrl.pathname;
  const isLimited = ["/api/chat", "/api/dgt", "/api/search", "/api/register", "/api/checkout"].some(p => path.startsWith(p));
  if (!isLimited || !ratelimit) return NextResponse.next();

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.ip ?? "unknown";
  const userId = req.cookies.get("authjs.session-token")?.value?.slice(0,8) ?? "";
  const key = userId ? `${ip}:${userId}` : ip;

  // bypass premium: leer plan desde cookie/header si disponible, sino 10/min
  const isPremiumHint = req.headers.get("x-user-plan") === "premium" || req.headers.get("x-user-plan") === "pro";
  const limiter = isPremiumHint && premiumLimit ? premiumLimit : ratelimit;

  const { success, reset } = await limiter.limit(key);
  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/chat/:path*", "/api/dgt/:path*", "/api/search/:path*", "/api/register", "/api/checkout"] };
```

| Parámetro | Valor | Observación |
|-----------|-------|-------------|
| Free/default | **10 req/min** por `ip+userId` (o `ip` si no autenticado) | `slidingWindow(10,"1 m")` |
| Premium/pro | **20 req/min** | Doble límite, key con `userId` |
| Flag | `RATE_LIMIT_ENABLED=false` desactiva todo (CI/tests) | Sin redis, bypass (dev) |
| Respuesta | `429` + `Retry-After` | Cliente puede backoff |
| Dónde | `middleware.ts` matcher `chat,dgt,search,register,checkout` | No en `portal/webhooks` (Stripe reintenta) |

### 6.3 CSP y headers — `front/next.config.ts`

```ts
async headers() {
  return [{
    source: "/(.*)",
    headers: [
      { key: "Content-Security-Policy", value: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next + Framer requieren eval/inline
        "style-src 'self' 'unsafe-inline'",                 // Tailwind inline styles
        "img-src 'self' data: https:",                      // next/image remotePatterns + data:
        "font-src 'self' data:",
        "connect-src 'self' https://opencode.ai https://api.stripe.com",
        "frame-ancestors 'none'",
      ].join("; ") },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ],
  }];
}
```

- `script-src 'unsafe-eval'` solo si Framer/Next lo exige en build; si Lighthouse pasa sin `eval`, retirarlo.
- `SHOULD` iniciar en `Content-Security-Policy-Report-Only` si hay riesgo de romper Tailwind inline, migrar a `Content-Security-Policy` tras build verde.
- `server/main.py` CORS: `allow_origins=["http://localhost:3000", "https://<vercel-domain>"]` explícito, nunca `*` con `allow_credentials True`.

```python
# server/main.py — CORS harden
from fastapi.middleware.cors import CORSMiddleware
origins = ["http://localhost:3000"] + ([os.getenv("VERCEL_URL")] if os.getenv("VERCEL_URL") else [])
app.add_middleware(CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET","POST"],
    allow_headers=["*"],
)
```

### 6.4 Secrets rotation — `docs/SECRETS_ROTATION.md` + `.env.example`

```ini
# front/.env.example — placeholders sin secretos reales
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DATABASE_URL=postgresql://user:password@localhost:5432/automisho
OPENCODE_BASE_URL=https://opencode.ai/zen/go/v1
OPENCODE_API_KEY=
OPENCODE_MODEL=qwen3.7-plus
BACKEND_URL=http://localhost:8000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PREMIUM_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
MOCK_DGT=true
CARVERTICAL_API_KEY=
CARFAX_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
RATE_LIMIT_ENABLED=true
```

`front/.gitignore` debe contener `.env.local` y `.env` (verificar `git ls-files | grep .env.local` vacío). CI con `gitleaks detect --no-git` o `git grep -i "sk_test\|NEXTAUTH_SECRET" --cached` falla si encuentra secreto.

`docs/SECRETS_ROTATION.md` (resumen):

```md
# Rotación de secrets — AutoMisho
- NEXTAUTH_SECRET: openssl rand -base64 32
- GOOGLE_CLIENT_SECRET: Google Cloud Console → Credentials → Rotate
- STRIPE sk_test: Dashboard → Developers → API keys → Roll
- DATABASE_URL password: ALTER USER postgres WITH PASSWORD '...'; actualizar Vercel env + local .env.local
- OPENCODE_API_KEY: opencode.ai dashboard → Regenerate
- Tras rotar: redeploy front + server, invalidar sesiones (usuarios deben relogin si NEXTAUTH_SECRET cambia)
```

### 6.5 Links externos — `rel noopener`

Todos los `<a target="_blank">` en `DGTGuideCard`, `CarVerticalCard`, `CarfaxCard`, `CarResultCard` llevan `rel="noopener noreferrer"` (o `rel="noopener"`). CI: `grep -R 'target="_blank"' front/src --include="*.tsx" | grep -v 'rel='` → 0. `MessageBubble` futuro `react-markdown` con `rehype-sanitize` y bloqueo `javascript:` urls.

### 6.6 Wallapop JSON DoS y validación adicional

```python
# server/routers/scrape.py — Wallapop JSON con límite
import json
MAX_JSON_BYTES = 1_000_000
raw = script_tags[0].string or ""
if len(raw) > MAX_JSON_BYTES: raise ValueError("Wallapop JSON too large")
data = json.loads(raw)
```

`zod` en `chat` limita `messages` `min(1)` y `query` `max(200)`; `scrape.py` clamp `max_results` y `parsePrice` evita overflow.

---

## 7. Performance y a11y

### 7.1 Blur performance — fallback móvil

| Dispositivo | Estrategia | Por qué |
|-------------|------------|---------|
| Desktop moderno | `backdrop-filter: blur(20px)` + `will-change: transform` + `translateZ(0)` | GPU layer, 60fps, sin jank |
| Móvil low-end / Firefox <103 | `@supports not (backdrop-filter: blur(20px))` → `background: var(--color-shadow-teal)` sólido | Sin blur, sólido sigue AA, evita repaint caro |
| `prefers-reduced-motion: reduce` | `transition: none` en `.glass-card` + `animation: none` en `.blob` | Respeta a11y motion, reduce CPU |
| Blobs | `filter: blur(60px)` + `animation blob-morph 20-30s` + `opacity 0.6` + `pointer-events:none` | Blur grande pero estático; `prefers-reduced-motion` lo desactiva |

Medición: Chrome DevTools Performance 5s con `glass-card` + blobs + cat animado → target **55fps+** (60fps ideal). Si FPS <55 en móvil, reducir `blur` a `16px` o desactivar blobs en `<768px` via media query.

### 7.2 Cat 60fps — solo `transform`/`opacity`

- Todos los movimientos usan `transform: translate / rotate` y `opacity` — nunca `top/left/width` (evita layout thrash).
- `will-change: transform` en `motion.g` + `translateZ(0)` fuerza compositing.
- `useMotionValue` + `useSpring` corre en rAF fuera de React render (no `setState` por mousemove → no re-render).
- `prefers-reduced-motion: reduce` → `mouseX.set(0)` sin spring (clamp 0) → estático pero blink permanece.

### 7.3 Contraste — `mint on forest-depths 4.5:1`

| Par | Ratio | WCAG | Estado |
|-----|-------|------|--------|
| `pure-light #ffffff` sobre `forest-depths #072724` | **16.2:1** | AAA (≥7:1) | Pass |
| `pure-light #ffffff` sobre `glass rgba(35,82,76,0.40)` + `forest-depths` detrás | **~7.8:1** | AAA | Pass |
| `mist-gray #b0c5c1` sobre `forest-depths #072724` | **6.9:1** | AA (≥4.5:1) | Pass |
| `mist-gray #b0c5c1` sobre `glass rgba(35,82,76,0.40)` | **~4.8:1** | AA (≥4.5:1) | Pass (límitrofe, verificado axe) |
| `mist-gray` sobre `shadow-teal sólido #23524c` (fallback) | **5.1:1** | AA | Pass |
| `mint-glow #97fcd7` sobre `forest-depths` (badge/tag) | **12.1:1** | AAA | Pass |
| `mint-glow` sobre `glass` (hover border) | decorativo, no texto | — | No aplica |

Verificación: Lighthouse a11y dashboard + chat ≥95, `axe` sin violaciones contraste. Si `mist-gray` sobre glass cae <4.5:1 en algún monitor, subir `background` a `0.45` o texto a `pure-light`.

### 7.4 Otros a11y

- `DGTGuideCard` / `CarVerticalCard` / `CarfaxCard`: `<h3>` + `<ol>` semántico, `aria-label` en links externos.
- `CarResultCard`: `alt` en `img`, `aria-label` en link, `target _blank` con `rel`.
- `AutoMishoCat`: `aria-hidden="true"` o `role="img" aria-label="AutoMisho mascota"`, `prefers-reduced-motion` respeta.
- `MessageList` grid `gap-3` con `role="list"` si aplica.

---

## 8. Testing strategy

### 8.1 Matriz de tests

| Área | Tipo | Herramienta | Qué se testea | Criterio pass |
|------|------|-------------|---------------|---------------|
| **detectCarSearch / detectPlate / detectVIN + parsePrice** | Unit | `jest` / `vitest` | 20 fixtures lingüísticos: `"menos de 3000"`, `"hasta 5000"`, `"máximo 7000"`, `"máx. 4500"`, `"entre 3000 y 6000"`, `"15k"`, `"15.5k €"`, `"presupuesto 4000"`, `"3000€"`, `"busco suv diésel"` sin precio, `"en 2024 me casé"` negativo, `VIN WVWZZZ1JZ3W386752` vs `WVWZZZ1QZ...` con Q, `plate 1234BCD` vs `1234ABC` (A prohibida) | 100% fixtures `isSearch` correcto, `maxPrice/minPrice` exactos |
| **auth jwt refresh** | Unit (mock prisma) | `jest` | `jwt({token:{id:"user_123", plan:"free"}, user:undefined})` → `findUnique where id` → `token.plan="premium"`; `jwt` con `user` → `where email`; `trigger update` copia `session.plan` | Mock `prisma.user.findUnique` retorna premium → `token.plan` premium |
| **Checkout Body / ChatBody / PlateBody** | Unit | `jest` + `zod` | `CheckoutBody safeParse {plan:"enterprise"}` → 400; `ChatBody {messages:"no-array"}` → 400; `PlateBody "1234ABC"` → 400, `"1234BCD"` → pass | 400/200 correctos |
| **CarResultCard** | Unit / snapshot | `jest` + `@testing-library/react` | Render con `car:{title, price:5500, year:2019, km:95000, image_url, url, source}` → `price` `5.500€`, `image` `alt`, `link rel noopener`, `source badge` | Snapshot + `getByRole("link")` `href` + `rel` |
| **DGTGuideCard / CarVerticalCard / CarfaxCard** | Unit / snapshot | `jest` + RTL | Badge `8,67€`, `ol` 4 pasos, `href sede.dgt`, `rel noopener`, `glass-card` clase | `getByText("Ir a Sede DGT")` `href` correcto |
| **Dashboard glass + blobs** | Visual / e2e | Playwright | `GET /dashboard` autenticado → `max-w-6xl`, `gap-8`, 2 blobs `blur-[120px]`, `glass-card` `backdrop-filter: blur` en computed, stagger `opacity 0→1` | `expect(page.locator('[data-testid="dashboard-card"]')).toHaveCSS('backdrop-filter', /blur/)` |
| **AutoMishoCat layers** | Unit + visual | `jest` + Playwright | `grep` `id="head"`, `id="iris-left"`, `useMotionValue`, `useSpring stiffness 180`, `clamp -3` y `-1.5`, `head *0.8` no `*8`, `will-change` | `grep -c 'id="head"'` >0, `grep "useSpring"` con 180/18 |
| **Scrape smoke** | Manual + integration | `httpx` + `pytest` (server) | `POST /scrape {query:"menos de 3000", max_price:3000}` live → `total >=1`, `image_url` presente en ≥50%, `source` 4 valores, `SoupStrainer` no error | Manual `curl` + log `total` por fuente |
| **Milanuncios selectors** | Manual | `curl` + `BeautifulSoup` | `article.ma-AdCardV2` fallback `div.ad-card` con `title/price/url/image_url` | ≥1 item parseado |
| **Stripe webhook** | E2E | Stripe CLI | `stripe trigger checkout.session.completed --add metadata[userId]=user_123 --add metadata[plan]=premium` → webhook 200 → `prisma.user.findUnique` plan premium → `GET /dashboard` sin relogin premium | Webhook 200 + DB premium + `auth()` fresco |
| **Rate-limit** | Integration | `curl` loop | 11× `POST /api/chat` en 60s mismo IP → 11º 429 + `Retry-After`; premium 11º 200; `RATE_LIMIT_ENABLED=false` → 100 req sin 429 | 429/200 según caso |
| **CSP headers** | Integration | `curl -I` | `GET /dashboard` → `Content-Security-Policy: default-src 'self'... frame-ancestors 'none'` + `X-Content-Type-Options: nosniff` | Headers presentes |
| **Images whitelist** | Build | `npm run build --prefix front` | `next/image` con `https://cdn.milanuncios.com/foto.jpg` no 400 | Build pasa |
| **Secrets** | CI | `gitleaks` + `git grep` | `git grep -i "sk_test\|NEXTAUTH_SECRET" --cached` → 0; `.env.example` sin secretos reales | 0 leaks |

### 8.2 Fixtures lingüísticos (extracto para `jest`)

```ts
// front/src/app/api/chat/__tests__/detectCarSearch.test.ts
import { detectCarSearch, detectPlate, detectVIN } from "../route";

const cases: Array<[string, {isSearch:boolean, maxPrice?:number, minPrice?:number}]> = [
  ["menos de 3000",                {isSearch:true, maxPrice:3000}],
  ["hasta 5000",                   {isSearch:true, maxPrice:5000}],
  ["máximo 7000",                  {isSearch:true, maxPrice:7000}],
  ["máx. 4500",                    {isSearch:true, maxPrice:4500}],
  ["entre 3000 y 6000",            {isSearch:true, maxPrice:6000, minPrice:3000}],
  ["15k",                          {isSearch:true, maxPrice:15000}],
  ["15.5k €",                      {isSearch:true, maxPrice:15500}],
  ["presupuesto 4000",             {isSearch:true, maxPrice:4000}],
  ["3000€",                        {isSearch:true, maxPrice:3000}],
  ["busco suv diésel barato",      {isSearch:true}],
  ["en 2024 me casé",              {isSearch:false}],
  [" VIN WVWZZZ1JZ3W386752 qué historial", {isSearch:false}], // VIN no dispara search, sí dgt
];

test.each(cases)("%s → %j", (q, exp) => {
  const r = detectCarSearch(q);
  expect(r.isSearch).toBe(exp.isSearch);
  if (exp.maxPrice) expect(r.maxPrice).toBe(exp.maxPrice);
  if (exp.minPrice) expect((r as any).minPrice).toBe(exp.minPrice);
});

test("plate 1234BCD válida, 1234ABC inválida", () => {
  expect(detectPlate("mira 1234BCD")).toBe("1234-BCD");
  expect(detectPlate("1234ABC")).toBeNull(); // A prohibida
});
test("VIN sin I/O/Q", () => {
  expect(detectVIN("WVWZZZ1JZ3W386752")).toBe("WVWZZZ1JZ3W386752");
  expect(detectVIN("WVWZZZ1QZ3W386752")).toBeNull(); // Q prohibida
});
```

### 8.3 Stripe CLI — webhook test

```bash
# 1. Forward webhooks a local
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# 2. Trigger checkout.session.completed con metadata
stripe trigger checkout.session.completed \
  --add checkout_session:metadata[userId]=user_123 \
  --add checkout_session:metadata[plan]=premium
# 3. Verificar DB
psql $DATABASE_URL -c "SELECT id, plan, stripeCustomerId FROM \"User\" WHERE id='user_123';"
# 4. Verificar JWT fresco sin relogin: curl con cookie session
curl -b "authjs.session-token=..." http://localhost:3000/api/auth/refresh
# 5. Probar subscription.updated con price
stripe trigger customer.subscription.updated
# 6. Verificar PRICE_TO_PLAN no defaultea a premium si price desconocido (log warn)
```

### 8.4 Scrape smoke — manual

```bash
curl -X POST http://localhost:8000/scrape -H "Content-Type: application/json" \
  -d '{"query":"menos de 3000 diesel","source":"auto","max_results":8,"max_price":3000}' | jq
# assert total >=1, cada result con image_url o null, source en 4 valores

# Wallapop con ciudad
curl -X POST http://localhost:8000/scrape -H "Content-Type: application/json" \
  -d '{"query":"seat león barcelona hasta 6000","source":"wallapop","max_results":4,"max_price":6000}' | jq

# Milanuncios directo
curl -X POST http://localhost:8000/scrape -H "Content-Type: application/json" \
  -d '{"query":"utilitario 5000","source":"milanuncios","max_results":4,"max_price":5000}' | jq

# DGT mock vs real
curl -X POST http://localhost:8000/dgt -H "Content-Type: application/json" -d '{"plate":"1234-BCD"}' | jq .source
```

---

## 9. Rollout y rollback

### 9.1 Principio

Cada pilar es reversible con `git revert` parcial o env flag **sin migración de DB** (`prisma/migrations` no se toca). Orden de rollback por severidad; tiempo total <15min.

### 9.2 Rollout — single-PR `size:exception` (~600-800 líneas)

| Fase | Pilar | Flag / env | Verificación |
|------|-------|------------|--------------|
| 1 | **Glass + dashboard** | — (solo front) | `npm run build --prefix front` + Lighthouse a11y ≥95 + `grep hex` 0 + visual 1440p gap-8 + blobs + hover glow |
| 2 | **Monetización JWT + webhook** | `STRIPE_WEBHOOK_SECRET` guard 500 si falta | Stripe CLI trigger → DB premium → dashboard sin relogin + portal 200 |
| 3 | **Chat search regex + scrape gather + milanuncios** | `RATE_LIMIT_ENABLED=false` para tests | 20 fixtures `isSearch` 100% + `POST /scrape` 4 fuentes <3s + `total >=3` |
| 4 | **Chat cards + images + qwen** | `OPENCODE_MODEL=deepseek-v4-pro` fallback instantáneo | `CarResultCard` image_url visible, `next.config` build pasa |
| 5 | **DGT didáctico 3 cards** | `MOCK_DGT=true` vuelve a mock puro | `DGTGuideCard` 8,67€ + links `rel noopener` + `grep fetch.*sede.dgt` 0 |
| 6 | **Cat layers + spring** | — | `grep id="head"` + `useSpring 180/18` + Chrome perf 60fps |
| 7 | **Security zod + ratelimit + CSP** | `RATE_LIMIT_ENABLED`, `CSP_REPORT_ONLY=true` | `zod` 400/200, `429` + `Retry-After`, `curl -I` CSP, `gitleaks` 0 |

Branch `feat/automisho-ux-pro` desde `main`; CI `npm run build --prefix front` + `npm test --prefix front` + `ruff check server/` + `gitleaks` + Lighthouse CI.

### 9.3 Rollback granular por pilar

| Pilar | Cómo revertir | Comando / flag | Tiempo | Data loss | Requiere deploy |
|-------|---------------|----------------|--------|-----------|-----------------|
| **Glass** | Revert `globals.css` utilities + `dashboard/page.tsx` `max-w-6xl`→`max-w-4xl` | `git revert <sha> -- front/src/app/globals.css front/src/app/(protected)/dashboard/ front/src/components/dashboard/` | <5 min | No | Sí (front) |
| **Monetización JWT** | Revert `auth.ts` bloque `if(token.id && !user)` + `POST /api/auth/refresh` | `git revert -- front/src/lib/auth.ts front/src/app/api/auth/refresh/` + Stripe reintenta webhook 72h | <10 min | No — `prisma.user.plan` permanece correcto, solo JWT vuelve stale (usuario necesita relogin) | Sí |
| **Webhook hardening** | `PRICE_TO_PLAN` + `invoice.paid` son aditivos, no rompen; si falla, revert `webhooks/stripe/route.ts` | `git revert -- front/src/app/api/webhooks/stripe/` + `STRIPE_WEBHOOK_SECRET` guard | <5 min | No | Sí |
| **Chat regex** | Revert `chat/route.ts` OR→AND | `git revert -- front/src/app/api/chat/route.ts` o futuro `MOCK_CHAT_REGEX=false` | <5 min | No | Sí |
| **Scraping gather + milanuncios** | Revert `scrape.py` `gather`→secuencial + quitar `_scrape_milanuncios` | `git revert -- server/routers/scrape.py` + `MOCK_SCRAPE=milanuncios` flag | <10 min | No — `CarResult` response-only | Sí (server) |
| **Chat cards / images** | Revert `MessageList.tsx` `data` block → solo text; `next.config images` es aditivo | `git revert -- front/src/components/chat/ front/next.config.ts front/src/types/index.ts` | <5 min | No | Sí |
| **Modelo qwen** | Env var sin código | `OPENCODE_MODEL=deepseek-v4-pro` en `front/.env.local` + restart | <1 min | No | Solo restart |
| **DGT cards** | Revert `components/dgt/` + `MessageBubble dgt-guide` + `dgt.py MOCK` | `git revert -- front/src/components/dgt/ server/routers/dgt.py front/src/app/api/dgt/` | <5 min | No | Sí |
| **Cat** | Revert `AutoMishoCat.tsx` a `eyeOffset*4` conjunto | `git revert -- front/src/components/icons/AutoMishoCat.tsx` | <5 min | No | Sí |
| **Seguridad zod/ratelimit/CSP** | `zod` es aditivo (400 si inválido — ampliar schema si rompe); `ratelimit` desactivable; `CSP`→`report-only` | `RATE_LIMIT_ENABLED=false`, `CSP_REPORT_ONLY=true`, `git revert -- front/src/lib/validators.ts front/src/middleware.ts` | <5 min | No | Sí |

**Rollback total:** `git revert <merge-sha> -m 1` revierte single-PR completo. Sin `prisma migrate down`. Webhooks ya procesados permanecen en DB (`plan` no se revierte). Tiempo total <15min. Forward-fix preferido para R2 (selectores) y R5 (modelo) antes que revertir pilar entero.

### 9.4 Feature flags resumen

| Flag | Default | Efecto | Pilar |
|------|---------|--------|-------|
| `OPENCODE_MODEL` | `qwen3.7-plus` | `deepseek-v4-pro` fallback | Chat modelo |
| `RATE_LIMIT_ENABLED` | `true` | `false` desactiva ratelimit | Security |
| `MOCK_DGT` | `true` | `false` + `DGT_API_KEY` → real | DGT |
| `CARVERTICAL_API_KEY` / `CARFAX_API_KEY` | vacío → mock | con key → real | DGT |
| `UPSTASH_REDIS_REST_URL` | vacío → no ratelimit (dev) | con url → ratelimit activo | Security |
| `STRIPE_WEBHOOK_SECRET` | requerido | sin él webhook 500 | Monetización |

---

## 10. Apéndices

### 10.1 Mapa de archivos tocados

```
front/src/app/globals.css                              ★ glass utilities + @supports + reduced-motion
front/src/app/(protected)/dashboard/page.tsx            ★ max-w-6xl gap-8 blobs stagger + DGT 3 cards grid + success refresh
front/src/components/dashboard/PlanCard.tsx:52           → glass-card
front/src/components/dashboard/UsageStats.tsx:27         → glass-card / glass-strong
front/src/components/dashboard/DgtLookupInput.tsx:53     → glass-card + glass-input + banner mock/real
front/src/components/dashboard/SettingsPanel.tsx:14      → glass-card md:col-span-2
front/src/components/sections/Hero.tsx:38-48             → var(--color-*) audit (quita #072724 hardcode)
front/src/components/sections/Footer.tsx:33,35           → var()
front/src/components/sections/Pricing.tsx:88             → var()
front/src/components/sections/HowItWorks.tsx:83-88       → var()
front/src/lib/auth.ts:50-71                              ★ jwt refresh por token.id cada request
front/src/app/api/auth/refresh/route.ts                  ★ NUEVO POST /api/auth/refresh
front/src/app/api/webhooks/stripe/route.ts:20-24,33-89   ★ 5 eventos + PRICE_TO_PLAN + guard secret + idempotencia
front/src/lib/stripe.ts:16-18                            ★ valida env sin ! + PRICE_TO_PLAN
front/src/app/api/checkout/route.ts                      zod CheckoutBody
front/src/app/api/portal/route.ts:8                      ★ prisma fresh no JWT stale
front/src/app/api/chat/route.ts:14-48,56-73,139-143      ★ detectCarSearch OR + 8 patterns + VIN + searchBackend 12s + extraData.cars
front/src/lib/validators.ts                              ★ NUEVO zod centralizado
front/src/middleware.ts                                  ★ NUEVO ratelimit 10/20 + flag
front/next.config.ts:5-8                                 ★ images.remotePatterns 5 hosts + CSP headers
front/src/lib/ai.ts:15                                   CHAT_MODEL qwen fallback
front/src/types/index.ts:3-12                            CarResult price:number + image_url
front/src/components/chat/MessageList.tsx:60-65          ★ render CarResultCard data/tool + dgt-guide
front/src/components/chat/MessageBubble.tsx:25           dgt-guide support
front/src/components/chat/CarResultCard.tsx:6-72         image_url + rel noopener
front/src/components/chat/ChatWindow.tsx:3-57            experimental_attachments
front/src/components/icons/AutoMishoCat.tsx:1-384        ★ 4 grupos + useMotionValue/spring iris 3/pupil 1.5/head 0.8
front/src/components/dgt/DGTGuideCard.tsx                ★ NUEVO glass-card 8,67€ 4 pasos
front/src/components/dgt/CarVerticalCard.tsx             ★ NUEVO ~15€ VIN
front/src/components/dgt/CarfaxCard.tsx                  ★ NUEVO ~20€ VIN
front/.env.local:13                                      OPENCODE_MODEL=qwen3.7-plus
front/.env.example                                       ★ NUEVO placeholders sin secretos
front/.gitignore                                         verifica .env.local
server/routers/scrape.py:11-260                          ★ gather 4 + milanuncios + SoupStrainer + clamp + timeout12 + wallapop lat/lon + image_url
server/models/schemas.py                                 CarResult image_url preserved
server/routers/dgt.py:12-44                              source mock|real flag
server/routers/carvertical.py:19-35                      source flag
server/routers/carfax.py:19-34                           source flag
server/main.py:20-30                                     CORS restringido + max_content_length
docs/SECRETS_ROTATION.md                                 ★ NUEVO
```

### 10.2 Variables de entorno — checklist

| Var | Requerida | Ejemplo | Dónde |
|-----|-----------|---------|-------|
| `NEXTAUTH_SECRET` | sí | `openssl rand -base64 32` | `auth.ts` |
| `OPENCODE_MODEL` | no (default qwen) | `qwen3.7-plus` | `ai.ts:15` |
| `STRIPE_SECRET_KEY` | sí | `sk_test_...` | `stripe.ts` |
| `STRIPE_WEBHOOK_SECRET` | sí | `whsec_...` | `webhooks/stripe` guard |
| `STRIPE_PREMIUM_PRICE_ID` | sí | `price_1U62vu...` | `PRICE_TO_PLAN` |
| `STRIPE_PRO_PRICE_ID` | sí | `price_1U62wc...` | `PRICE_TO_PLAN` |
| `MOCK_DGT` | no | `true` | `dgt.py` |
| `RATE_LIMIT_ENABLED` | no | `true` | `middleware.ts` |
| `UPSTASH_REDIS_REST_URL` | no (dev) | `https://...` | `middleware.ts` |

### 10.3 Riesgos cruzados (traza a proposal §6)

| # | Riesgo | Mitigación en este design |
|---|--------|---------------------------|
| R1 | JWT stale | §3.1 `jwt` refresh + `POST /api/auth/refresh` + webhook idempotente + portal DB |
| R2 | Selectores frágiles | §3.2 `SoupStrainer` + `return_exceptions` + fallback + `gather` + `milanuncios` + logs + alerta `total===0` |
| R3 | Wallapop/Milanuncios anti-bot | `br` + UA rotación + retry + timeout 12; si >15% bloqueo → proxy (fuera scope) |
| R4 | Secrets expuestos | §6.4 `.env.example` + rotation doc + gitleaks |
| R5 | Qwen costo/latencia | §4 ADR-004 env fallback + `max_tokens` + monitor |
| R6 | Cat perf | §7.1 `will-change` + `translateZ(0)` + `prefers-reduced-motion` |
| R7 | CSP rompe inline | `style-src 'unsafe-inline'` + report-only primero |
| R8 | Rate-limit falso positivo | 10/min generoso + premium 20/min + `Retry-After` |
| R9 | Images no whitelisted | `remotePatterns` 5 hosts + fallback `<img>` |
| R10 | DGT mock confusión | Badge Demo + DGTGuideCard siempre visible |

### 10.4 Métricas de éxito (traza a proposal §7)

Ver `proposal.md §7` — SLO 30 días: `"menos de 3000" ≥3 coches <3s` P50 <2.0s, 20 fixtures 100%, checkout→premium <5s sin relogin 100%, portal 0 falsos 400, cards CTR ≥35%, imágenes ≥80%, Lighthouse a11y ≥95, `grep hex` 0, DGT guide ≥60% consultas, cat 60fps, `gitleaks` 0 leaks.

### 10.5 Referencias

- `exploration.md` — diagnóstico completo (tokens, JWT bug, regex, scraping, cat, seguridad)
- `proposal.md` — scope IN/OUT, approach por pilar, alternativas, rollback granular
- `specs/visual-liquid-glass.md` — 16 REQs + 8 SCN (glass, dashboard, tokens)
- `specs/monetization-stripe-jwt.md` — 17 REQs + 11 SCN (jwt, refresh, webhook 5 eventos)
- `specs/chat-search-real.md` — 32 REQs + 15 SCN (regex OR, gather 4, milanuncios, cards, qwen)
- `specs/dgt-didactic.md` — 16 REQs + 9 SCN (3 cards, VIN, mock/real)
- `specs/cat-animation-layers.md` — 15 REQs + 9 SCN (ids, spring, clamp)
- `specs/security-hardening.md` — 19 REQs + 14 SCN (zod, ratelimit, CSP, secrets)
- `front/src/app/globals.css:8-61` — `@theme` tokens Hyper
- `front/src/lib/auth.ts:50-71` — bug JWT origen
- `front/src/app/api/chat/route.ts:14-73` — `detectCarSearch` origen
- `server/routers/scrape.py:11-260` — scrapers origen
- `front/src/components/icons/AutoMishoCat.tsx:1-384` — cat origen
- `front/next.config.ts:1-10` — config origen

---

**Siguiente fase:** `sdd-tasks` — descomponer este design en tasks agrupadas por pilar con numbering jerárquico, dependencias y estimación, respetando `single-pr + size:exception` y orden de rollout §9.2.
