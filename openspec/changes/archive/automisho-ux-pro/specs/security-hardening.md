# Spec Delta — security-hardening

**Change:** `automisho-ux-pro`
**Delta:** `security-hardening`
**Status:** proposed
**Source:** `exploration.md` §6, `proposal.md` §2.5 + §4.6, `front/src/lib/auth.ts:34-36`, `front/src/app/api/webhooks/stripe/route.ts:20-24`, `front/.env.local:19-25`, `server/main.py:20-30`, `front/next.config.ts`, `front/src/components/chat/MessageBubble.tsx`
**Stack:** Next.js 16 + Zod 3 + `next.config` headers + Upstash Ratelimit o Arcjet + `gitleaks`

---

## 1. Objetivo

Cerrar hardening integral: **validación runtime, rate-limit, CSP/headers, gestión de secrets y links seguros**, sin romper flujo existente. Hoy falta `zod` (bodies `any[]`), sin rate-limit, sin CSP, secrets en disco versionado.

---

## 2. Requerimientos (RFC 2119)

| ID | Requerimiento | Keyword | Archivo(s) |
|----|---------------|---------|------------|
| REQ-001 | Todos los `route.ts` bodies **MUST** validar con `zod` antes de lógica: `chat` (`messages`, `conversationId`), `checkout` (`plan`), `portal`, `dgt/lookup` (`plate`), `register` (`email`, `password`), `conversations` | MUST | `front/src/app/api/**/route.ts` |
| REQ-002 | `zod` schemas **MUST** centralizarse en `front/src/lib/validators.ts` (nuevo) con al menos: `ChatBody = z.object({ messages: z.array(z.any()).min(1), conversationId: z.string().uuid().optional() })`, `CheckoutBody = z.object({ plan: z.enum(["premium","pro"]) })`, `PlateBody = z.object({ plate: z.string().regex(/^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/i) })`, `RegisterBody = z.object({ email: z.string().email(), password: z.string().min(8) })` | MUST | `front/src/lib/validators.ts` |
| REQ-003 | Cada route **MUST** retornar `400` con `error: zod.flatten().fieldErrors` si validación falla, antes de `prisma` o `stripe` | MUST | mismos route.ts |
| REQ-004 | Rate-limit **MUST** aplicarse en `chat`, `search` (`/api/scrape` proxy o `/api/chat` searchBackend), `dgt/lookup`, `register`, `checkout` con límite **10 req/min por IP+user** (key `ip + userId` si autenticado, `ip` si no) | MUST | `front/src/middleware.ts` o `front/src/lib/rate-limit.ts` |
| REQ-005 | El middleware **MUST** usar `@upstash/ratelimit` (o `arcjet`) con `Ratelimit.slidingWindow(10,"1 m")` y **MUST** retornar `429 Too Many Requests` con header `Retry-After` cuando `success===false` | MUST | `front/src/middleware.ts` |
| REQ-006 | Rate-limit **SHOULD** tener bypass para `premium/pro` con 20 req/min (doble límite) | SHOULD | `front/src/middleware.ts` |
| REQ-007 | Rate-limit **MUST** ser desactivable vía env `RATE_LIMIT_ENABLED=false` para tests/CI | MUST | `front/src/middleware.ts` |
| REQ-008 | `front/next.config.ts` **MUST** exponer `async headers()` con `Content-Security-Policy` (ver REQ-009), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` o `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin` | MUST | `front/next.config.ts` |
| REQ-009 | `CSP` **MUST** ser: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://opencode.ai https://api.stripe.com; frame-ancestors 'none';` ajustado a Next (requiere `unsafe-inline/eval` para Next + Framer), sin `*` abierto | MUST | `front/next.config.ts` |
| REQ-010 | CSP **SHOULD** iniciar en `Content-Security-Policy-Report-Only` si riesgo de romper Tailwind inline, migrando a `Content-Security-Policy` tras build verde | SHOULD | `front/next.config.ts` |
| REQ-011 | El repo **MUST** incluir `front/.env.example` con placeholders sin secretos reales: `NEXTAUTH_SECRET=`, `GOOGLE_CLIENT_ID=`, `GOOGLE_CLIENT_SECRET=`, `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_WEBHOOK_SECRET=whsec_...`, `STRIPE_PREMIUM_PRICE_ID=price_...`, `STRIPE_PRO_PRICE_ID=price_...`, `DATABASE_URL=postgresql://...`, `OPENCODE_BASE_URL=`, `OPENCODE_API_KEY=`, `OPENCODE_MODEL=qwen3.7-plus` | MUST | `front/.env.example` (nuevo) |
| REQ-012 | `front/.env.local` **MUST NOT** ser trackeado; `front/.gitignore` **MUST** contener `.env.local` y `.env` | MUST | `front/.gitignore` |
| REQ-013 | El repo **MUST NOT** contener `sk_test`, `whsec_`, `NEXTAUTH_SECRET` reales en ningún archivo trackeado; CI **MUST** correr `gitleaks` o `git grep -i "sk_test\|NEXTAUTH_SECRET" --cached` y fallar si encuentra | MUST | CI, todos archivos |
| REQ-014 | Docs **MUST** incluir `docs/SECRETS_ROTATION.md` o sección en `README` con rotación: `openssl rand -base64 32` para `NEXTAUTH_SECRET`, rotar `STRIPE sk_test`, `GOOGLE_CLIENT_SECRET`, `DATABASE_URL` password, y `NEXTAUTH_URL` por env | MUST | `docs/SECRETS_ROTATION.md` o `README.md` |
| REQ-015 | Todos los links externos (`DGTGuideCard`, `CarVerticalCard`, `CarfaxCard`, `CarResultCard`) **MUST** incluir `target="_blank" rel="noopener noreferrer"` o `rel="noopener"` | MUST | `front/src/components/**` |
| REQ-016 | `server/main.py:20-30` CORS **MUST** restringir `allow_origins` a lista explícita `[http://localhost:3000, https://<vercel-domain>]` en prod (no `*`), y **MUST NOT** usar `allow_credentials True` con `*` | MUST | `server/main.py` |
| REQ-017 | `Wallapop json.loads` **SHOULD** tener límite de tamaño (`max_content_length` 1MB) para evitar DoS | SHOULD | `server/routers/scrape.py:227-230` |
| REQ-018 | `MessageBubble` futuro `react-markdown` **SHOULD** sanitizar con `rehype-sanitize` y **MUST NOT** permitir `javascript:` urls | SHOULD/MUST | `front/src/components/chat/MessageBubble.tsx` |
| REQ-019 | El sistema **MUST** documentar rate-limit y CSP en `front/src/lib/validators.ts` y `next.config.ts` con comentarios | MUST | mismos |

