# Tasks — automisho-ux-pro

**Change ID:** `automisho-ux-pro`  
**Status:** `draft` — tasks breakdown (pre-apply)  
**Date:** 2026-08-20  
**Authors:** UX Pro Working Group (Front + Server + Design)  
**Depends on:** `exploration.md` · `proposal.md` · `specs/*.md` (6 deltas) · `design.md`  
**Branch:** `feat/automisho-ux-pro` desde `main`  
**Config:** `openspec/config.yaml` — hierarchical numbering, group by phase, completable en una sesión

---

## 1. Resumen ejecutivo

Single-PR `size:exception` pre-aprobado (~650–800 líneas) descompuesto en **6 fases / 26 tasks** siguiendo `design.md §9.2 Rollout`. Cada task es completable en una sesión, con criterio `GIVEN/WHEN/THEN` trazable a `REQ-XXX` de specs.

| Fase | Pilar | Tasks | Líneas est. | Riesgo principal |
|------|-------|-------|-------------|------------------|
| **T-1** | Liquid Glass System | 4 | ~80 | Perf blur móvil |
| **T-2** | Monetización Stripe JWT | 5 | ~90 | N+1 refresh |
| **T-3** | Chat Search Real | 6 | ~300 | Selectores frágiles |
| **T-4** | DGT Didáctico | 3 | ~90 | Confusión mock/real |
| **T-5** | Cat Layers Animation | 3 | ~70 | Jank spring |
| **T-6** | Security Hardening | 5 | ~90 | CSP `unsafe-inline` |
| **Total** | | **26** | **~720** (650–800) | — |

### Delivery strategy

| Dimensión | Valor |
|-----------|-------|
| **Estrategia** | `single-pr` — atómico, ilimitado |
| **Branch** | `feat/automisho-ux-pro` |
| **Size exception** | `size:exception` pre-aprobado (ilimitado) |
| **Chained PRs** | No — overlap `globals.css` + `chat/route.ts` + `scrape.py` haría conflictos |
| **CI gates** | `npm run build --prefix front` + `npm test --prefix front` + `ruff check server/` + `gitleaks` + Lighthouse a11y ≥95 |
| **Rollback** | Granular por pilar sin migración DB (<15 min total) — ver `design.md §9.3` |

### Orden de ejecución & paralelización

```
T-1 (Glass) ──────────────────────────────────────┐
     │                                            │
     ▼                                            ▼
T-2 (Stripe JWT) ──► T-3 (Chat Search) ──► T-4 (DGT)    T-5 (Cat) ──┐
                        │                    ▲            ▲        │
                        └────────────────────┘            │        │
                                                    paralelo     paralelo
                                                          │        │
                                                          ▼        ▼
                                                      T-6 (Security Hardening)
```

| Orden | Fase | Depende de | Paralelizable con | Nota |
|-------|------|------------|-------------------|------|
| 1 | **T-1 Liquid Glass** | — | T-5 (Cat) | Sin dependencia lógica; tokens base |
| 2 | **T-2 Stripe JWT** | T-1 (opcional, solo visual QA) | T-5 | Independiente funcional; puede ir en paralelo a T-1 tras `globals.css` freeze |
| 3 | **T-3 Chat Search** | T-2 (portal usa cards) | T-4.1 (flag `source`), T-5 | Core value prop; bloquea T-4.3 |
| 4 | **T-4 DGT Didáctico** | T-3.1 (VIN regex) + T-1 (glass-card) | — | Requiere `detectVIN` de T-3 y `.glass-card` de T-1 |
| 5 | **T-5 Cat Layers** | T-1 (opcional) | T-1, T-2, T-3 | Totalmente independiente — **paralelizable desde inicio** |
| 6 | **T-6 Security** | T-2, T-3, T-4 (schemas) | — | Debe cerrar: cubre todos los routes creados en T-2/T-3/T-4 |

> **Recomendación:** lanzar **T-1 + T-5 en paralelo** día 1. **T-2** en paralelo día 1–2. **T-3** secuencial crítico día 2–3. **T-4** solapable con cola de T-3. **T-6** al final, tras congelar contracts de routes.

---

## 2. Tabla maestra — todas las tasks

| # | Título | Archivos | REQ trace | Dep | Est | ∥ |
|---|--------|----------|-----------|-----|-----|---|
| **T-1.1** | Utilities `glass` base | `globals.css` | visual REQ-001..005, REQ-013, REQ-014 | — | M | ✓ con T-5 |
| **T-1.2** | Dashboard `max-w-6xl` + blobs + stagger | `dashboard/page.tsx` | visual REQ-006..008, REQ-015 | T-1.1 | M | — |
| **T-1.3** | Cards `glass-card` + hover glow | `PlanCard`, `UsageStats`, `DgtLookupInput`, `SettingsPanel` | visual REQ-009, REQ-005 | T-1.1 | S | — |
| **T-1.4** | Migrar hardcodes hex → `var(--color-*)` | `Hero`, `Footer`, `Pricing`, `HowItWorks`, `globals.css` | visual REQ-010, REQ-011 | T-1.1 | S | ✓ |
| **T-2.1** | JWT refresh por `token.id` cada request | `lib/auth.ts` | monet REQ-001..003, REQ-016 | — | S | ✓ |
| **T-2.2** | Endpoint `POST /api/auth/refresh` | `app/api/auth/refresh/route.ts` (nuevo) | monet REQ-004, REQ-005, REQ-017 | T-2.1 | S | — |
| **T-2.3** | Webhook hardening 5 eventos + `PRICE_TO_PLAN` | `app/api/webhooks/stripe/route.ts`, `lib/stripe.ts` | monet REQ-006..012, REQ-014, REQ-015 | T-2.1 | M | — |
| **T-2.4** | Portal fix — `prisma` fresh no JWT stale | `app/api/portal/route.ts` | monet REQ-013 | T-2.1 | S | ✓ con T-2.2 |
| **T-2.5** | PlanCard polling `?success=true` → refresh | `dashboard/page.tsx`, `components/dashboard/PlanCard.tsx` | monet REQ-016, REQ-017 | T-2.2 | S | — |
| **T-3.1** | Regex `detectCarSearch` OR + `k€` + `entre` + VIN | `app/api/chat/route.ts` | chat REQ-001..007 | — | M | — |
| **T-3.2** | Scrape `milanuncios` + `gather` paralelo + fixes | `server/routers/scrape.py`, `server/models/schemas.py` | chat REQ-008..022, REQ-009..011 | T-3.1 | L | — |
| **T-3.3** | Chat route `CarResult[]` + `image_url` + cards stream | `app/api/chat/route.ts`, `types/index.ts`, `components/chat/CarResultCard.tsx` | chat REQ-022..025, REQ-027, REQ-031, REQ-032 | T-3.1, T-3.2 | M | — |
| **T-3.4** | MessageList `tool`/`data` parts → `CarResultCard` grid | `components/chat/MessageList.tsx`, `MessageBubble.tsx` | chat REQ-026, REQ-031 | T-3.3 | S | — |
| **T-3.5** | `next.config` `images.remotePatterns` 5 hosts | `next.config.ts` | chat REQ-028 | T-3.3 | S | ✓ |
| **T-3.6** | Modelo `qwen3.7-plus` + `experimental_attachments` visión | `lib/ai.ts`, `.env.local`, `components/chat/ChatWindow.tsx` | chat REQ-029, REQ-030 | T-3.3 | S | ✓ |
| **T-4.1** | Flag `source mock|real` + banner Demo/Oficial | `server/routers/dgt.py`, `carvertical.py`, `carfax.py`, `components/dashboard/DgtLookupInput.tsx` | dgt REQ-006..009 | — | S | ✓ con T-3.2 |
| **T-4.2** | 3 cards didácticas `DGTGuideCard` + `CarVertical` + `Carfax` | `components/dgt/DGTGuideCard.tsx` (nuevo), `CarVerticalCard.tsx`, `CarfaxCard.tsx`, `dashboard/page.tsx` | dgt REQ-001..005, REQ-013..015 | T-1.1, T-4.1 | M | — |
| **T-4.3** | Chat `detectPlate/VIN` → bloque 3 opciones + render | `app/api/chat/route.ts`, `components/chat/MessageList.tsx`, `MessageBubble.tsx` | dgt REQ-010..012, REQ-014 | T-3.1, T-4.2 | M | — |
| **T-5.1** | Separar SVG en 4 grupos con `id` | `components/icons/AutoMishoCat.tsx` | cat REQ-001, REQ-002, REQ-010, REQ-011 | — | S | ✓ |
| **T-5.2** | `useMotionValue` + `useSpring` iris 3px / pupil 1.5px / head 0.8° | `components/icons/AutoMishoCat.tsx` | cat REQ-003..008, REQ-014, REQ-015 | T-5.1 | M | — |
| **T-5.3** | Blink `scaleY 0.1` 150 ms + `will-change` 60fps + `prefers-reduced-motion` | `components/icons/AutoMishoCat.tsx`, `globals.css` | cat REQ-009, REQ-012, REQ-013 | T-5.2 | S | — |
| **T-6.1** | `zod` schemas centralizados + validación todas las routes | `lib/validators.ts` (nuevo), `app/api/**/route.ts` | sec REQ-001..003 | T-2.2, T-3.3, T-4.1 | M | — |
| **T-6.2** | Rate-limit middleware `10/min` (20 premium) + flag | `middleware.ts` (nuevo), `lib/rate-limit.ts` opcional | sec REQ-004..007 | T-6.1 | M | — |
| **T-6.3** | CSP + security headers en `next.config` | `next.config.ts` | sec REQ-008..010 | — | S | ✓ con T-3.5 |
| **T-6.4** | `.env.example` + `.gitignore` + `docs/SECRETS_ROTATION.md` | `.env.example` (nuevo), `.gitignore`, `docs/SECRETS_ROTATION.md` | sec REQ-011..014 | — | S | ✓ |
| **T-6.5** | `rel="noopener noreferrer"` en todos los links externos | `components/dgt/*`, `components/chat/CarResultCard.tsx`, `MessageBubble.tsx` | sec REQ-015, dgt REQ-014, chat REQ-031 | T-4.2, T-3.4 | S | — |

