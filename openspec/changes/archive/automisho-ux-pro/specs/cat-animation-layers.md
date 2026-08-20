# Spec Delta — cat-animation-layers

**Change:** `automisho-ux-pro`
**Delta:** `cat-animation-layers`
**Status:** proposed
**Source:** `exploration.md` §5, `proposal.md` §2.5 + §4.5, `front/src/components/icons/AutoMishoCat.tsx:1-384`
**Stack:** React 19 + Framer Motion (`useMotionValue`, `useSpring`, `useTransform`, `motion.g`) + SVG

---

## 1. Objetivo

Profesionalizar la mascota `AutoMishoCat` separando **capas físicas independientes** con spring y clamp diferencial, eliminando el `<g>` conjunto rígido actual y logrando seguimiento ocular creíble a 60fps.

Hoy todo está en un `<g translate eyeOffset>` conjunto sin separar iris/pupila/brillo, pupila fija sin offset propio, `headRotate*8` directo sin spring, rígido.

---

## 2. Requerimientos (RFC 2119)

| ID | Requerimiento | Keyword | Archivo(s) |
|----|---------------|---------|------------|
| REQ-001 | El SVG **MUST** separar en grupos identificables: `<g id="head">` para cabeza completa, `<g id="eyes">` contenedor de ojos, `<g id="iris-left">` y `<g id="iris-right">` para iris individual, `<g id="pupils">` o `<g id="pupil-left">`/`<g id="pupil-right">` para pupilas, y `<g id="eyelids">` o control `eyelids` via `scaleY` | MUST | `front/src/components/icons/AutoMishoCat.tsx` |
| REQ-002 | Cada grupo **MUST** tener `id` literal en DOM (`head`, `eyes`, `iris-left`, `iris-right`, `pupils` o `pupil-left/right`, `eyelids`) para inspección y testing | MUST | mismo |
| REQ-003 | El tracking **MUST** usar `framer-motion` `useMotionValue(0)` para `mouseX`/`mouseY` normalizados `-1..1` y `useSpring(mouseX, {stiffness:180, damping:18})` (y análogo `mouseY`) | MUST | mismo |
| REQ-004 | El handler `mousemove` **MUST** calcular `dx = clamp(-1,1, (clientX-centerX)/300)` y `dy` idem, y llamar `mouseX.set(dx)` / `mouseY.set(dy)` (no `setState` directo en render) | MUST | mismo |
| REQ-005 | `iris` offset **MUST** ser `useTransform(springX, v=> clamp(-3,3, v*3))` para X y `v*2` o `v*3` para Y con **clamp 3px** | MUST | mismo |
| REQ-006 | `pupil` offset **MUST** ser `useTransform(springX, v=> clamp(-1.5,1.5, v*1.5))` con **clamp 1.5px** (diferencial iris 3px vs pupila 1.5px) para profundidad | MUST | mismo |
| REQ-007 | `head` rotación **MUST** ser `useTransform(springX, v=> v*0.8)` (±0.8deg) con spring `stiffness 180 damping 18`, aplicado como `style={{ rotate: headRotate }}` o `transform rotate` en `<g id="head">` con `transformOrigin: "140px 110px"` | MUST | mismo |
| REQ-008 | Cuerpo y patas **SHOULD** mantener micro-rotación proporcional `headRotate *0.3` y `*0.2` respectivamente pero vía `useTransform` spring no `headRotate*0.3` directo sin spring | SHOULD | mismo |
| REQ-009 | Blink **MUST** preservarse: `blinkState` boolean con `setTimeout 3000+random*3000` y `scaleY 0.1` durante 150ms, aplicado via `motion.g animate={{scaleY: blink?0.1:1}}` con `transformOrigin: "center"` en cada ojo | MUST | mismo |
| REQ-010 | El tamaño prop `size=280` **MUST** preservarse y pass-through a `<svg width={size} height={size} viewBox="0 0 280 280">` | MUST | mismo |
| REQ-011 | El SVG **MUST** mantener `filter: drop-shadow(0 0 30px rgba(151,252,215,0.15))` y defs `metalBody/metalHead/eyeGlow/mintGlow/eyeGlowFilter` sin regresión | MUST | mismo |
| REQ-012 | Performance **MUST** mantener 60fps en Chrome Performance con `will-change: transform` en grupos animados y `transform: translateZ(0)` para GPU; **MUST NOT** causar layout thrash (solo `transform` y `opacity`) | MUST | mismo |
| REQ-013 | El componente **MUST** respetar `prefers-reduced-motion: reduce` desactivando spring (o reduciendo `stiffness` y clamp a 0) | MUST | mismo |
| REQ-014 | Iris y pupila **MUST NOT** salir del socket: clamp garantiza que iris r10 + offset 3px + pupila r4 + offset 1.5px permanece dentro de socket r14 | MUST | mismo |
| REQ-015 | El código **SHOULD** usar `motion.g` para cada capa animada y no `g transform="translate(...)"` estático | SHOULD | mismo |

### Dependencias
- `framer-motion` ya en `front/package.json`.
- No requiere cambio de API ni DB.

### Fuera de scope
- Rediseño de cola/body/gear, nueva ilustración, Lottie/Rive, animación de whiskers más allá de existente.