### Dependencias
- `zod` ya en `front/package.json` o añadir.
- `@upstash/ratelimit` + `@upstash/redis` o `arcjet` (elegir uno, documentar env `UPSTASH_REDIS_REST_URL/TOKEN`).

### Fuera de scope
- Rotación de proxies/WAF, headless browser, vault de secrets en runtime (usar env vars).

---

## 3. Escenarios (Gherkin)

### SCN-001 — zod valida chat body inválido
```gherkin
GIVEN POST /api/chat con body {messages: "no-array"}
WHEN route valida con ChatBody zod
THEN retorna 400 {error: {messages: ["Expected array, received string"]}}
  AND no llega a prisma.conversation.findFirst ni a searchBackend
```

### SCN-002 — zod valida chat ok
```gherkin
GIVEN POST /api/chat con body {messages:[{role:"user", parts:[{type:"text", text:"hola"}]}], conversationId:"550e8400-e29b-41d4-a716-446655440000"}
WHEN valida ChatBody
THEN pasa, continúa a auth y lógica
```

### SCN-003 — zod valida checkout plan inválido
```gherkin
GIVEN POST /api/checkout con body {plan:"enterprise"}
WHEN valida CheckoutBody z.enum(["premium","pro"])
THEN 400 {error: {plan: ["Invalid enum value"]}}
```

### SCN-004 — zod valida plate inválido
```gherkin
GIVEN POST /api/dgt/lookup con body {plate:"1234ABC"} (contiene A prohibida)
WHEN valida PlateBody regex /^\d{4}[BCDFGHJ-NPRSTVWXYZ]{3}$/i
THEN 400
GIVEN plate "1234BCD"
THEN 200
```

### SCN-005 — Rate-limit chat 10/min por IP
```gherkin
GIVEN IP 1.2.3.4 hace 10 POST /api/chat en 60s
WHEN hace el 11º POST dentro del mismo minuto
THEN middleware retorna 429 {error:"Too many requests"} con header Retry-After: <seconds>
  AND no llega a route handler
GIVEN mismo IP es premium
WHEN hace 11º request
THEN pasa (límite premium 20/min)
```

### SCN-006 — Rate-limit desactivable por env
```gherkin
GIVEN env RATE_LIMIT_ENABLED=false
WHEN IP hace 100 POST /api/chat en 10s
THEN ninguno retorna 429, todos pasan
```