**Leyenda:** Est = S (<2 h / <80 líneas), M (2–4 h / 80–150), L (>4 h / >150). ∥ = paralelizable al inicio sin bloquear.

---

## 3. Fase T-1 — Liquid Glass System

> Objetivo `specs/visual-liquid-glass.md`: extender Hyper Foundation con glass sin romper tokens. A11y AA intacto.

### T-1.1 Utilities `glass` base — `globals.css`

- [ ] T-1.1 Utilities `glass` base — `globals.css`

**Descripción:** Crear bloque Liquid Glass tras `.card` (~línea 210): `.glass`, `.glass-strong`, `.glass-card`, `.glass-input` + `:hover` + `@supports not (backdrop-filter)` + `@media (prefers-reduced-motion)`.

**Archivos:**
- `front/src/app/globals.css` — nuevo bloque ~50 líneas (definición canónica `design.md §2.2`)

**Criterio de aceptación:**
- `globals.css` contiene `.glass` con `rgba(35,82,76,0.40)` + `blur(20px) saturate(1.2)` + `border white/[0.06]` + `inset 0 1px 0 white/0.06 + 0 8px 32px black/0.24` — **REQ-001, REQ-014**
- `.glass-strong` `0.55 / blur(24px) saturate(1.3) / border 0.08` — **REQ-002**
- `.glass-card` `radius var(--radius-cards) p 1.5rem transition 0.3s cubic-bezier` — **REQ-003**
- `.glass-input` `radius var(--radius-full) pill` — **REQ-004**
- `:hover` `mint-glow/18 + glow 0 0 20px mint/12 + translateY(-2px)` — **REQ-005**
- `@supports not` fallback `var(--color-shadow-teal)` sólido — **REQ-013 fallback**
- `prefers-reduced-motion: reduce` desactiva `transition`/`animation` — **REQ-013**

**Dependencia:** — (raíz)  
**Estimación:** M  
**Paralelizable:** Sí — con T-5

---

### T-1.2 Dashboard `max-w-6xl` + blobs + stagger — `dashboard/page.tsx`

- [ ] T-1.2 Dashboard `max-w-6xl` + blobs + stagger — `dashboard/page.tsx`

**Descripción:** Migrar wrapper a `relative overflow-hidden` + 2 blobs atmosféricos + `max-w-6xl gap-8 p-8` + Framer `staggerChildren 0.06 delayChildren 0.08` + header `y 8→0 400ms`.

**Archivos:**
- `front/src/app/(protected)/dashboard/page.tsx` — layout + `motion.div` stagger + blobs
- `front/src/components/dashboard/*` — sin cambios directos (solo reciben `glass-card` en T-1.3)

**Criterio de aceptación:**
- Container `max-w-6xl mx-auto px-8 py-10` (1200px system width) no `max-w-4xl`; grid `gap-8` no `gap-6` — **REQ-006** → `SCN-001`
- 2 blobs `pointer-events-none absolute rounded-full blur-[120px]/[100px]` `shadow-teal/20` + `abyss-green/30` en `-top-32 -right-32` / `-bottom-24 -left-24` — **REQ-007** → `SCN-003`
- Framer `initial hidden → show staggerChildren 0.06 delayChildren 0.08`, hijos `opacity 0→1 y 12→0` + header `opacity 0→1 y 8→0 400ms` — **REQ-008** → `SCN-001`
- `section-header` pattern opcional — **REQ-015 (SHOULD)**

**Dependencia:** T-1.1  
**Estimación:** M  
**Paralelizable:** No

---

### T-1.3 Cards `glass-card` + hover glow — 4 componentes dashboard

- [ ] T-1.3 Cards `glass-card` + hover glow — 4 componentes dashboard

**Descripción:** Migrar `PlanCard:52`, `UsageStats:27`, `DgtLookupInput:53`, `SettingsPanel:14` de `rounded-xl border-midnight-tide bg-shadow-teal/30 p-6` a `.glass-card`; preservar `md:col-span-2` en `SettingsPanel`.

**Archivos:**
- `front/src/components/dashboard/PlanCard.tsx`
- `front/src/components/dashboard/UsageStats.tsx`
- `front/src/components/dashboard/DgtLookupInput.tsx` — wrapper `glass-card` + input `glass-input`
- `front/src/components/dashboard/SettingsPanel.tsx`

