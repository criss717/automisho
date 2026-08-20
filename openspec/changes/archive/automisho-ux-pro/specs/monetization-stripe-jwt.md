# Spec Delta — monetization-stripe-jwt

**Change:** `automisho-ux-pro`
**Delta:** `monetization-stripe-jwt`
**Status:** proposed
**Source:** `exploration.md` §2, `proposal.md` §2.2 + §4.2, `front/src/lib/auth.ts:50-71`, `front/src/app/api/checkout/route.ts`, `front/src/app/api/portal/route.ts:8`, `front/src/app/api/webhooks/stripe/route.ts`, `front/src/lib/stripe.ts:16-18`, `front/.env.local:19-25`
**Stack:** NextAuth v5 beta (jwt strategy) + Prisma 7 + Stripe SDK + `unstable_update`

---

## 1. Objetivo

Corregir el **funnel de monetización roto**: hoy `jwt()` solo refresca `token.plan` en sign-in y permanece stale `free` 30 días aunque `prisma.user.plan==="premium"` tras webhook. Este delta **MUST** garantizar que dashboard/portal reflejen plan fresco en <5s sin relogin, con webhook idempotente y portal leyendo DB.

---

## 2. Requerimientos (RFC 2119)

| ID | Requerimiento | Keyword | Archivo(s) |
|----|---------------|---------|------------|
| REQ-001 | `callbacks.jwt()` **MUST** refrescar `token.plan` y `token.stripeCustomerId` desde DB en **cada request autenticado** cuando `token.id` existe y `user` es undefined, vía `prisma.user.findUnique({ where: { id: token.id } })` | MUST | `front/src/lib/auth.ts:50-71` |
| REQ-002 | El refresh **MUST** ocurrir antes de `return token` y **MUST NOT** sobrescribir si `dbUser` es null; **MUST** copiar `dbUser.plan` (enum `free|premium|pro`) y `dbUser.stripeCustomerId` a `token` | MUST | `front/src/lib/auth.ts` |
| REQ-003 | Si `user` existe (primer sign-in) el flujo existente `findUnique where email` **MUST** permanecer, y el refresh por `token.id` **MUST** estar en rama separada `if (token?.id && !user)` | MUST | `front/src/lib/auth.ts` |
| REQ-004 | El sistema **MUST** exponer `POST /api/auth/refresh` que **MUST** requerir `auth()` (401 si no session) y **MUST** forzar re-evaluación del JWT (vía `unstable_update` de NextAuth v5 o refetch `prisma.user` + retrigger `jwt` ) y retornar `{ ok:true, plan }` | MUST | `front/src/app/api/auth/refresh/route.ts` (nuevo) |
| REQ-005 | `/api/auth/refresh` **MUST** validar método POST y **SHOULD** loggear `[auth] refresh plan: <plan> for user <id>` | MUST/SHOULD | mismo |
| REQ-006 | `POST /api/webhooks/stripe` **MUST** retornar `500` si `!process.env.STRIPE_WEBHOOK_SECRET` antes de `constructEvent` (guard explícito, no `!` assert) | MUST | `front/src/app/api/webhooks/stripe/route.ts:20-24` |
| REQ-007 | El webhook **MUST** manejar `checkout.session.completed` idempotente: extraer `session.metadata.userId` y `session.metadata.plan`, luego `prisma.user.update where id=userId data{plan, stripeCustomerId: session.customer}`; si `!userId || !plan` **MUST** log warn y retornar 200 sin throw | MUST | `front/src/app/api/webhooks/stripe/route.ts:33-46` |
| REQ-008 | El webhook **MUST** manejar `customer.subscription.updated`: mapear `subscription.items.data[0].price.id` a plan vía tabla explícita `PRICE_TO_PLAN: Record<string, PlanKey>` (ej. `{ [STRIPE_PREMIUM_PRICE_ID]:"premium", [STRIPE_PRO_PRICE_ID]:"pro" }`); si `priceId` desconocido **MUST** log warn y **MUST NOT** defaultear a `premium`; retorna 200 | MUST | `front/src/app/api/webhooks/stripe/route.ts:49-61` |
| REQ-009 | El webhook **MUST** manejar `customer.subscription.deleted`: `prisma.user.update where stripeCustomerId data{plan:"free"}` | MUST | `front/src/app/api/webhooks/stripe/route.ts:64-72` |
| REQ-010 | El webhook **MUST** manejar `invoice.paid`: lookup `customerId = invoice.customer` → `prisma.user.findUnique where stripeCustomerId` → si existe, **MUST NOT** degradar plan, solo log renewal; si no existe, log warn | MUST | `front/src/app/api/webhooks/stripe/route.ts` (nuevo case) |
| REQ-011 | El webhook **MUST** ser idempotente: repetir `checkout.session.completed` con mismo `session.id` **MUST NOT** crear duplicado ni throw; re-ejecutar `prisma.user.update` con mismos valores es aceptable; **SHOULD** deduplicar por `event.id` si se persiste | MUST/SHOULD | `front/src/app/api/webhooks/stripe/route.ts` |
| REQ-012 | El webhook **SHOULD** manejar `customer.subscription.past_due` y `invoice.payment_failed` sin downgrade inmediato, solo log y métrica; downgrade solo en `deleted` o tras `invoice.payment_failed` repetido configurado en Stripe Dashboard | SHOULD | mismo |
| REQ-013 | `POST /api/portal` **MUST** leer `stripeCustomerId` fresco desde `prisma.user.findUnique where id=session.user.id` (no `session.user.stripeCustomerId` stale) y retornar `400 No subscription` solo si DB es null | MUST | `front/src/app/api/portal/route.ts:8` |
| REQ-014 | `front/src/lib/stripe.ts` **MUST** validar env al importar: si `!STRIPE_PREMIUM_PRICE_ID || !STRIPE_PRO_PRICE_ID || !STRIPE_SECRET_KEY` throw legible `Missing STRIPE_* env`, sin `!` non-null assert | MUST | `front/src/lib/stripe.ts:16-18` |
| REQ-015 | `STRIPE_PLANS` **MUST** ser `Record<PlanKey,string>` tipado con `premium→STRIPE_PREMIUM_PRICE_ID` y `pro→STRIPE_PRO_PRICE_ID` | MUST | `front/src/lib/stripe.ts` |
| REQ-016 | `PlanCard` y dashboard **MUST** reflejar plan fresco en <5s tras webhook sin relogin: siguiente `auth()` / `GET /dashboard` **MUST** mostrar `premium`/`pro` | MUST | `front/src/app/(protected)/dashboard/page.tsx:9`, `PlanCard.tsx` |
| REQ-017 | El flujo **MUST** soportar `success_url ${origin}/dashboard?success=true` que **SHOULD** triggerear `fetch POST /api/auth/refresh` client-side al montar si `searchParams.success` | SHOULD | `front/src/app/(protected)/dashboard/page.tsx` |

