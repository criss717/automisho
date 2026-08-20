# Spec Delta — visual-liquid-glass

**Change:** `automisho-ux-pro`
**Delta:** `visual-liquid-glass`
**Status:** proposed
**Source:** `exploration.md` §1, `proposal.md` §2.1 + §4.1, `front/src/app/globals.css:8-61`, `front/src/app/(protected)/dashboard/page.tsx:32-52`, `PlanCard.tsx:52`, `UsageStats.tsx:27`, `DgtLookupInput.tsx:53`, `SettingsPanel.tsx:14`, `Navbar.tsx:33-36`
**Stack:** Tailwind v4 + `globals.css` @theme + Framer Motion 12 + `prefers-reduced-motion`

---

## 1. Objetivo

Introducir un **Liquid Glass system** reutilizable que extienda (sin romper) los tokens Hyper Foundation existentes y unificar dashboard y cards con percepción premium, profundidad y movimiento controlado.

Sin este delta el dashboard permanece flat `bg-shadow-teal/30` sin `backdrop-blur`, `max-w-4xl` encogido y estático.

---

## 2. Requerimientos (RFC 2119)

| ID | Requerimiento | Keyword | Archivo(s) |
|----|---------------|---------|------------|
| REQ-001 | El sistema **MUST** exponer la utility `.glass` con `background: rgba(35,82,76,0.40)` (token `shadow-teal / 40%`), `backdrop-filter: blur(20px) saturate(1.2)` + `-webkit-backdrop-filter` idéntico, `border: 1px solid rgba(255,255,255,0.06)`, y `box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.24)` | MUST | `front/src/app/globals.css` |
| REQ-002 | El sistema **MUST** exponer `.glass-strong` con `background: rgba(35,82,76,0.55)`, `backdrop-filter: blur(24px) saturate(1.3)`, `border-color: rgba(255,255,255,0.08)` | MUST | `front/src/app/globals.css` |
| REQ-003 | El sistema **MUST** exponer `.glass-card` como composición de `.glass` + `border-radius: var(--radius-cards)` (`0.75rem`) + `padding: 1.5rem` + `transition: all 0.3s cubic-bezier(0.4,0,0.2,1)` | MUST | `front/src/app/globals.css` |
| REQ-004 | El sistema **MUST** exponer `.glass-input` con `.glass` + `border-radius: var(--radius-full)` (`3.75rem`) + `padding: 0.875rem 1rem` para inputs redondeados translúcidos | MUST | `front/src/app/globals.css` |
| REQ-005 | `.glass-card:hover` **MUST** aplicar `border-color: rgba(151,252,215,0.18)` (mint-glow/18), `box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 20px rgba(151,252,215,0.12)`, `transform: translateY(-2px)` | MUST | `front/src/app/globals.css` |
| REQ-006 | `front/src/app/(protected)/dashboard/page.tsx` **MUST** migrar a `max-w-6xl mx-auto px-8 py-10` (1200px system width via `.section` pattern), `grid grid-cols-1 md:grid-cols-2 gap-8` con `p-8` contenedor, reemplazando `max-w-4xl gap-6` | MUST | `front/src/app/(protected)/dashboard/page.tsx` |
| REQ-007 | El dashboard **MUST** incluir capa atmosférica con 2 blobs decorativos `pointer-events-none absolute` reutilizando pattern `DataSources.tsx:38-43` o `Features.tsx:63-65`: blob-1 `w-[520px] h-[520px] rounded-full bg-shadow-teal/20 blur-[120px] -top-32 -right-32` + blob-2 `w-[420px] h-[420px] rounded-full bg-abyss-green/30 blur-[100px] -bottom-24 -left-24` + contenedor `relative overflow-hidden` | MUST | `front/src/app/(protected)/dashboard/page.tsx` |
| REQ-008 | El dashboard **MUST** animar entry con Framer Motion `motion.div` stagger: `initial="hidden" animate="show"` con `variants={{ hidden:{}, show:{ transition:{ staggerChildren:0.06, delayChildren:0.08 }}}}`, hijos con `variants={{ hidden:{opacity:0,y:12}, show:{opacity:1,y:0, transition:{duration:0.4}}}}` y header con `initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.4}}` | MUST | `front/src/app/(protected)/dashboard/page.tsx` |
| REQ-009 | Los 4 cards `PlanCard.tsx:52`, `UsageStats.tsx:27`, `DgtLookupInput.tsx:53`, `SettingsPanel.tsx:14` **MUST** migrar de `rounded-xl border-midnight-tide bg-shadow-teal/30 p-6` a `.glass-card` (manteniendo `md:col-span-2` en `SettingsPanel`) | MUST | `front/src/components/dashboard/*.tsx` |
| REQ-010 | Todos los colores en la capa visual **MUST** referenciar `var(--color-*)` del bloque `@theme` (forest-depths, shadow-teal, midnight-tide, mint-glow, etc.), no hex hardcodeado `#072724/#0f3933/#23524c` | MUST | `front/src/components/sections/Hero.tsx:38-48`, `Footer.tsx:33,35`, `Pricing.tsx:88`, `HowItWorks.tsx:83-88`, `globals.css` |
| REQ-011 | Los hardcodes previos en `Hero.tsx` (`style background linear-gradient`), `Footer.tsx` (`borderTop 1px solid #0f3933`), `Pricing.tsx` (`bg-shadow-teal/15 blur 100px` duplicado), `HowItWorks.tsx` (`#23524c` card bg) **MUST** refactorizarse a `var()` o utilities glass | MUST | mismos archivos |
| REQ-012 | El sistema **MUST** preservar `shadow-glow` tokens existentes y no degradar contraste a11y: texto `pure-light #ffffff` sobre `forest-depths #072724` y `mist-gray #b0c5c1` sobre glass **MUST** mantener WCAG AA (ratio ≥ 4.5:1 para body, ≥ 3:1 para large) | MUST | `globals.css`, cards |
| REQ-013 | La animación **MUST** respetar `prefers-reduced-motion: reduce` desactivando `stagger` y `blob-morph` (media query que setea `animation: none` y `transition: none` en `.glass-card`) | MUST | `front/src/app/globals.css` |
| REQ-014 | `.glass-card` **SHOULD** incluir `will-change: transform` optimizado GPU y aislamiento `transform: translateZ(0)` para evitar jank en 60fps | SHOULD | `front/src/app/globals.css` |
| REQ-015 | El dashboard **SHOULD** exponer `section-header` pattern (`.section-header` con `margin-bottom:3rem`) para título, consistente con `.section-title` Teodor 90px/0.75 | SHOULD | `front/src/app/(protected)/dashboard/page.tsx` |