**Criterio de aceptación:**
- Cada card `className` contiene `glass-card`; `bg-shadow-teal/30` plano eliminado — **REQ-009** → `SCN-001, SCN-008`
- Hover `border mint-glow/18 + shadow glow + translateY(-2px)` visible en DevTools Computed — **REQ-005** → `SCN-002`
- `DgtLookupInput` input con `glass-input` `radius-full` — **REQ-008 (SCN-008)**
- Snapshot / Playwright `toHaveCSS('backdrop-filter', /blur/)` pasa

**Dependencia:** T-1.1  
**Estimación:** S  
**Paralelizable:** Sí — con T-1.2 (tras T-1.1)

---

### T-1.4 Migrar hardcodes hex → `var(--color-*)` — audit tokens

- [ ] T-1.4 Migrar hardcodes hex → `var(--color-*)` — audit tokens

**Descripción:** Refactorizar hex hardcodeados a tokens `var(--color-*)` en marketing/sections: `Hero style linear-gradient`, `Footer borderTop #0f3933`, `Pricing bg-shadow-teal/15`, `HowItWorks #23524c`.

**Archivos:**
- `front/src/components/sections/Hero.tsx:38-48`
- `front/src/components/sections/Footer.tsx:33,35`
- `front/src/components/sections/Pricing.tsx:88`
- `front/src/components/sections/HowItWorks.tsx:83-88`

**Criterio de aceptación:**
- `grep -R "#072724\|#0f3933\|#23524c" front/src --include="*.tsx" --include="*.css"` (excluyendo `@theme`) = 0 — **REQ-010, REQ-011** → `SCN-004`
- Colores via `var(--color-forest-depths)` / `var(--color-shadow-teal)` / Tailwind `bg-shadow-teal` (que resuelve a `var`) — **REQ-010**
- Build + Lighthouse a11y no regresa; contraste `pure-light #fff` sobre `forest-depths #072724` 16.2:1 y `mist-gray` sobre glass ~4.8:1 AA — **REQ-012** → `SCN-005`

**Dependencia:** T-1.1  
**Estimación:** S  
**Paralelizable:** Sí — con T-1.2/T-1.3

---

## 4. Fase T-2 — Monetización Stripe JWT

> Objetivo `specs/monetization-stripe-jwt.md`: dashboard refleja plan fresco <5s sin relogin; webhook idempotente 5 eventos; portal sin 400 falso.

### T-2.1 JWT refresh por `token.id` cada request — `lib/auth.ts`

- [ ] T-2.1 JWT refresh por `token.id` cada request — `lib/auth.ts`

**Descripción:** En `callbacks.jwt()` añadir rama `if (token?.id && !user) { dbUser = findUnique where id; token.plan/dbUser.plan }` antes de `return token`; preservar rama `if(user) where email` y `trigger==="update"`.

**Archivos:**
- `front/src/lib/auth.ts:50-71` — diff canónico `design.md §3.1`

**Criterio de aceptación:**
- Bloque `if (token?.id && !user)` con `prisma.user.findUnique({ where:{id: token.id}})` + copia `plan` + `stripeCustomerId` si `dbUser` no null, sin sobrescribir si null — **REQ-001, REQ-002, REQ-003** → `SCN-002`
- `session` callback expone `session.user.plan` fresco al siguiente request — **REQ-016** → `SCN-001`
- Unit mock prisma: `jwt({token:{id:"user_123",plan:"free"}, user:undefined})` → `findUnique` retorna `premium` → `token.plan==="premium"`

**Dependencia:** — (raíz)  
**Estimación:** S  
**Paralelizable:** Sí

---

### T-2.2 Endpoint `POST /api/auth/refresh` — forzador explícito

- [ ] T-2.2 Endpoint `POST /api/auth/refresh` — forzador explícito

**Descripción:** Crear `route.ts` que exige `auth()` (401 si no session), hace `findUnique where id=session.user.id`, loggea y retorna `{ok:true, plan}`.

**Archivos:**
- `front/src/app/api/auth/refresh/route.ts` — **NUEVO**

**Criterio de aceptación:**
- `POST` valida `auth()` → 401 si `!session.user.id`; 200 `{ok:true, plan}` si autenticado — **REQ-004, REQ-005** → `SCN-003`
- Log `[auth] refresh plan: <plan> for user <id>` — **REQ-005 (SHOULD)**
- No usa `!` assert; testeado 401/200 — **CA spec §4**

**Dependencia:** T-2.1  
**Estimación:** S  
**Paralelizable:** No

---

### T-2.3 Webhook hardening — 5 eventos + `PRICE_TO_PLAN` + idempotencia

- [ ] T-2.3 Webhook hardening — 5 eventos + `PRICE_TO_PLAN` + idempotencia

**Descripción:** Hardening `webhooks/stripe/route.ts`: guard `if(!STRIPE_WEBHOOK_SECRET) 500`, `checkout.session.completed` idempotente, `customer.subscription.updated` via tabla `PRICE_TO_PLAN` sin fallback, `deleted → free`, `invoice.paid` renewal no degrada, `payment_failed/past_due` solo warn.

**Archivos:**
- `front/src/app/api/webhooks/stripe/route.ts:20-89`
- `front/src/lib/stripe.ts:16-18` — validar env sin `!` + `STIPE_PLANS` + `PRICE_TO_PLAN: Record<string,PlanKey>`

**Criterio de aceptación:**
- Guard `STRIPE_WEBHOOK_SECRET` antes de `constructEvent` → 500 — **REQ-006** → `SCN-010`
- `checkout.session.completed` extrae `metadata.userId/plan` + `session.customer` → `update where id`; `!userId||!plan` → warn 200 sin throw; re-ejecutar mismo `session.id` no duplica — **REQ-007, REQ-011** → `SCN-004`
- `customer.subscription.updated` mapea `priceId` via `PRICE_TO_PLAN`; `price_unknown` → warn 200 sin update (no defaultea a `premium`) — **REQ-008, REQ-014, REQ-015** → `SCN-005`
- `customer.subscription.deleted` → `plan:"free"` — **REQ-009** → `SCN-006`
- `invoice.paid` → lookup `stripeCustomerId` → log renewal, no degrada — **REQ-010** → `SCN-007`
- `past_due` / `payment_failed` solo warn, no downgrade — **REQ-012 (SHOULD)** → `SCN-009`
- `lib/stripe.ts` throw legible `Missing STRIPE_* env` sin `!` — **REQ-014**

**Dependencia:** T-2.1  
**Estimación:** M  
**Paralelizable:** No — tras T-2.1

---

### T-2.4 Portal fix — `prisma` fresh no JWT stale

- [ ] T-2.4 Portal fix — `prisma` fresh no JWT stale

**Descripción:** Migrar `portal/route.ts:8` de `session.user.stripeCustomerId` a `prisma.user.findUnique where id=session.user.id`.

**Archivos:**
- `front/src/app/api/portal/route.ts:8`