---

## 3. Escenarios (Gherkin)

### SCN-001 — Capas separadas en DOM
```gherkin
GIVEN AutoMishoCat montado con size 280
WHEN inspecciona SVG DOM
THEN existe <g id="head">
  AND dentro existe <g id="eyes">
  AND existen <g id="iris-left"> y <g id="iris-right">
  AND existen <g id="pupil-left"> o <g id="pupils"> conteniendo pupilas
  AND blink se aplica en <g id="eyelids"> o via scaleY en iris groups
```

### SCN-002 — useMotionValue + useSpring wiring
```gherkin
GIVEN código fuente AutoMishoCat.tsx
WHEN grep "useMotionValue" y "useSpring"
THEN ambos presentes con stiffness 180 damping 18
  AND no existe setMousePos useState directo para transform (solo para compat o removido)
```

### SCN-003 — Iris clamp 3px diferencial
```gherkin
GIVEN mouse en extremo derecho dx=1
WHEN springX=1 y useTransform irisX = clamp(-3,3, 1*3)=3
THEN iris-left tiene style transform translateX(3px) (no 4px)
GIVEN mouse dx=1
WHEN pupilX = clamp(-1.5,1.5, 1*1.5)=1.5
THEN pupil offset es 1.5px (mitad de iris)
GIVEN mouse dx=-1
WHEN evalúa
THEN iris -3px y pupil -1.5px
```

### SCN-004 — Head spring 0.8deg
```gherkin
GIVEN mouse dx=1
WHEN headRotate = springX *0.8 =0.8deg
THEN <g id="head"> rota 0.8deg alrededor de 140,110 con spring (no 8deg directo)
GIVEN mouse dx=-1
THEN head -0.8deg
GIVEN mouse en centro dx=0
THEN head 0deg
```

### SCN-005 — Blink scaleY 0.1 150ms cada 3-6s
```gherkin
GIVEN cat visible
WHEN espera 2000ms + 3000-6000ms
THEN eyelids o iris group anima scaleY 0.1 durante 150ms y vuelve a 1
  AND transformOrigin es center
GIVEN blinkState=true
WHEN inspecciona computed transform
THEN scaleY es 0.1
```

### SCN-006 — Performance 60fps solo transform
```gherkin
GIVEN cat animado con mouse moviéndose continuo
WHEN graba Chrome Performance 5s
THEN FPS promedio ≥55 (target 60)
  AND no layout recalc por eye movement (solo transform)
  AND will-change: transform presente en motion.g
```

### SCN-007 — Pupila no sale del iris (containment)
```gherkin
GIVEN socket r14, iris r10, pupila r4
WHEN iris offset 3px + pupil 1.5px máximo en misma dirección = 4.5px total
THEN pupila edge = 4.5 +4 =8.5 < socket 14 → permanece contenida
  AND visualmente pupila no cruza borde iris r10
```

### SCN-008 — Size prop preservada
```gherkin
GIVEN <AutoMishoCat size={240} />
WHEN renderiza
THEN svg width 240 height 240 viewBox 0 0 280 280
GIVEN size omitido
THEN default 280
```

### SCN-009 — prefers-reduced-motion desactiva
```gherkin
GIVEN usuario con prefers-reduced-motion: reduce
WHEN cat monta
THEN iris/pupil offset es 0 (clamp 0) o spring stiffness muy alta sin movimiento perceptible
  AND blink puede permanecer pero sin translate
```

---

## 4. Criterios de Aceptación

- [ ] `front/src/components/icons/AutoMishoCat.tsx` contiene `id="head"`, `id="eyes"`, `id="iris-left"`, `id="iris-right"`, `id="pupil-left/right"` o `id="pupils"`, `id="eyelids"` (o scaleY en iris) verificable por `grep -c 'id="head"'`.
- [ ] Archivo importa `useMotionValue`, `useSpring`, `useTransform`, `motion` de `framer-motion` y usa `stiffness:180, damping:18`.
- [ ] Iris clamp 3px y pupil 1.5px verificables en código (`Math.max(-3,Math.min(3` y `-1.5`).
- [ ] Head rotate `*0.8` con spring, no `*8` directo; body `*0.3` y legs `*0.2` via transform si aplican.
- [ ] Blink `scaleY` 0.1 150ms con intervalo `3000+random*3000` preservado.
- [ ] `grep -R "eyeOffsetX\*4" AutoMishoCat.tsx` vacío (viejo offset eliminado).
- [ ] Performance Chrome ≥55fps en 5s con mouse continuo; `will-change` presente.
- [ ] Build y tests pasan; storybook/visual test si existe no regresa.

## 5. Riesgos

- **Framer spring jank en móvil**: mitigado con `will-change` + `translateZ(0)`; si FPS <55, reducir `stiffness` a 150.
- **Breaking change en SVG ids**: ids adicionales no rompen snapshot si son aditivos; snapshot update esperado.

## 6. Métricas de Éxito

- 60fps en cat con spring (Chrome perf).
- Diferencial iris 3px / pupila 1.5px validado visualmente (pupila no sale).
- 0 regresiones visuales en Hero/Demo donde cat se usa.