### Dependencias
- Prisma `User` tiene `plan` enum y `stripeCustomerId` nullable indexado.
- Stripe test keys `price_1U62vu`/`price_1U62wc` y `whsec_`.

### Fuera de scope
- Migrar `session.strategy` a `database`, expiración/revocación server-side, facturación impuestos/prorrata/cupones.

---

## 3. Escenarios (Gherkin)

### SCN-001 — Checkout → webhook → dashboard sin relogin (happy path premium)
```gherkin
GIVEN usuario autenticado free con session.user.id="user_123" y prisma.user.plan="free"
WHEN usuario POST /api/checkout {plan:"premium"} → Stripe checkout → paga → Stripe envía POST /api/webhooks/stripe event checkout.session.completed con metadata {userId:"user_123", plan:"premium"} y customer "cus_abc"
  AND webhook hace constructEvent con sig válido y prisma.user.update plan premium
  AND usuario hace GET /dashboard (siguiente request, token.id="user_123" en JWT)
THEN callbacks.jwt refresca via findUnique where id="user_123" y token.plan="premium"
  AND session.user.plan="premium"
  AND PlanCard muestra badge "Premium" sin haber hecho logout/login
  AND tiempo entre webhook 200 y dashboard premium < 5s
```

### SCN-002 — JWT refresh cada request (sin user)
```gherkin
GIVEN JWT existente con token.id="user_123" y token.plan="free" stale tras pago DB premium
WHEN llega request autenticado con user undefined (navegación normal)
THEN jwt() ejecuta prisma.user.findUnique where id="user_123"
  AND token.plan se actualiza a "premium" y token.stripeCustomerId a "cus_abc"
  AND session callback expone session.user.plan="premium"
```

### SCN-003 — Endpoint POST /api/auth/refresh forza sync
```gherkin
GIVEN usuario autenticado con JWT stale free pero DB premium tras webhook hace 2s
WHEN cliente hace POST /api/auth/refresh con cookie session válida
THEN endpoint retorna {ok:true, plan:"premium"} con status 200
  AND siguiente auth() ya ve plan premium (even si no hubo navegación)
GIVEN usuario no autenticado
WHEN POST /api/auth/refresh
THEN retorna 401 Unauthorized
```

### SCN-004 — Webhook checkout.session.completed idempotente
```gherkin
GIVEN webhook recibe checkout.session.completed con session.id "cs_test_123" para user_123 premium por segunda vez (reintento Stripe)
WHEN handler ejecuta prisma.user.update where id=user_123 data {plan:"premium"}
THEN no throw, retorna 200
  AND prisma.user.plan permanece "premium" (sin duplicado)
```