**Criterio de aceptación:**
- `grep` no lee `session.user.stripeCustomerId` directo; lee DB — **REQ-013** → `SCN-008`
- Si `dbUser.stripeCustomerId` null → 400 `No subscription`; si existe → `billingPortal.sessions.create` 200 — **REQ-013**
- E2E `checkout → webhook → portal` sin relogin no da falso 400

**Dependencia:** T-2.1  
**Estimación:** S  
**Paralelizable:** Sí — con T-2.2

---

### T-2.5 PlanCard polling `?success=true` → `/api/auth/refresh`

- [ ] T-2.5 PlanCard polling `?success=true` → `/api/auth/refresh`

**Descripción:** Dashboard monta con `searchParams.success==="true"` → client `fetch POST /api/auth/refresh` + revalidate `PlanCard` badge premium <5s.

**Archivos:**
- `front/src/app/(protected)/dashboard/page.tsx` — `DashboardSuccessRefresh` client component
- `front/src/components/dashboard/PlanCard.tsx` — poll/refresh sin relogin

**Criterio de aceptación:**
- Flujo `success=true` triggerea `fetch POST /api/auth/refresh` client-side — **REQ-017 (SHOULD)** → `SCN-011`
- Siguiente `auth()`/`GET /dashboard` muestra `premium` en <5s tras webhook — **REQ-016** → `SCN-001`
- No requiere `session.update()` cliente; endpoint es suficiente

**Dependencia:** T-2.2  
**Estimación:** S  
**Paralelizable:** No

---

## 5. Fase T-3 — Chat Search Real

> Objetivo `specs/chat-search-real.md`: `"menos de 3000"` dispara en <3s con ≥3 coches agregados de 4 fuentes, `image_url` visible, `qwen3.7-plus` visión.

### T-3.1 Regex `detectCarSearch` OR + `k€` + `entre` + `detectVIN`

- [ ] T-3.1 Regex `detectCarSearch` OR + `k€` + `entre` + `detectVIN`

**Descripción:** Reemplazar AND estricto por OR logic + 8 `pricePatterns` (`k€`, `hasta`, `máximo/máx`, `entre X y Y`, `€/euros`, `por`, `presupuesto`), helper `parsePrice(k→000)`, `clamp entre`, ampliar `searchKeywords` ≥30, añadir `detectVIN` `/[A-HJ-NPR-Z0-9]{17}/` y `detectPlate` sin `A,E,I,O,U,Q,Ñ`.

**Archivos:**
- `front/src/app/api/chat/route.ts:14-52` — `detectCarSearch`, `detectPlate`, `detectVIN`, `parsePrice`
- `front/src/lib/validators.ts` — opcional re-export helpers

**Criterio de aceptación:**
- 8 patterns must: `menos de`, `hasta`, `máximo/máx`, `entre X y Y`, `k€`, `€/euros/eur`, `por`, `presupuesto/budget` — **REQ-001, REQ-002**
- `k`→`*1000` + strip `.,` antes de `parseInt`; `entre` captura `minPrice` + `maxPrice` — **REQ-002**
- `isSearch = hasSearchIntent || hasPriceOrYear || hasKPattern || hasModeloConocido`; `hasPriceOrYear && !hasSearchIntent` → `isSearch=true` — **REQ-003**
- `searchKeywords` ≥30 inc. `suv/berlina/diésel/eléctrico/seat/bmw…` — **REQ-004**
- `hasPriceOrYear = maxPrice!==undef || /\b20\d{2}\b/.test` — **REQ-005**
- `detectPlate` `/\b\d{4}[\s-]?[BCDFGHJKLMNPRSTVWXYZ]{3}\b/i` → `1234-BCD` upper con guion — **REQ-006**
- `detectVIN` `/\b[A-HJ-NPR-Z0-9]{17}\b/i` sin I,O,Q — **REQ-007**
- 20 fixtures `vitest` 100% `isSearch` correcto — **CA spec §4** → `SCN-001..005` (incl. `"menos de 3000"` sin coche → `isSearch true`, `"en 2024 me casé"` → false)

**Dependencia:** — (raíz)  
**Estimación:** M  
**Paralelizable:** No — bloquea T-3.2/T-3.3

---

### T-3.2 Scrape `milanuncios` + `gather` paralelo + fixes + `SoupStrainer`

- [ ] T-3.2 Scrape `milanuncios` + `gather` paralelo + fixes + `SoupStrainer`

**Descripción:** Implementar `_scrape_milanuncios`, `asyncio.gather` 4 fuentes `return_exceptions True`, `timeout 12s + retry 1× 500ms`, `clamp 1..12`, dedupe por `url`, rank por `score/price`, fix `noise` sin números, URL builder robusto `autoscout` `quote` + fallback `?keywords=`, `wallapop` lat/lon dinámico por ciudad, `image_url` siempre, `HEADERS br`, `SoupStrainer`.

**Archivos:**
- `server/routers/scrape.py:11-260` — `HEADERS`, `CITY_COORDS`, `_city_coords`, `_parse_price`, `scrape_cars`, `_scrape_with_retry`, `_scrape_autoscout24`, `_scrape_cochesnet`, `_scrape_wallapop`, `_scrape_milanuncios` (**NUEVO**)
- `server/models/schemas.py` — `CarResult.image_url`, `ScrapeRequest` `min_price/max_km` ya existente

**Criterio de aceptación:**
- `HEADERS` con `Accept-Encoding gzip, deflate, br` + rotación UA mínima 2 variantes — **REQ-008** → `SCN-006`
- `max_results` clamp `max(1,min(12))` — **REQ-009**
- `gather` 4 fuentes `autoscout24/cochesnet/wallapop/milanuncios` paralelo `return_exceptions=True` + `flat` + `dedupe url` — **REQ-010** → `SCN-006`
- `timeout 12s` + `retry 1× 500ms` en `HTTPError` — **REQ-011**
- `autoscout noise` sin números, solo stopwords — **REQ-012**
- `autoscout` URL robusta `slugify + quote`; `suv familiar` no genera `/lst/suv/familiar` 404 sino fallback `?keywords=` — **REQ-013** → `SCN-008`
- `autoscout` params `priceto/pricefrom/cy/km` soportados — **REQ-014**
- `cochesnet noise` sin `"2000","3000"…` — **REQ-015** → `SCN-007`
- `cochesnet Keywords=clean_query` — **REQ-016**
- `wallapop` lat/lon map `madrid/barcelona/valencia/sevilla` + fallback Madrid — **REQ-017** → `SCN-009`
- `wallapop __NEXT_DATA__` + fallback `ItemCard` + `SoupStrainer script#__NEXT_DATA__` — **REQ-018**
- `_scrape_milanuncios` `GET milanuncios.com/coches-de-segunda-mano/?precio-hasta={max_price}` `SoupStrainer("article")` `article.ma-AdCardV2` fallback `div.ad-card` — **REQ-019, REQ-020** → `SCN-010`
- Cada `_scrape_*` popula `image_url` cuando existe — **REQ-021** → `SCN-010`
- `CarResult.price int` preservado, display formatea en cliente — **REQ-022**
- `ruff check server/` pasa; `POST /scrape source auto max_price 3000` → `total ≥1` con `image_url ≥50%`

**Dependencia:** T-3.1  
**Estimación:** L  
**Paralelizable:** No — es el cuello de botella

---

### T-3.3 Chat route `CarResult[]` tipado + `image_url` + cards stream