### SCN-007 — CSP headers en next.config
```gherkin
GIVEN GET /dashboard
WHEN inspecciona response headers
THEN Content-Security-Policy contiene "default-src 'self'" y "img-src 'self' data: https:" y "frame-ancestors 'none'"
  AND X-Content-Type-Options: nosniff presente
  AND X-Frame-Options: DENY o frame-ancestors none
```

### SCN-008 — next.config CSP no rompe build
```gherkin
GIVEN CSP con style-src 'self' 'unsafe-inline'
WHEN npm run build --prefix front ejecuta
THEN build pasa (Next requiere unsafe-inline para styles)
  AND Lighthouse no reporta CSP violation por Tailwind
```

### SCN-009 — .env.example sin secretos
```gherkin
GIVEN cat front/.env.example
THEN contiene líneas con claves vacías o placeholder price_... y OPENCODE_MODEL=qwen3.7-plus
  AND no contiene sk_test real ni whsec_ real ni GOOGLE_CLIENT_SECRET real
WHEN git grep -i "sk_test_live\|whsec_" --cached
THEN 0 resultados
```

### SCN-010 — .env.local gitignored
```gherkin
GIVEN cat front/.gitignore
THEN contiene ".env.local" y ".env"
WHEN git ls-files | grep .env.local
THEN no trackeado
```

### SCN-011 — Links externos con rel noopener
```gherkin
GIVEN render DGTGuideCard con <a href="https://sede.dgt.gob.es/...">
WHEN inspecciona DOM
THEN <a> tiene target="_blank" rel="noopener noreferrer"
GIVEN CarResultCard con url https://www.coches.net/...
THEN igual rel noopener
```

### SCN-012 — CORS restringido en server
```gherkin
GIVEN server/main.py CORS config
WHEN ENV prod
THEN allow_origins es ["http://localhost:3000", "https://<vercel-domain>"] explícito, no "*"
  AND no allow_credentials con "*"
```

### SCN-013 — MessageBubble no permite javascript: url
```gherkin
GIVEN futuro react-markdown render con contenido "[click](javascript:alert(1))"
WHEN sanitiza con rehype-sanitize
THEN href javascript: se strippea o no renderiza como <a>
```

### SCN-014 — gitleaks CI falla si secret en repo
```gherkin
GIVEN commit intenta añadir front/.env.local con sk_test_...
WHEN CI ejecuta gitleaks detect
THEN pipeline falla y bloquea merge
```

---

## 4. Criterios de Aceptación

- [ ] `front/src/lib/validators.ts` existe con 4+ schemas zod (`ChatBody`, `CheckoutBody`, `PlateBody`, `RegisterBody`) y es importado por cada `route.ts`.
- [ ] Todas las `route.ts` (`chat`, `checkout`, `portal`, `dgt/lookup`, `register`, `conversations`) validan con `zod` y retornan 400 en inválido (unit test 400/200).
- [ ] `front/src/middleware.ts` (o `lib/rate-limit.ts` + middleware) implementa 10 req/min por `ip+userId` con `@upstash/ratelimit` o `arcjet`, 429 + `Retry-After`, flag `RATE_LIMIT_ENABLED`.
- [ ] `front/next.config.ts` `headers()` expone CSP, `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`; build pasa y headers verificables con `curl -I`.
- [ ] `front/.env.example` existe con placeholders y `front/.gitignore` ignora `.env.local`; `git ls-files | grep .env.local` vacío.
- [ ] `git grep -i "sk_test\|NEXTAUTH_SECRET" --cached` vacío (CI).
- [ ] Todos los links externos tienen `rel="noopener noreferrer"` (grep `target="_blank"` sin `rel` → 0).
- [ ] `server/main.py` CORS restringido (no `*` con credentials).
- [ ] Build y tests pasan; `gitleaks` local `gitleaks detect --no-git` sin leaks.

## 5. Riesgos

- **CSP unsafe-inline requerido por Next**: mitigado con `style-src 'unsafe-inline'` + no `unsafe-eval` si no necesario; report-only primero.
- **Rate-limit falso positivo**: límite generoso 10/min + bypass premium 20/min + `Retry-After` claro.

## 6. Métricas de Éxito

- 0 abuse >20 req/min por IP sin bloquear premium (Upstash dashboard 429 logs).
- 0 secrets en repo (`gitleaks` 0 leaks).
- 0 links sin `rel noopener`.
- Lighthouse `a11y` y `best-practices` ≥95 tras CSP.
