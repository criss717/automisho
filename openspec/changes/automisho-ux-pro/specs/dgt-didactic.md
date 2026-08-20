# Spec Delta — dgt-didactic

**Change:** `automisho-ux-pro`
**Delta:** `dgt-didactic`
**Status:** proposed
**Source:** `exploration.md` §4, `proposal.md` §2.4 + §4.4, `server/routers/dgt.py:12-44`, `server/routers/carvertical.py:19-35`, `server/routers/carfax.py:19-34`, `front/src/app/api/dgt/lookup/route.ts:6`, `front/src/components/dashboard/DgtLookupInput.tsx:55-115`, `front/src/app/api/chat/route.ts:52`, `server/models/schemas.py:52-64`
**Stack:** Next 16 + FastAPI + Prisma + `sede.dgt.gob.es` (oficial)

---

## 1. Objetivo

Proveer **flujo didáctico y legal** para informe de vehículo: distinguir `mock` vs `real`, y ofrecer 3 vías complementarias — **DGT oficial 8,67€ (tasa 4.1)**, **CarVertical (~15€ VIN)** y **Carfax (~20€ VIN)** — con cards explicativas, links afiliados/external y detector VIN/matrícula en chat.

Hoy `dgt.py` siempre `source="mock"` determinista sin guía; `carvertical/carfax` mock o 501 sin UI; chat no ofrece opciones al detectar matrícula/VIN. No se debe scrapear DGT directo (ToS).

---

## 2. Requerimientos (RFC 2119)

| ID | Requerimiento | Keyword | Archivo(s) |
|----|---------------|---------|------------|
| REQ-001 | El sistema **MUST** crear `front/src/components/dgt/DGTGuideCard.tsx` que **MUST** mostrar badge `Oficial DGT — 8,67€ (tasa 4.1)`, 4 pasos numerados: 1. Entrar en `https://sede.dgt.gob.es/es/vehiculos/informe-de-vehiculo/` 2. Identificarse con Cl@ve o certificado digital 3. Pagar tasa 4.1 (8,67€) con tarjeta 4. Descargar PDF: revisar titulares, cargas/embargos, ITV, km, bajas — más botón `Ir a Sede DGT` con `href` oficial | MUST | `front/src/components/dgt/DGTGuideCard.tsx` (nuevo) |
| REQ-002 | `DGTGuideCard` **MUST** usar `.glass-card` y **MUST** tener links con `target="_blank" rel="noopener noreferrer"` | MUST | mismo |
| REQ-003 | El sistema **MUST** crear `front/src/components/dgt/CarVerticalCard.tsx` que **MUST** mostrar pricing `~15€`, input VIN opcional, beneficios (km real, accidentes, robos, taxi), y link externo a `carvertical.com` con afiliado placeholder | MUST | `front/src/components/dgt/CarVerticalCard.tsx` (nuevo) |
| REQ-004 | El sistema **MUST** crear `front/src/components/dgt/CarfaxCard.tsx` que **MUST** mostrar pricing `~20€`, input VIN, beneficios (historial USA/EU, propietarios, mantenimiento) y link a `carfax.eu` | MUST | `front/src/components/dgt/CarfaxCard.tsx` (nuevo) |
| REQ-005 | Cada card **MUST** ser independiente y reutilizable con props `{ vin?:string, plate?:string }` para prefill | MUST | `front/src/components/dgt/*Card.tsx` |
| REQ-006 | `server/routers/dgt.py` **MUST** exponer flag `source` determinista: `source="mock"` si `MOCK_DGT=="true"` o `!DGT_API_KEY`, `source="real"` si hay integración futura con API real; **MUST** retornar `source` en `DgtResult` | MUST | `server/routers/dgt.py:12-44` |
| REQ-007 | `server/routers/carvertical.py` y `carfax.py` **MUST** retornar `source` (`mock` si `!CARVERTICAL_API_KEY`, `real` si key presente) y **MUST** mantener mock determinista existente sin romper | MUST | `server/routers/carvertical.py:19-35`, `carfax.py:19-34` |
| REQ-008 | La UI `DgtLookupInput.tsx:55-115` **MUST** distinguir visualmente `source mock vs real` con banner/badge: si `source==="mock"` mostrar `Badge Demo — datos de ejemplo` + texto `Informe de demostración, para oficial usa DGTGuideCard`; si `source==="real"` mostrar `Badge Oficial — DGT` | MUST | `front/src/components/dashboard/DgtLookupInput.tsx` |
| REQ-009 | `front/src/app/api/dgt/lookup/route.ts:6` `PLATE_REGEX` **MUST** validar `^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$` (sin A,E,I,O,U,Q,Ñ) y proxy **MUST** propagar `source` al cliente | MUST | `front/src/app/api/dgt/lookup/route.ts` |
| REQ-010 | El chat `front/src/app/api/chat/route.ts` **MUST** detectar matrícula via `detectPlate` existente y VIN via `detectVIN` `/\b[A-HJ-NPR-Z0-9]{17}\b/i` (sin I,O,Q) en el último mensaje | MUST | `front/src/app/api/chat/route.ts:52` |
| REQ-011 | Al detectar matrícula o VIN, el chat **MUST** añadir bloque `## Opciones de historial` en `contextData` y **MUST** instruir al LLM a ofrecer 3 opciones (DGT 8€, CarVertical, Carfax) contextualizadas | MUST | `front/src/app/api/chat/route.ts` |
| REQ-012 | `MessageBubble` / `MessageList` **MUST** renderizar las 3 cards cuando `part.type==="dgt-guide"` o `data.dgtOptions` presente, sin scrapear DGT directo | MUST | `front/src/components/chat/MessageBubble.tsx`, `MessageList.tsx` |
| REQ-013 | Ningún componente **MUST** intentar scraping directo de `sede.dgt.gob.es`; **MUST** solo linkear a URL oficial | MUST | todos |
| REQ-014 | Las cards **MUST** incluir `rel="noopener noreferrer"` en links externos y **MUST** pasar a11y (heading + ol accesible) | MUST | `front/src/components/dgt/*` |
| REQ-015 | El dashboard **SHOULD** mostrar las 3 cards en grid debajo de `DgtLookupInput` cuando no hay `plate` aún (educativo permanente) | SHOULD | `front/src/app/(protected)/dashboard/page.tsx` |
| REQ-016 | El sistema **SHOULD** loggear analytics `dgt_guide_click`, `carvertical_click`, `carfax_click` al pulsar links | SHOULD | `front/src/components/dgt/*` |