- [ ] T-3.3 Chat route `CarResult[]` tipado + `image_url` + cards stream

**Descripción:** `searchBackend` con `AbortController 12s` + `max_results clamp`, `chat/route` devuelve `CarResult[]` tipado `price:number image_url` + `markdown` context + `extraData.cars` vía `createUIMessageStreamResponse data` o `tool` parts; corregir `types/index.ts` `price:number`.

**Archivos:**
- `front/src/app/api/chat/route.ts:56-73,139-143` — `searchBackend`, context `Resultados (N coches)`, `extraData`
- `front/src/types/index.ts:3-12` — `CarResult price:number + image_url?:string`
- `front/src/components/chat/CarResultCard.tsx:6-72` — `image_url` con `next/image` fallback `<img>`, `price es-ES`, `source badge`, `score bar`, `rel noopener`

**Criterio de aceptación:**
- `searchBackend` envía `max_results clamp 1..12` + `max_price` + `AbortController 12s` — **REQ-023**
- `chat/route` mapea `extraData = { cars: results.map(c=>({…c, image_url: c.image_url ?? null})) }` + markdown `1. **title** — 5.500€ | 2019 | … | Fuente | url` — **REQ-024** → `SCN-011`
- `types/index.ts` `CarResult price:number` (no string) `year/km:number` + `image_url` — **REQ-025** → `SCN-015`
- `CarResultCard` muestra `image_url`, `title Teodor 28px`, `price es-ES`, `source badge`, `score gradient`, `max-w-[320px]` sin romper layout; links `target _blank rel noopener` — **REQ-027, REQ-031** → `SCN-011`
- `max_results` clamp defensivo + log `[chat] search results: <total>` — **REQ-032 (SHOULD)**

**Dependencia:** T-3.1, T-3.2  
**Estimación:** M  
**Paralelizable:** No — tras T-3.2

---

### T-3.4 MessageList `tool`/`data` parts → `CarResultCard` grid

- [ ] T-3.4 MessageList `tool`/`data` parts → `CarResultCard` grid

**Descripción:** `MessageList:60-65` mapea `part.type==="data" && data.cars` o `tool-invocation searchCars` → `grid gap-3 CarResultCard`; `MessageBubble` soporta `dgt-guide` type.

**Archivos:**
- `front/src/components/chat/MessageList.tsx:60-65`
- `front/src/components/chat/MessageBubble.tsx:25`

**Criterio de aceptación:**
- Render `CarResultCard` cuando `part.type==="data" && part.data?.cars` o `tool-invocation` — **REQ-026** → `SCN-011`
- `grid gap-3` con cada `<a href url target _blank rel noopener>` — **REQ-026, REQ-031**
- Playwright `expect(page.locator('a[href*="coches.net"]')).toBeVisible()` pasa
- No regresa render `text` plano solo

**Dependencia:** T-3.3  
**Estimación:** S  
**Paralelizable:** No

---

### T-3.5 `next.config` `images.remotePatterns` 5 hosts

- [ ] T-3.5 `next.config` `images.remotePatterns` 5 hosts

**Descripción:** Whitelist `**.autoscout24.es`, `**.coches.net`, `**.wallapop.com`, `**.milanuncios.com`, `cdn.milanuncios.com` en `images.remotePatterns`.

**Archivos:**
- `front/next.config.ts`

**Criterio de aceptación:**
- `images.remotePatterns` con 5 hosts exactos — **REQ-028** → `SCN-012`
- `npm run build --prefix front` con `https://cdn.milanuncios.com/foto.jpg` no 400 — **CA spec §4**
- Fallback `<img>` si `next/image` 403 aún muestra imagen

**Dependencia:** T-3.3  
**Estimación:** S  
**Paralelizable:** Sí — con T-3.4 (paralelo tras T-3.3)

---

### T-3.6 Modelo `qwen3.7-plus` + `experimental_attachments` visión

- [ ] T-3.6 Modelo `qwen3.7-plus` + `experimental_attachments` visión

**Descripción:** `lib/ai.ts:15` `CHAT_MODEL = OPENCODE_MODEL ?? "qwen3.7-plus"` con fallback `deepseek-v4-pro`; `ChatWindow` `useChat experimental_attachments:true` + `convertToModelMessages` preserva `image` parts; `.env.local:13` `OPENCODE_MODEL=qwen3.7-plus`.

**Archivos:**
- `front/src/lib/ai.ts:15`
- `front/.env.local:13`
- `front/src/components/chat/ChatWindow.tsx:3-57`

**Criterio de aceptación:**
- `CHAT_MODEL` env var con fallback qwen → deepseek — **REQ-029** → `SCN-014`
- `.env.local` setea `OPENCODE_MODEL=qwen3.7-plus` — **REQ-029**
- `ChatWindow` `experimental_attachments:true` + `convertToModelMessages` preserva `image` part — **REQ-030** → `SCN-013`
- `streamText opencode(CHAT_MODEL)` usa qwen cuando env, deepseek si vacío

**Dependencia:** T-3.3  
**Estimación:** S  
**Paralelizable:** Sí — con T-3.5

---

## 6. Fase T-4 — DGT Didáctico

> Objetivo `specs/dgt-didactic.md`: legal (no scrape DGT), 3 cards didácticas + detector VIN/matrícula en chat.

### T-4.1 Flag `source mock|real` + banner Demo/Oficial

- [ ] T-4.1 Flag `source mock|real` + banner Demo/Oficial

**Descripción:** `dgt.py`/`carvertical.py`/`carfax.py` determinan `source` por `MOCK_DGT` + `DGT_API_KEY` env; `dgt/lookup proxy` propaga `source`; `DgtLookupInput` badge `Demo — datos de ejemplo` vs `Oficial — DGT`.

**Archivos:**
- `server/routers/dgt.py:12-44` — `MOCK = MOCK_DGT=="true" or !DGT_API_KEY`
- `server/routers/carvertical.py:19-35`, `carfax.py:19-34`
- `front/src/app/api/dgt/lookup/route.ts:6` — `PLATE_REGEX` `^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$` sin A,E,I,O,U,Q,Ñ
- `front/src/components/dashboard/DgtLookupInput.tsx:55-115` — banner + `Badge`

**Criterio de aceptación:**
- `source` `mock` si `MOCK_DGT true` o falta `DGT_API_KEY`, `real` si key presente — **REQ-006, REQ-007**
- `carvertical/carfax` igual mock vs real — **REQ-007**
- `DgtLookupInput` muestra `Badge Demo` + texto demostración si `mock`, `Oficial` si `real` — **REQ-008** → `SCN-003, SCN-009`
- `PLATE_REGEX` valida sin `A,E,I,O,U,Q,Ñ` — **REQ-009** → `SCN-003`

**Dependencia:** — (raíz, pero ideal tras T-3.1)  
**Estimación:** S  
**Paralelizable:** Sí — con T-3.2

---

### T-4.2 3 cards didácticas `DGTGuideCard` + `CarVerticalCard` + `CarfaxCard`

- [ ] T-4.2 3 cards didácticas `DGTGuideCard` + `CarVerticalCard` + `CarfaxCard`