### Dependencias
- Requiere `framer-motion` ya instalado (usado en `Hero.tsx`, `Features.tsx`).
- No requiere migración Prisma ni cambio de API.

### Fuera de scope
- Nuevo logo/branding, ilustraciones, `view-transition` experimental, rediseño completo de `Pricing`/`Features`.

---

## 3. Escenarios (Gherkin)

### SCN-001 — Dashboard carga con liquid glass + stagger
```gherkin
GIVEN usuario autenticado con plan "free" en /dashboard
WHEN la página monta y Framer evalúa variants
THEN el contenedor grid tiene clase max-w-6xl gap-8 p-8
  AND header anima opacity 0→1 en 400ms con y 8→0
  AND cada card entra con stagger delayChildren 0.08 + staggerChildren 0.06 (PlanCard 0.08s, UsageStats 0.14s, DgtLookupInput 0.20s, SettingsPanel 0.26s)
  AND cada card tiene clase glass-card con backdrop-blur-xl visible en DevTools Computed
```

### SCN-002 — Hover glow en glass-card
```gherkin
GIVEN dashboard renderizado con glass-card
WHEN usuario hace hover sobre PlanCard
THEN border-color transiciona a rgba(151,252,215,0.18) en 300ms cubic-bezier(0.4,0,0.2,1)
  AND box-shadow incluye inset 0 1px 0 rgba(255,255,255,0.08) + 0 0 20px rgba(151,252,215,0.12)
  AND transform translateY(-2px)
```