### Dependencias
- `server/models/schemas.py:52-64` `VehicleHistory` ya tipado.
- Chat search real (VIN detection) comparte regex.

### Fuera de scope
- Scraping DGT directo, integración privada DGT API sin convenio, facturación/pago in-app de tasa 4.1.

---

## 3. Escenarios (Gherkin)

### SCN-001 — Dashboard muestra DGTGuideCard con pasos oficiales
```gherkin
GIVEN usuario en /dashboard sin haber buscado matrícula
WHEN renderiza DGTGuideCard
THEN ve badge "Oficial DGT — 8,67 € (tasa 4.1)"
  AND ol con 4 pasos numerados (sede.dgt.gob.es → Cl@ve/certificado → pagar tasa 4.1 → descargar PDF)
  AND botón <a href="https://sede.dgt.gob.es/es/vehiculos/informe-de-vehiculo/" target="_blank" rel="noopener">Ir a Sede DGT</a>
  AND card tiene clase glass-card
```

### SCN-002 — CarVerticalCard y CarfaxCard con pricing
```gherkin
GIVEN dashboard con CarVerticalCard
WHEN inspecciona
THEN muestra "~15€" + beneficios km/accidentes/robos + link carvertical.com con rel noopener
GIVEN CarfaxCard
THEN muestra "~20€" + link carfax.eu
```

### SCN-003 — DGT mock vs real banner
```gherkin
GIVEN env MOCK_DGT=true y lookup plate "1234BCD" vía POST /dgt
WHEN server retorna {plate:"1234-BCD", make:"SEAT", source:"mock", year:2019}
THEN DgtLookupInput muestra Badge "Demo — datos de ejemplo" y texto "Informe de demostración…"
GIVEN env MOCK_DGT=false y DGT_API_KEY presente y source real
WHEN retorna source "real"
THEN badge "Oficial — DGT" sin texto demo
```