**Descripción:** Crear 3 componentes `glass-card` reutilizables con props `{vin?, plate?}`: DGT 8,67€ 4 pasos + `href sede.dgt`, CarVertical ~15€ VIN, Carfax ~20€ VIN. Mostrar grid `md:grid-cols-3 gap-6 mt-8` en dashboard (educativo permanente `SHOULD`).

**Archivos:**
- `front/src/components/dgt/DGTGuideCard.tsx` — **NUEVO** — badge `Oficial DGT — 8,67€ (tasa 4.1)` + `ol` 4 pasos + `btn-primary Ir a Sede DGT`
- `front/src/components/dgt/CarVerticalCard.tsx` — **NUEVO** — `~15€` + beneficios km/accidentes/robos/taxi + link `carvertical.com`
- `front/src/components/dgt/CarfaxCard.tsx` — **NUEVO** — `~20€` + link `carfax.eu`
- `front/src/app/(protected)/dashboard/page.tsx` — grid 3 cols debajo de `DgtLookupInput`

**Criterio de aceptación:**
- `DGTGuideCard` `glass-card` + badge + `ol` 4 pasos numerados (sede.dgt → Cl@ve → tasa 4.1 → PDF) + botón `href https://sede.dgt.gob.es/es/vehiculos/informe-de-vehiculo/ target _blank rel noopener` — **REQ-001, REQ-002, REQ-014** → `SCN-001, SCN-008`
- `CarVerticalCard` `~15€` + link `carvertical.com` — **REQ-003, REQ-005**
- `CarfaxCard` `~20€` + link `carfax.eu` — **REQ-004, REQ-005**
- 3 cards props `{vin?, plate?}` prefill — **REQ-005**
- Dashboard grid `md:grid-cols-3 gap-6 mt-8` siempre visible (educativo) — **REQ-015 (SHOULD)** → `SCN-001`
- `grep -R "fetch.*sede.dgt" front server` = 0 (solo `<a href>`) — **REQ-013** → `SCN-007`

**Dependencia:** T-1.1, T-4.1  
**Estimación:** M  
**Paralelizable:** No

---

### T-4.3 Chat `detectPlate/VIN` → bloque 3 opciones + render cards

- [ ] T-4.3 Chat `detectPlate/VIN` → bloque 3 opciones + render cards

**Descripción:** `chat/route` detecta `detectPlate` + `detectVIN` `/\b[A-HJ-NPR-Z0-9]{17}\b/i` en último mensaje → `lookupDgt` mock banner + `contextData ## Opciones de historial` 3 links + instruye LLM; `MessageList/MessageBubble` renderiza 3 cards cuando `part type dgt-guide` o `data.dgtOptions`.

**Archivos:**
- `front/src/app/api/chat/route.ts:52` — `detectPlate`, `detectVIN`, `lookupDgt`, `contextData`
- `front/src/components/chat/MessageList.tsx`, `MessageBubble.tsx` — `part.type==="dgt-guide"` + `data.dgtOptions`

**Criterio de aceptación:**
- `detectPlate` regex sin `A,E,I,O,U,Q,Ñ`; `detectVIN` `/[A-HJ-NPR-Z0-9]{17}/` sin I,O,Q — **REQ-010** → `SCN-005, SCN-006`
- Al detectar plate/VIN, `contextData` añade `## Opciones de historial — DGT oficial 8,67€ / CarVertical ~15€ / Carfax ~20€` + LLM instrucción — **REQ-011** → `SCN-004, SCN-005`
- `MessageList` renderiza `DGTGuideCard + CarVerticalCard + CarfaxCard` cuando `part type dgt-guide` o `data.dgtOptions` presente — **REQ-012** → `SCN-004`
- `VIN WVWZZZ1JZ3W386752` detecta, `WVWZZZ1QZ…` con Q no — **REQ-010** → `SCN-006`
- Links externos `rel noopener noreferrer` — **REQ-014**

**Dependencia:** T-3.1, T-4.2  
**Estimación:** M  
**Paralelizable:** No

---

## 7. Fase T-5 — Cat Layers Animation

> Objetivo `specs/cat-animation-layers.md`: 4 grupos SVG físicos + spring diferencial, 60fps solo `transform`.

### T-5.1 Separar SVG en 4 grupos con `id` — `AutoMishoCat.tsx`

- [ ] T-5.1 Separar SVG en 4 grupos con `id` — `AutoMishoCat.tsx`

**Descripción:** Refactor `280px` SVG: crear `<g id="head">` cabeza completa, `<g id="eyes">` contenedor, `<g id="iris-left/right">` iris individual, `<g id="pupil-left/right">` pupilas + `<g id="eyelids">` o `scaleY` en iris.

**Archivos:**
- `front/src/components/icons/AutoMishoCat.tsx:1-384`

**Criterio de aceptación:**
- DOM contiene `id="head"`, `id="eyes"`, `id="iris-left"`, `id="iris-right"`, `id="pupil-left"`/`pupil-right"` o `id="pupils"`, `id="eyelids"` o `scaleY` en iris — **REQ-001, REQ-002** → `SCN-001`
- `size=280` prop preservada `width/height viewBox 0 0 280 280` — **REQ-010** → `SCN-008`
- `defs` `metalBody/metalHead/eyeGlow/mintGlow/eyeGlowFilter` sin regresión + `drop-shadow(0 0 30px mint/15)` — **REQ-011**
- `grep -R "eyeOffsetX\*4" AutoMishoCat.tsx` vacío (viejo translate eliminado) — **CA spec §4**

**Dependencia:** — (raíz)  
**Estimación:** S  
**Paralelizable:** Sí

---

### T-5.2 `useMotionValue` + `useSpring` iris 3px / pupil 1.5px / head 0.8°

- [ ] T-5.2 `useMotionValue` + `useSpring` iris 3px / pupil 1.5px / head 0.8°

**Descripción:** Wiring `useMotionValue(0)` `mouseX/Y -1..1 /300` + `useSpring(180,18)` + `useTransform` `iris clamp 3px`, `pupil 1.5px`, `head 0.8deg`; `mousemove` `clamp(-1,1, (clientX-centerX)/300)` → `mouseX.set(dx)`; `body 0.3` `legs 0.2` vía `useTransform`.

**Archivos:**
- `front/src/components/icons/AutoMishoCat.tsx`

**Criterio de aceptación:**
- Importa `useMotionValue`, `useSpring`, `useTransform`, `motion` de `framer-motion` con `stiffness 180 damping 18` — **REQ-003** → `SCN-002`
- `mousemove` calcula `dx clamp -1..1 /300` y `set(dx)`, no `setState` render — **REQ-004**
- `irisX = useTransform(springX, v=> clamp -3..3 v*3)` — **REQ-005** → `SCN-003`
- `pupilX = clamp -1.5..1.5 v*1.5` diferencial — **REQ-006** → `SCN-003`
- `headRotate = v*0.8` con `transformOrigin 140px 110px` — **REQ-007** → `SCN-004` (no `*8` directo)
- `body *0.3` `legs *0.2` vía `useTransform` — **REQ-008 (SHOULD)**
- Cada capa `motion.g` no `g transform translate` estático — **REQ-015 (SHOULD)**

**Dependencia:** T-5.1  
**Estimación:** M  
**Paralelizable:** No

