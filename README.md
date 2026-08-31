# 🏎️ AutoMisho — AI Automotive Copilot & Deal Negotiator

<div align="center">

![AutoMisho Banner](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)
![License](https://img.shields.io/badge/License-Proprietary-97fcd7?style=for-the-badge)

**El Copiloto IA de Compraventa y Negociación de Vehículos de Ocasión en España**

*Búsqueda agregada en tiempo real · Auditoría DGT e ITVs · Asesor de llamada al vendedor · Estrategias de contraoferta*

</div>

---

## 🌟 Visión del Producto

Comprar un coche de segunda mano en España suele ser un proceso fragmentado, opaco y lleno de incertidumbre (anuncios duplicados, historial oculto de siniestros, kilometrajes manipulados y negociaciones difíciles). 

**AutoMisho** transforma esta experiencia proporcionando un **Copiloto Inteligente 360°** que acompaña al comprador en cada fase del ciclo:
1. **Descubrimiento Inteligente:** Búsqueda simultánea y en vivo en los 4 grandes portales del mercado español (**AutoScout24, Coches.net, Wallapop y Milanuncios**).
2. **Espacio de Trabajo Dividido (Copilot Workspace):** Interfaz dividida al 45/55 con chat consultivo y dashboard dinámico de comparativa en tiempo real (score IA, pros/contras, precios y enlaces directos).
3. **Auditoría Oficial DGT & Documentación:** Decodificador de matriculaciones oficiales (2000-2026), cálculo de etiqueta ambiental DGT (0, ECO, C, B) y análisis automatizado de informes en **PDF** (cargas, embargos, defectos graves de ITV).
4. **Asesor de Negociación:** Preparación de llamadas telefónicas a vendedores y generación de contraofertas técnicas con descuento justificado.

---

## 💎 Características Principales

```mermaid
graph TD
    User["Comprador"] -->|Consulta o Presupuesto| Copilot["AutoMisho Copilot Engine"]
    Copilot -->|Scraping Concurrente HTTP/2| SearchHub["Motor Multi-Portal (AutoScout24, Coches.net, Wallapop, Milanuncios)"]
    Copilot -->|Verificación Oficial| DGTEngine["DGT Plate & Environmental Badge Decoder"]
    Copilot -->|Auditoría Documental| PDFEngine["Analizador de Informes PDF (DGT, ITVs, CarVertical)"]
    SearchHub --> Dashboard["Copilot Live Dashboard (Score, Pros/Cons, Links)"]
    DGTEngine --> Negotiation["Asesor de Negociación y Contraoferta"]
    PDFEngine --> Negotiation
```

### 1. ⚡ Copilot Split Workspace (Chat + Live Dashboard)
- **Vista Dividida 45% / 55%:** En el panel izquierdo, un chat reactivo token-a-token; en el panel derecho, un dashboard dinámico que renderiza las tarjetas de los vehículos descubiertos en el instante en que el agente termina su respuesta.
- **Scoring & Auditoría de Oportunidades:** Puntuación de 0 a 100 basada en relación precio/año/km, con viñetas claras de ventajas (`✓`) y puntos de atención (`⚠`).
- **Filtros Dinámicos por Portal y Combustible:** Explora ofertas filtrando por fuente (`AutoScout24`, `Coches.net`, `Wallapop`, `Milanuncios`) o tipo de motorización (`Diésel`, `Gasolina`, `Híbrido/ECO`).

### 2. 🏎️ Motor de Agregación Multi-Portal Concurrente
- **Modo Búsqueda Rápida (~2.0s):** Escaneo optimizado en AutoScout24 y Coches.net para respuestas instantáneas.
- **Modo Búsqueda Profunda (~4.0s):** Escaneo simultáneo con `asyncio.gather` en los 4 portales líderes.
- **Agregación Equitativa (Round-Robin):** Algoritmo de intercalado para asegurar una distribución balanceada de ofertas de toda España.
- **Direct Vehicle Links:** Extracción de identificadores únicos (`data-guid`) para generar enlaces directos a las fichas reales de los anuncios.

### 3. 🛡️ Verificación DGT Real & Historial del Vehículo (Cero Mocks)
- **Decodificador Matemático Oficial DGT:** Algoritmo matemático con las tablas oficiales de matriculación de España (desde `0000 BBB` en sept 2000 hasta la actualidad) para calcular el año y mes exacto de matriculación.
- **Distintivo Ambiental DGT:** Cálculo de etiqueta ambiental (0 Azul, ECO Verde/Azul, C Verde, B Amarillo, Sin Distintivo) según año y combustible Euro 3/4/5/6.
- **Conector REST Partner (InfoCoche / ZuluLabs):** Arquitectura plug-and-play para conectar APIs REST homologadas de la DGT con `DGT_PROVIDER_API_KEY`.
- **Acceso Telemático Oficial:** Enlace directo a la tasa 4.1 de 8,67€ en la Sede Electrónica de la DGT.

### 4. 📄 Subida y Auditoría de Documentos PDF en Vivo
- Soporte para **arrastrar y soltar (Drag & Drop) archivos PDF** e imágenes directamente al input del chat.
- Extracción de texto e inspección inteligente: audita defectos en fichas de ITV, embargos o precintos administrativos, y coherencia en lecturas de kilometraje histórico.

### 5. 🎙️ Asistente de Llamada al Vendedor y Negociación
- **Cierre Proactivo Guiado:** Cada búsqueda concluye con las 3 preguntas clave para el vendedor (facturas de mantenimientos críticos como distribución y embrague, matrícula/VIN y motivo de venta).
- **Detector de Inconsistencias y Contraoferta:** Analiza lo que relata el vendedor, detecta señales de alerta (ej. rematriculaciones no informadas) y redacta una estrategia de negociación con argumentos técnicos.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend** | **Next.js 16** (App Router, Server Components, Server Actions), **React 19**, **TypeScript** (Strict Mode) |
| **Estilos & UI** | **Tailwind CSS v4** (`@layer base`), **Framer Motion**, **Hyper Foundation Design System** |
| **IA & Streaming** | **Vercel AI SDK (`ai` v7 / `@ai-sdk/react` v4)**, **OpenCode Go** (DeepSeek / Qwen), SSE UI Message Stream |
| **Backend & Scraping** | **FastAPI**, **Python 3.12**, **HTTPX** (HTTP/2 con reintentos), **BeautifulSoup4 / lxml** |
| **Base de Datos & Auth** | **PostgreSQL**, **Prisma ORM**, **Auth.js / NextAuth v5** (JWT Session Strategy) |
| **Pagos & Monetización**| **Stripe Checkout & Webhooks** (Planes Starter, Pro y Dealer) |

---

## 🎨 Sistema de Diseño (Hyper Foundation Tokens)

AutoMisho implementa una estética de **Liquid Glass** y alta tecnología inspirada en acabados automotrices de lujo:

```
• Forest Depths    #072724   ─── Fondo principal oscuro y sofisticado
• Midnight Tide    #0f3933   ─── Contenedores, tarjetas y bordes estructurales
• Shadow Teal      #23524c   ─── Elementos interactivos y estados hover
• Mint Glow        #97fcd7   ─── Acentos luminosos, llamadas a la acción y badges
• Pure Light       #f8fafc   ─── Tipografía principal de alto contraste
• Mist Gray        #94a3b8   ─── Subtítulos y metadatos secundarios
```

- **Tipografía:** `Teodor Display` para encabezados y números de precio de impacto; `Inter` para lectura técnica y chats.
- **Geometría:** Botones píldora de 60px y tarjetas con acabado `backdrop-blur-xl`.

---

## 📂 Estructura del Repositorio (Monorepo)

```text
compra_coches/
├── front/                          # Frontend Next.js 16 + React 19
│   ├── src/
│   │   ├── app/
│   │   │   ├── (protected)/        # Rutas autenticadas (/chat, /chat/[id], /dashboard)
│   │   │   ├── api/                # API Routes (chat SSE, auth, dgt, checkout, stripe)
│   │   │   └── globals.css         # Tokens Hyper Foundation & Tailwind v4
│   │   ├── components/
│   │   │   ├── chat/               # ChatWindow, CopilotLiveDashboard, CarResultCard, etc.
│   │   │   ├── dashboard/          # Portal Mi Cuenta & Métricas
│   │   │   └── sections/           # DataSources, Pricing, Hero
│   │   ├── lib/                    # dgt-decoder, dgt-client, chat-helpers, auth, prisma
│   │   └── types/                  # Tipos TypeScript compartidos (CarResult, DgtReport)
│   └── package.json
│
├── server/                         # Backend FastAPI + Scrapers
│   ├── models/                     # Esquemas Pydantic (ScrapeRequest, CarResult)
│   ├── routers/
│   │   ├── scrape.py               # Scrapers concurrentes (AutoScout24, coches.net, Wallapop, Milanuncios)
│   │   └── dgt.py                  # Endpoints de consulta DGT
│   ├── main.py                     # Entrypoint Uvicorn / FastAPI
│   └── requirements.txt
│
├── .gitignore                      # Reglas de exclusión de seguridad y builds
└── README.md                       # Documentación corporativa del proyecto
```

---

## 🚀 Guía de Instalación y Puesta en Marcha

### Prerrequisitos
- **Node.js 20+** y **npm**
- **Python 3.11+**
- Base de datos **PostgreSQL** (o SQLite para pruebas locales)

---

### 1. Configuración del Backend (FastAPI)

```bash
cd server
python -m venv .venv

# En Windows:
.venv\Scripts\activate
# En Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
python main.py
```
> El servidor FastAPI quedará disponible en `http://localhost:8000` con documentación interactiva en `/docs`.

---

### 2. Configuración del Frontend (Next.js)

```bash
cd front
pnpm install

# Configura las variables de entorno
cp .env.local.example .env.local
```

Configura tus credenciales en `front/.env.local`:
```env
# Base de Datos
DATABASE_URL="postgresql://user:password@localhost:5432/automisho"

# Auth.js / NextAuth
NEXTAUTH_SECRET="tu-secreto-seguro"
NEXTAUTH_URL="http://localhost:3000"

# Proveedor de Inteligencia Artificial (OpenCode Go / DeepSeek / Qwen)
OPENCODE_BASE_URL="https://opencode.ai/zen/go/v1"
OPENCODE_API_KEY="tu-opencode-api-key"
OPENCODE_MODEL="qwen3.7-plus"

# Backend FastAPI
BACKEND_URL="http://localhost:8000"

# Opcional: Proveedor DGT Partner REST (ej. InfoCoche)
# DGT_PROVIDER_API_KEY="tu-api-key-infocoche"
```

Genera el cliente Prisma y ejecuta la base de datos:
```bash
pnpm prisma generate
pnpm prisma db push
```

Inicia el entorno de desarrollo:
```bash
pnpm dev
```
> Abre tu navegador en `http://localhost:3000`.

---

## 🧪 Pruebas Automatizadas y Calidad de Código

El proyecto cuenta con una sólida suite de pruebas unitarias y de integración:

```bash
cd front
# Ejecutar suite de pruebas Jest
pnpm test

# Ejecutar compilación de producción Next.js
pnpm build
```

---

## 🔒 Seguridad y Cumplimiento Normativo

- **Validación Estricta de Esquemas:** Validación bidireccional con **Zod** en frontend y **Pydantic** en backend.
- **Protección contra Inyecciones & XSS:** Sanitización de Markdown y enlaces externos con `rel="noopener noreferrer"`.
- **Gestión de Secretos:** Exclusión rigurosa en `.gitignore` de certificados `.pem`/`.pfx`, claves `.env` y bases de datos locales.
- **Rate Limiting:** Control de peticiones por plan de suscripción para prevenir abusos del motor de scraping e inferencia IA.

---

<div align="center">

**AutoMisho** — Impulsado con IA de vanguardia para revolucionar la compra de vehículos de ocasión.

</div>