### SCN-005 — Subscription updated mapea price → plan explícito
```gherkin
GIVEN prisma.user con stripeCustomerId "cus_abc" y plan premium
WHEN webhook recibe customer.subscription.updated con price.id = STRIPE_PRO_PRICE_ID
THEN handler mapea a "pro" via PRICE_TO_PLAN y hace prisma.user.update plan "pro"
  AND Dashboard siguiente request muestra "pro"
GIVEN price.id desconocido "price_unknown_xyz"
WHEN webhook recibe updated
THEN log warn "Unknown priceId price_unknown_xyz" y retorna 200 sin update (no defaultea a premium)
```

### SCN-006 — Subscription deleted → free
```gherkin
GIVEN usuario pro con stripeCustomerId "cus_abc"
WHEN webhook recibe customer.subscription.deleted para customer "cus_abc"
THEN prisma.user.update plan "free"
  AND siguiente JWT refresh ve plan free
```

### SCN-007 — Invoice.paid no degrada (renewal)
```gherkin
GIVEN usuario premium con suscripción activa cus_abc
WHEN webhook recibe invoice.paid con customer "cus_abc"
THEN handler no cambia plan, solo log "invoice.paid renewal for cus_abc"
  AND retorna 200
```

### SCN-008 — Portal lee DB no JWT
```gherkin
GIVEN JWT stale con stripeCustomerId null pero prisma.user.stripeCustomerId="cus_abc" tras checkout
WHEN usuario POST /api/portal con session.user.id="user_123"
THEN portal hace prisma.user.findUnique where id user_123 y encuentra cus_abc
  AND crea stripe.billingPortal.sessions.create customer cus_abc
  AND retorna {url} 200 (no 400 No subscription falso)
GIVEN DB stripeCustomerId null
WHEN POST /api/portal
THEN retorna 400 No subscription
```

### SCN-009 — Portal y checkout con DB fresh tras payment_failed no degrada
```gherkin
GIVEN customer cus_abc con invoice.payment_failed
WHEN webhook recibe invoice.payment_failed
THEN solo console.warn, no update plan
  AND usuario sigue premium hasta deleted o intervención Stripe
```

### SCN-010 — Guard STRIPE_WEBHOOK_SECRET faltante
```gherkin
GIVEN env STRIPE_WEBHOOK_SECRET vacío
WHEN llega POST /api/webhooks/stripe con body y sig
THEN handler retorna 500 con mensaje Missing STRIPE_WEBHOOK_SECRET antes de constructEvent
```

### SCN-011 — Dashboard success=true auto-refresh
```gherkin
GIVEN usuario retorna de Stripe a /dashboard?success=true tras pagar
WHEN Dashboard monta y detecta searchParams.success
THEN cliente hace fetch POST /api/auth/refresh
  AND PlanCard poll o revalidate muestra premium en <5s
```

---

## 4. Criterios de Aceptación

- [ ] `front/src/lib/auth.ts` contiene bloque `if (token?.id && !user) { const dbUser = await prisma.user.findUnique({ where: { id: token.id } }); if(dbUser){ token.plan=dbUser.plan; token.stripeCustomerId=dbUser.stripeCustomerId } }` antes de `return token`, verificado por unit test mock prisma.
- [ ] `front/src/app/api/auth/refresh/route.ts` existe, exige `auth()`, retorna `{ok:true, plan}` y está cubierto por test 401/200.
- [ ] `front/src/app/api/webhooks/stripe/route.ts` maneja 5 eventos: `checkout.session.completed`, `customer.subscription.updated` (tabla explícita), `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`; incluye guard `if(!STRIPE_WEBHOOK_SECRET) return 500`; `updated` no defaultea a premium.
- [ ] `front/src/lib/stripe.ts` valida env sin `!` y mapea `PRICE_TO_PLAN`.
- [ ] `front/src/app/api/portal/route.ts` hace `prisma.user.findUnique where id=session.user.id` (grep no lee `session.user.stripeCustomerId` directo).
- [ ] Test E2E `stripe trigger checkout.session.completed` → `prisma.user.findUnique` → `auth()` refleja premium sin relogin (Playwright o curl + DB assert) pasa.
- [ ] Build y tests pasan; webhook logs no exponen secret.

## 5. Riesgos

- **N+1 por refresh cada request**: 1 `findUnique` indexado ~2-5ms; aceptable vs. alternativa DB session; mitigar con caché 1s si P95 > 50ms (no requerido ahora).
- **Event ordering Stripe**: `checkout.session.completed` y `invoice.paid` pueden llegar desordenados; idempotencia y mapeo explícito lo toleran.

## 6. Métricas de Éxito

- 100% webhooks `checkout.session.completed` reflejados en `session.user.plan` en siguiente request P95 <1s.
- 0 falsos `400 No subscription` en portal post-pago (medido por logs).
- Plan fresco <5s tras pago sin relogin (Playwright fixture).