---

### T-5.3 Blink `scaleY 0.1` 150 ms + `will-change` 60fps + `prefers-reduced-motion`

- [ ] T-5.3 Blink `scaleY 0.1` 150 ms + `will-change` 60fps + `prefers-reduced-motion`

**Descripción:** Preservar `blinkState` `scaleY 0.1` 150 ms cada `3000+rand 3000` via `motion.g animate`; `will-change: transform` + `translateZ(0)` GPU; `prefers-reduced-motion: reduce` desactiva spring/clamp 0.

**Archivos:**
- `front/src/components/icons/AutoMishoCat.tsx`
- `front/src/app/globals.css` — opcional `will-change` utility

**Criterio de aceptación:**
- `blinkState` `setTimeout 3000+random*3000` + `scaleY 0.1` 150 ms con `transformOrigin center` — **REQ-009** → `SCN-005`
- `will-change: transform` + `translateZ(0)` en `motion.g` head/iris/pupil — **REQ-012** → `SCN-006`
- Chrome Performance 5s animado `FPS ≥55` (target 60) sin layout thrash (solo `transform/opacity`) — **REQ-012** → `SCN-006`
- Containment `socket r14 + iris r10 + offset 3 + pupil 1.5 = 8.5 <14` nunca sale — **REQ-014** → `SCN-007`
- `prefers-reduced-motion: reduce` clamp 0 sin translate — **REQ-013** → `SCN-009`

**Dependencia:** T-5.2  
**Estimación:** S  
**Paralelizable:** No

---

## 8. Fase T-6 — Security Hardening

> Objetivo `specs/security-hardening.md`: `zod` runtime + rate-limit + CSP + secrets + `rel noopener`.

### T-6.1 `zod` schemas centralizados + validación todas las routes

- [ ] T-6.1 `zod` schemas centralizados + validación todas las routes

**Descripción:** Crear `lib/validators.ts` con `ChatBody`, `CheckoutBody`, `PlateBody`, `RegisterBody`, `ScrapeProxyBody`; cada `route.ts` `safeParse` → 400 `fieldErrors` antes de `prisma/stripe`.

**Archivos:**
- `front/src/lib/validators.ts` — **NUEVO**
- `front/src/app/api/chat/route.ts` — `ChatBody`
- `front/src/app/api/checkout/route.ts` — `CheckoutBody`
- `front/src/app/api/portal/route.ts` — opcional guard
- `front/src/app/api/dgt/lookup/route.ts` — `PlateBody`
- `front/src/app/api/register/route.ts` + `front/src/app/api/conversations/route.ts` — `RegisterBody`

**Criterio de aceptación:**
- `lib/validators.ts` expone `ChatBody = z.object({messages:z.array(z.any()).min(1), conversationId:z.string().uuid().optional()})` + `CheckoutBody z.enum(["premium","pro"])` + `PlateBody z.string().regex(/^\d{4}[BCDFGHJ-NPRSTVWXYZ]{3}$/i)` + `RegisterBody email+min8` — **REQ-001, REQ-002** → `SCN-001..004`
- Cada route importa y `safeParse` → `400 {error: flatten().fieldErrors}` antes de lógica — **REQ-003**
- `messages:"no-array"` → 400 no llega a `prisma`; `plan:"enterprise"` → 400 — **REQ-001** → `SCN-001, SCN-003`

**Dependencia:** T-2.2, T-3.3, T-4.1 (routes ya congeladas)  
**Estimación:** M  
**Paralelizable:** No — debe ir al final tras freeze de routes

---

### T-6.2 Rate-limit middleware `10/min` (20 premium) + flag `RATE_LIMIT_ENABLED`

- [ ] T-6.2 Rate-limit middleware `10/min` (20 premium) + flag `RATE_LIMIT_ENABLED`

**Descripción:** `middleware.ts` con `@upstash/ratelimit` o `arcjet` `slidingWindow(10,"1 m")` key `ip+userId` + bypass premium 20/min + `429 Retry-After` + matcher `chat/dgt/search/register/checkout`.

**Archivos:**
- `front/src/middleware.ts` — **NUEVO** (o `lib/rate-limit.ts` + middleware)
- `front/package.json` — `+ @upstash/ratelimit @upstash/redis` o `arcjet`

**Criterio de aceptación:**
- Free `10 req/min` por `ip+userId` (o `ip` si no auth) → 11º `429 {error:"Too many requests"} Retry-After` — **REQ-004, REQ-005** → `SCN-005`
- Premium `20/min` bypass vía header/plan hint — **REQ-006 (SHOULD)** → `SCN-005`
- `RATE_LIMIT_ENABLED=false` desactiva todo → 100 req sin 429 — **REQ-007** → `SCN-006`
- Sin redis/ Upstash URL → bypass (dev) sin crash
- Matcher no cubre `portal/webhooks` (Stripe reintenta)

**Dependencia:** T-6.1  
**Estimación:** M  
**Paralelizable:** No

---

### T-6.3 CSP + security headers en `next.config` — `next.config.ts`

- [ ] T-6.3 CSP + security headers en `next.config` — `next.config.ts`

**Descripción:** `async headers()` con `Content-Security-Policy default-src 'self' script-src 'self' unsafe-eval unsafe-inline style-src 'self' unsafe-inline img-src 'self' data: https: connect-src 'self' opencode.ai/stripe frame-ancestors 'none'` + `X-Content-Type-Options nosniff` + `X-Frame-Options DENY` + `Referrer-Policy`.

**Archivos:**
- `front/next.config.ts`

**Criterio de aceptación:**
- `Content-Security-Policy` contiene `default-src 'self'` + `img-src 'self' data: https:` + `frame-ancestors 'none'` — **REQ-008, REQ-009** → `SCN-007`
- `X-Content-Type-Options: nosniff` + `X-Frame-Options: DENY` + `Referrer-Policy strict-origin-when-cross-origin` presentes — **REQ-008**
- `npm run build --prefix front` pasa (Tailwind requiere `unsafe-inline`); Lighthouse `best-practices` no violado — **REQ-009** → `SCN-008`
- `SHOULD report-only` primero si riesgo, luego enforce — **REQ-010 (SHOULD)**

**Dependencia:** — (raíz)  
**Estimación:** S  
**Paralelizable:** Sí — con T-3.5 (mismo archivo: coordinar merge)

---

### T-6.4 `.env.example` + `.gitignore` + `docs/SECRETS_ROTATION.md`

- [ ] T-6.4 `.env.example` + `.gitignore` + `docs/SECRETS_ROTATION.md`

**Descripción:** Crear `.env.example` placeholders sin secretos reales + verificar `.gitignore` + docs rotación `openssl rand` para `NEXTAUTH_SECRET` y rotar `STRIPE/GOOGLE/DATABASE_URL/OPENCODE`.

**Archivos:**
- `front/.env.example` — **NUEVO** — 13 vars placeholders (`NEXTAUTH_SECRET=`, `GOOGLE_CLIENT_ID=`, `STRIPE_SECRET_KEY=sk_test_...`, `OPENCODE_MODEL=qwen3.7-plus`, `MOCK_DGT=true`, `UPSTASH_*`, `RATE_LIMIT_ENABLED=true`)
- `front/.gitignore` — verifica `.env.local` + `.env`
- `docs/SECRETS_ROTATION.md` — **NUEVO**