### SCN-004 — Chat detecta matrícula y ofrece 3 opciones
```gherkin
GIVEN usuario envía "¿qué sabes de 1234 BCD?"
WHEN chat/route detectPlate extrae "1234-BCD" y lookupDgt retorna mock
THEN contextData añade:
  """
  ## Consulta DGT — Matrícula 1234-BCD: ...
  ## Opciones de historial
  - DGT oficial 8,67€: https://sede.dgt.gob.es/...
  - CarVertical (VIN, ~15€)
  - Carfax (VIN, ~20€)
  """
  AND LLM responde ofreciendo 3 opciones con links
  AND MessageBubble renderiza DGTGuideCard + CarVerticalCard + CarfaxCard si part type dgt-guide presente
```

### SCN-005 — Chat detecta VIN 17 chars y ofrece CarVertical/Carfax
```gherkin
GIVEN usuario envía "VIN WVWZZZ1JZ3W386752 qué historial tiene?"
WHEN detectVIN captura "WVWZZZ1JZ3W386752" via /\b[A-HJ-NPR-Z0-9]{17}\b/i
THEN contextData incluye bloque VIN y system prompt instruye a LLM a recomendar CarVertical/Carfax con link y guía DGT si aporta matrícula también
  AND cards CarVerticalCard y CarfaxCard prefill vin="WVWZZZ1JZ3W386752"
```

### SCN-006 — VIN con I/O/Q no detecta (negativo)
```gherkin
GIVEN usuario envía "VIN WVWZZZ1QZ3W386752" (contiene Q prohibida)
WHEN detectVIN evalúa
THEN no match (null) y no ofrece cards VIN
```

### SCN-007 — No scraping DGT directo
```gherkin
GIVEN cualquier componente dgt
WHEN inspecciona código con grep -R "sede.dgt.gob.es.*fetch|axios.*dgt"
THEN 0 ocurrencias de fetch directo a DGT; solo <a href> links
```

### SCN-008 — Links externos seguros
```gherkin
GIVEN DGTGuideCard renderizada
WHEN inspecciona <a> a sede.dgt
THEN tiene target="_blank" rel="noopener noreferrer"
GIVEN CarVerticalCard link
THEN igual rel noopener
```

### SCN-009 — DgtLookupInput con plate real muestra datos + banner + cards
```gherkin
GIVEN usuario ingresa "5678XYZ" y backend retorna source mock
WHEN DgtLookupInput muestra resultado
THEN ve datos make/model/year/fuel/power/ITV/enrollment
  AND banner Demo
  AND debajo grid con 3 cards didácticas visibles (DGTGuide, CarVertical, Carfax)
```

---

## 4. Criterios de Aceptación

- [ ] Archivos `front/src/components/dgt/DGTGuideCard.tsx`, `CarVerticalCard.tsx`, `CarfaxCard.tsx` existen, usan `.glass-card`, y contienen links correctos con `rel noopener` (verificado por grep).
- [ ] `server/routers/dgt.py` retorna `source` mock/real según env, y `carvertical.py`/`carfax.py` igual.
- [ ] `front/src/app/api/dgt/lookup/route.ts` valida `PLATE_REGEX` sin A,E,I,O,U,Q,Ñ y propaga `source`.
- [ ] `front/src/app/api/chat/route.ts` detecta VIN 17 sin I/O/Q y matrícula, inyecta bloque `Opciones de historial` y renderiza cards en `MessageList`/`MessageBubble`.
- [ ] `DgtLookupInput` muestra badge Demo vs Oficial según `source`.
- [ ] `grep -R "fetch.*sede.dgt" front server` vacío (no scraping directo).
- [ ] Build y tests pasan; a11y de cards ≥95.

## 5. Riesgos

- **Confusión mock vs real**: mitigado con badge Demo prominente + DGTGuideCard siempre visible educativo.
- **Links afiliados placeholder**: documentar `CARVERTICAL_AFFILIATE_ID` env para futuro; hoy link directo sin afiliado es aceptable.

## 6. Métricas de Éxito

- ≥60% consultas matrícula/VIN muestran `DGTGuideCard` y ≥15% click en `sede.dgt` (analytics).
- 0 scraping DGT directo (CI grep).
- Lighthouse a11y dgt cards ≥95.