### SCN-003 — Blobs atmosféricos presentes
```gherkin
GIVEN dashboard en viewport 1440px
WHEN se inspecciona DOM del wrapper relative overflow-hidden
THEN existen 2 divs pointer-events-none absolute con blur-[100px] o blur-[120px]
  AND blob-1 tiene bg-shadow-teal/20 y está en -top-32 -right-32 con w-[520px] h-[520px] rounded-full
  AND blob-2 tiene bg-abyss-green/30 en -bottom-24 -left-24
```

### SCN-004 — Tokens var() only, cero hardcode hex
```gherkin
GIVEN codebase tras merge
WHEN se ejecuta grep -R "#072724|#0f3933|#23524c" front/src --include="*.tsx" --include="*.css" excluyendo globals.css @theme
THEN el resultado está vacío (0 ocurrencias)
  AND Hero, Footer, Pricing, HowItWorks usan var(--color-*) o utilities Tailwind con tokens
```

### SCN-005 — Contraste a11y preservado
```gherkin
GIVEN card glass-card con texto pure-light h2 Teodor y body mist-gray
WHEN se mide con Lighthouse a11y o axe
THEN ratio pure-light (#ffffff) sobre forest-depths (#072724) ≥ 7:1
  AND mist-gray (#b0c5c1) sobre glass bg rgba(35,82,76,0.40) ≥ 4.5:1
  AND score Lighthouse a11y dashboard ≥ 95
```

### SCN-006 — Reduced motion desactiva stagger
```gherkin
GIVEN usuario con prefers-reduced-motion: reduce activado
WHEN carga /dashboard
THEN blob-morph animation es none
  AND motion.div variants resuelven sin delay (opacity directa 1 sin stagger)
  AND .glass-card transition es none
```

### SCN-007 — glass-strong variante elevada
```gherkin
GIVEN componente que usa glass-strong (ej. modal o UsageStats destacado)
WHEN se inspecciona computed style
THEN background es rgba(35,82,76,0.55)
  AND backdrop-filter es blur(24px) saturate(1.3)
  AND border-color es rgba(255,255,255,0.08)
```

### SCN-008 — glass-input redondeado
```gherkin
GIVEN DgtLookupInput migrado a glass-input
WHEN se renderiza input de matrícula
THEN tiene border-radius var(--radius-full) 3.75rem
  AND backdrop-blur-xl + bg-shadow-teal/40
  AND focus ring mint-glow sin perder blur
```

---

## 4. Criterios de Aceptación

- [ ] `front/src/app/globals.css` contiene bloque `.glass`, `.glass-strong`, `.glass-card`, `.glass-input` y `.glass-card:hover` exactamente con valores especificados en REQ-001..005 con `var(--color-*)` donde aplique.
- [ ] `grep -R "#072724\|#0f3933\|#23524c" front/src --include="*.tsx"` retorna 0 tras excluir `@theme` (verificado en CI).
- [ ] `/dashboard` inspeccionado en 1440px muestra `max-w-6xl` (no `max-w-4xl`), `gap-8` (no `gap-6`), blobs absolutos y stagger Framer verificable en React DevTools o Playwright `expect(page.locator('[data-testid="dashboard-card"]')).toHaveCSS('backdrop-filter', /blur/)`.
- [ ] `PlanCard`, `UsageStats`, `DgtLookupInput`, `SettingsPanel` usan `className` con `glass-card` y no `bg-shadow-teal/30` plano.
- [ ] Lighthouse CI `a11y` dashboard ≥ 95 y `axe` sin violaciones de contraste.
- [ ] Con `prefers-reduced-motion` simulado, no hay animación stagger ni blob-morph.
- [ ] Build `npm run build --prefix front` y `npm test --prefix front` pasan sin regresiones visuales snapshot.

## 5. Riesgos

- **Backdrop-blur performance en móvil low-end**: mitigado con `will-change` + fallback `bg-shadow-teal` sólido si `backdrop-filter` no soportado (`@supports`).
- **CSP con unsafe-inline**: requiere `style-src 'unsafe-inline'` para Next inline styles; verificar que glass no use inline `style` hardcodeado.

## 6. Métricas de Éxito

- 0 hardcode hex fuera de `var()` (grep CI).
- Lighthouse a11y ≥ 95.
- Percepción premium validada en QA manual 1440p: gap-8 + blobs + hover-glow visibles.