**Criterio de aceptación:**
- `.env.example` con placeholders sin `sk_test` real ni `whsec` real — **REQ-011** → `SCN-009`
- `.gitignore` contiene `.env.local` + `.env` ; `git ls-files | grep .env.local` vacío — **REQ-012** → `SCN-010`
- `git grep -i "sk_test\|NEXTAUTH_SECRET" --cached` vacío; `gitleaks detect --no-git` 0 leaks — **REQ-013** → `SCN-014`
- `docs/SECRETS_ROTATION.md` con `openssl rand -base64 32` + rotación `STRIPE sk_test` + `GOOGLE_CLIENT_SECRET` + `DATABASE_URL` + redeploy — **REQ-014**

**Dependencia:** —  
**Estimación:** S  
**Paralelizable:** Sí

---

### T-6.5 `rel="noopener noreferrer"` en todos los links externos

- [ ] T-6.5 `rel="noopener noreferrer"` en todos los links externos

**Descripción:** Auditar todos `<a target="_blank">` en `DGTGuideCard`, `CarVerticalCard`, `CarfaxCard`, `CarResultCard`, `MessageBubble` + futuro `react-markdown` con `rehype-sanitize` bloqueando `javascript:` urls.

**Archivos:**
- `front/src/components/dgt/DGTGuideCard.tsx`, `CarVerticalCard.tsx`, `CarfaxCard.tsx`
- `front/src/components/chat/CarResultCard.tsx`
- `front/src/components/chat/MessageBubble.tsx`
- `front/src/lib/validators.ts` / `MessageBubble` sanitize comment

**Criterio de aceptación:**
- `grep -R 'target="_blank"' front/src --include="*.tsx" | grep -v 'rel='` = 0 — **REQ-015** → `SCN-011`
- Cada link externo `target="_blank" rel="noopener noreferrer"` o `rel="noopener"` — **REQ-015**
- `server/main.py:20-30` CORS restringido `allow_origins` explícito `[localhost:3000, vercel-domain]` no `*` con `allow_credentials True` — **REQ-016** → `SCN-012`
- `Wallapop json.loads` con `MAX_JSON_BYTES 1M` — **REQ-017 (SHOULD)**
- `MessageBubble` futuro `react-markdown` con `rehype-sanitize` no permite `javascript:` — **REQ-018 (SHOULD/MUST)** → `SCN-013`

**Dependencia:** T-4.2, T-3.4  
**Estimación:** S  
**Paralelizable:** No

---

## 9. Review Workload Forecast

| Métrica | Valor |
|---------|-------|
| **Estimado líneas netas** | **650–800** (sin `node_modules`/`package-lock`, ~720 centro) |
| **Desglose por pilar** | Glass ~80 · Monet ~90 · Chat regex ~40 · Scrape ~180 · Chat cards/images/qwen ~120 · DGT didáctico ~90 · Cat ~70 · Security ~90 |
| **Archivos tocados** | ~32 (ver `design.md §10.1` mapa completo) |
| **Chained PRs recommended** | **No** — `single-pr + size:exception` ya aprobado, ilimitado. Overlap `globals.css` + `chat/route.ts` + `scrape.py` haría 3 PRs con conflictos cruzados. |
| **400-line budget risk** | **High pero autorizado** — el PR excede 400 líneas por diseño; pre-aprobado en `proposal.md §9`. Mitigación: review por pilar (6 secciones) + CI verde por fase + rollback granular §9.3. |
| **Estrategia review** | Revisar en orden rollout T-1→T-6 (6 chunks lógicos). Cada fase tiene CI gate independiente (`glass` visual, `jwt` e2e Stripe CLI, `scrape` smoke `curl /scrape`, `cat` perf, `security` `curl -I CSP`). Reviewer puede aprobar pilar a pilar sin esperar PR completo. |
| **QA manual** | Stripe test `price_1U62vu`/`price_1U62wc` + `whsec_` · 20 fixtures lingüísticos chat · `POST /scrape` 4 fuentes · DGT `1234BCD` + VIN `WVWZZZ1JZ3W386752` · cat hover desktop + mobile · `gitleaks` |
| **Tiempo review estimado** | 60–90 min para reviewer senior (10 min por pilar × 6 + 15 min integración) |

> **Nota:** `single-pr` no significa review monolítico. El breakdown T-1…T-6 está diseñado para que cada fase sea *reviewable* como commit lógico separado dentro del mismo PR (commits atómicos por task).

---

## 10. Checklist global — criterios de done

- [ ] Cada `specs/*.md` tiene **al menos un REQ** cubierto por una task (trazabilidad 100%)
- [ ] Todas las tasks con checkbox `- [ ] T-X.Y` hierárquico (regla `openspec/config.yaml`)
- [ ] Cada task completable en una sesión (S/M/L auditado)
- [ ] `npm run build --prefix front` y `npm test --prefix front` verdes post `T-6`
- [ ] `grep -R "#072724\|#0f3933\|#23524c" front/src --include="*.tsx"` = 0
- [ ] `stripe trigger checkout.session.completed` → `GET /dashboard?success=true` muestra premium sin relogin
- [ ] `"menos de 3000"` y 20 fixtures disparan `isSearch` 100% en `vitest`
- [ ] `POST /scrape {max_price:3000}` → `total ≥1` agregado 4 fuentes en <3s con `image_url ≥50%`
- [ ] `DGTGuideCard` `href sede.dgt.gob.es` con `rel noopener` + `grep fetch.*sede.dgt` = 0
- [ ] `AutoMishoCat` `id="head"` + `useSpring 180/18` + `iris 3px / pupil 1.5px` + `FPS ≥55`
- [ ] `next.config` `images.remotePatterns` 5 hosts + CSP headers presentes `curl -I`
- [ ] `gitleaks detect --no-git` 0 leaks; `git ls-files | grep .env.local` vacío
- [ ] Lighthouse `a11y` dashboard + chat ≥95

---

## 11. Referencias

- `exploration.md` — diagnóstico por pilar (tokens, JWT bug, regex, scraping, cat, seguridad)
- `proposal.md` — scope IN/OUT + approach §4 + alternativas §5 + rollback §8 + métricas §7
- `design.md` — tokens glass §2 + secuencias mermaid §3 + ADRs §4 + componentes §5 + security §6 + testing §8 + rollout §9
- `specs/visual-liquid-glass.md` — 15 REQs + 8 SCN
- `specs/monetization-stripe-jwt.md` — 17 REQs + 11 SCN
- `specs/chat-search-real.md` — 32 REQs + 15 SCN
- `specs/dgt-didactic.md` — 16 REQs + 9 SCN
- `specs/cat-animation-layers.md` — 15 REQs + 9 SCN
- `specs/security-hardening.md` — 19 REQs + 14 SCN
- `openspec/config.yaml` — reglas tasks: hierarchical numbering, group by phase, completable en una sesión
- `front/.opencode/DESIGN.md` — Hyper Foundation source

---

*Generado 2026-08-20 — `sdd-tasks` worker directo. Siguiente fase: `sdd-apply` por task atómica respetando orden T-1→T-6.*
