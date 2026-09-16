# Proposal: AutoMisho v2 Agentic Core

**Change ID:** `automisho-v2-agentic-core`  
**Status:** `proposed` — awaiting approval  
**Date:** 2026-09-16  
**Authors:** Senior Architect & Agentic Core Engineering  
**Depends on:** `openspec/specs/automisho-ux-pro/*`  
**Store Mode:** `openspec`  

---

## 1. Intent & Motivation (Why)

### 1.1 The Limits of AutoMisho v1
AutoMisho v1 established a polished visual experience (Hyper Foundation design tokens, liquid glass cards, and basic scrapers for used cars in Spain). However, its backend and intelligence foundations remain fundamentally constrained:

1. **Brittle Regex Intent & Hardcoded Model Coupling**: Chat interaction in v1 relies on fragile regex heuristics (`/menos de (\d+)/`, keywords matching) to trigger car queries. The AI layer was restricted to single-model execution without resilient fallback, dynamic routing, or budget-based cost optimization.
2. **Synchronous, Vulnerable Web Scraping**: The scrapers in `server/routers/scrape.py` run in-process using `httpx` and `BeautifulSoup4`. Frequent anti-bot challenges (Cloudflare, Akamai, dynamic SPA rendering in Wallapop/coches.net/Milanuncios) cause blocking (HTTP 403), connection timeouts, and memory pressure inside the main API server.
3. **No Stateful Agentic Memory**: Memory in v1 is ephemeral, restricted to single conversation threads in PostgreSQL without semantic similarity search, user profile evolution, or asynchronous background task tracking.
4. **Unprotected Execution Boundaries**: Without an authorization sentinel, AI tool execution lacks a security boundary. Autonomous actions (messaging sellers, initiating email offers, simulating vehicle reservations) cannot be safely exposed to an LLM without strict human-in-the-loop (HITL) gates.
5. **Lack of Automated Testing in Backend**: `server/` has no test runner or test suite installed (`pytest` not configured, zero automated tests), violating strict engineering practices for agentic systems where non-deterministic AI decisions must be rigorously bounded by deterministic unit/integration tests.

### 1.2 The v2 Vision
AutoMisho v2 transforms the product from a reactive chatbot with web scraping scripts into a **production-grade Autonomous Agentic Copilot**. Version 2 introduces:
- A multi-model gateway with cost/intent routing using Command Code Provider API and Muse Spark 1.3.
- A Sentinel Tool Gateway with strict autonomous vs. authorization-gated execution boundaries.
- A 4-layer persistent memory hierarchy (User Profile, Conversational, pgvector Semantic, Redis Task).
- An isolated headless browser worker running Playwright in a dedicated container.
- A hardened multi-service Docker Compose topology.
- A strict TDD discipline in `server/` starting with test harness bootstrapping (T-0).

---

## 2. Scope

### 2.1 In Scope
- **Model Gateway (Command Code Provider API)**:
  - Integration with OpenAI-compatible endpoint: `https://api.commandcode.ai/provider/v1`.
  - Primary reasoning model: Muse Spark 1.3 (`meta/muse-spark-1.3`).
  - Fallback and cost routing matrix: DeepSeek V4 Flash (high speed/extraction) and Gemini 2.5/Pro (vision/multimodal inspection).
  - Exponential backoff, timeout handling, circuit breaker, and token-cost tracking.
- **Sentinel Tool Gateway**:
  - Binary policy separation: Safe Autonomous Tools vs. Sensitive Authorization-Gated Tools.
  - Safe tools: `search_cars`, `inspect_listing`, `dgt_lookup`, `car_vision`.
  - Sensitive tools: `send_whatsapp`, `send_offer_email`, `reserve_car`.
  - Two-Phase Commit (2PC) approval workflow: intent proposal -> cryptographic confirmation token generation -> client prompt -> execution upon signature validation.
- **4-Layer Persistent Memory Architecture**:
  - Layer 1 (User Profile): Structured preferences, constraints, location, budget envelope.
  - Layer 2 (Conversational): Active session buffer with sliding window and compaction.
  - Layer 3 (Semantic Memory): Vector storage using PostgreSQL + `pgvector` with HNSW indexing for listing similarity, vehicle history, and semantic retrieval.
  - Layer 4 (Task Memory): Redis-backed state machine for background watchdogs, price alert tracking, and asynchronous scraping jobs.
- **Isolated Browser Worker**:
  - Independent service running Playwright container (`automisho-browser`) with stealth plugin, human-like interaction emulation, and session cookie persistence.
  - RPC/REST interface between `automisho-orchestrator` and `automisho-browser`.
  - Graceful degradation: cached catalog -> fast HTTP API scraper -> browser worker.
- **Multi-Container Docker Compose Topology**:
  - `automisho-front`: Next.js 16 frontend.
  - `automisho-orchestrator`: FastAPI agentic backend.
  - `automisho-browser`: Containerized Playwright headless worker.
  - `automisho-db`: PostgreSQL 16 with `pgvector` extension.
  - `automisho-redis`: Redis 7 Alpine for task queues and memory layer 4.
  - Isolated bridge network with internal DNS resolution and strict health checks.
- **Strict TDD Engineering Bootstrap (T-0)**:
  - Setup of `pytest`, `pytest-asyncio`, `httpx[http2]`, and `pytest-mock` in `server/`.
  - Creation of `server/conftest.py` with mock LLM providers, database fixtures, and tool mocks.
  - Verification of green baseline before implementing features.

### 2.2 Out of Scope (Non-Goals)
- Direct scraping of DGT private portals (illegal under Spanish law; v2 maintains official DGT report guide + verified external APIs).
- Direct banking integration or live payment execution (car reservation is simulated via escrow intent/signed authorization, not direct SEPA bank debit).
- Native iOS / Android apps (web responsiveness with PWA capabilities remains the standard).
- Multi-region geo-distributed database clustering (single-region docker compose / VPC deployment is sufficient for current scale).

---

## 3. Capabilities

### 3.1 New Capabilities
- `model-gateway`: Unified multi-model routing gateway over Command Code Provider API (`https://api.commandcode.ai/provider/v1`) featuring Muse Spark 1.3 (`meta/muse-spark-1.3`), cost/intent routing, and resilient automatic fallback (DeepSeek V4 Flash, Gemini).
- `sentinel-tool-gateway`: Security boundary strictly partitioning autonomous safe tools (`search_cars`, `inspect_listing`, `dgt_lookup`, `car_vision`) from authorization-gated sensitive actions (`send_whatsapp`, `send_offer_email`, `reserve_car`) requiring explicit two-phase commit user consent.
- `four-layer-memory`: Multi-tier persistent memory system combining User Profile (preferences & budget), Conversational Context (session window), Semantic Memory (pgvector embeddings for car listings and historical evaluations), and Task Memory (Redis-backed state for async long-running tasks).
- `isolated-browser-worker`: Standalone containerized Playwright service communicating via internal REST/RPC to execute resilient dynamic scraping, bypassing anti-bot measures and headless fingerprinting without risking the orchestrator.
- `orchestrator-topology`: Multi-container Docker Compose infrastructure unifying `automisho-front`, `automisho-orchestrator`, `automisho-browser`, `automisho-db` (pgvector), and `automisho-redis` with isolated networking and healthchecks.
- `server-tdd-harness`: Comprehensive testing harness in `server/` implementing strict red-green-refactor TDD, bootstrapping pytest, pytest-asyncio, and pytest fixtures (`conftest.py`).

### 3.2 Modified Capabilities
- `chat-search-real`: Replaced regex-based naive keyword matching and inline synchronous scraping with Sentinel-governed tool calling, background agentic search, multi-source aggregation via browser worker, and pgvector semantic retrieval.
- `security-hardening`: Extended from API route Zod validation and rate limiting to full agentic security boundaries, RBAC, two-phase authorization tokens for sensitive external tools, and secure container networking.

---

## 4. Approach & Architectural Blueprint

### 4.1 System Topology Overview

```
                          [ Next.js 16 Client / UI ]
                                       │
                        HTTPS / WSS    │  (NextAuth v5 + JWT)
                                       ▼
                     [ automisho-orchestrator (FastAPI) ]
                     ┌───────────────────────────────────┐
                     │ • Model Gateway (Muse Spark 1.3)  │
                     │ • Sentinel Tool Gateway (2PC HITL)│
                     │ • 4-Layer Memory Orchestrator     │
                     └───────┬───────────┬───────────────┘
                             │           │
           Internal HTTP/RPC │           │ Vector / SQL
                             ▼           ▼
        [ automisho-browser ]     [ automisho-db ]
        (Playwright Stealth)     (PostgreSQL + pgvector)
                             │
                             ▼ Task Queue / State
                      [ automisho-redis ]
```

### 4.2 Model Gateway & Provider Matrix
The orchestrator routes requests through a unified gateway:
- **Base Endpoint**: `https://api.commandcode.ai/provider/v1`
- **Default Cognitive Model**: `meta/muse-spark-1.3` (high reasoning, structured agentic tool dispatch, Spanish fluency).
- **Fast / Cost-Effective Fallback**: `deepseek/deepseek-v4-flash` (for query parsing, tabular extraction, intent scoring).
- **Visual Analysis Model**: `google/gemini-2.5-pro` (for vehicle damage inspection, sticker verification, interior wear analysis).
- **Resilience Policy**: Exponential backoff (jittered 500ms..4000ms), max retries = 3. Automatic circuit breaker trips to fallback model on HTTP 429 or 5xx lasting > 10 seconds.

### 4.3 Sentinel Tool Gateway Matrix

| Tool Name | Classification | Execution Mode | Pre-requisites & Security Checks |
|-----------|----------------|----------------|----------------------------------|
| `search_cars` | **Safe** | Autonomous | Parameter clamping (price > 0, km > 0, source validation). |
| `inspect_listing` | **Safe** | Autonomous | Rate-limited per listing URL, domain whitelist. |
| `dgt_lookup` | **Safe** | Autonomous | Plate/VIN regex sanitization, demo/official flag. |
| `car_vision` | **Safe** | Autonomous | MIME type validation, file size limit (10MB), malware scan. |
| `send_whatsapp` | **Sensitive** | **Authorization Required** | 2PC confirmation token; UI presents recipient, message preview, and vehicle link before dispatch. |
| `send_offer_email` | **Sensitive** | **Authorization Required** | 2PC confirmation token; formal proposal preview with exact price offer, terms, and user contact. |
| `reserve_car` | **Sensitive** | **Authorization Required** | 2PC confirmation token; biometric or explicit typed confirmation with deposit amount and refund terms. |

### 4.4 4-Layer Memory Architecture

```
+-------------------------------------------------------------------------+
| Layer 1: User Profile Memory (Prisma / PostgreSQL user_profiles)        |
| - Preferred makes/models, max budget, body type, fuel preferences       |
| - Risk tolerance (e.g., maximum km threshold, preferred warranty type)  |
+-------------------------------------------------------------------------+
                                     │
+-------------------------------------------------------------------------+
| Layer 2: Conversational Memory (In-Memory Buffer + Sliding Window)      |
| - Last N turns preserved in full fidelity                               |
| - Summarization pipeline periodically compacts older context into L1/L3 |
+-------------------------------------------------------------------------+
                                     │
+-------------------------------------------------------------------------+
| Layer 3: Semantic Memory (PostgreSQL + pgvector - HNSW cosine)           |
| - Embeddings of verified vehicle listings, price trend benchmarks       |
| - Past vehicle evaluations, common mechanical failure reports per model |
+-------------------------------------------------------------------------+
                                     │
+-------------------------------------------------------------------------+
| Layer 4: Task Memory (Redis 7 + Celery/ARQ Worker)                      |
| - Asynchronous search jobs across 4 marketplaces                        |
| - Long-running price drop watchdogs & alert triggers                    |
+-------------------------------------------------------------------------+
```

### 4.5 Isolated Browser Worker Architecture
Rather than running headless browsers inside the main API container:
- Service `automisho-browser` runs a dedicated Docker image with pre-installed Chromium, Firefox, and stealth evasions.
- Exposes a minimal REST API: `POST /scrape/session` and `POST /scrape/extract`.
- Rotates user-agents, manages proxy sessions, solves dynamic DOM rendering, and extracts sanitized structured JSON.
- `automisho-orchestrator` interacts with the worker via non-blocking async HTTP calls with strict timeouts (15s per source).

### 4.6 Strict TDD Strategy in `server/`
1. **Phase T-0 (Bootstrap)**: Add `pytest`, `pytest-asyncio`, `pytest-mock`, `httpx` to `server/requirements.txt`. Create `server/tests/conftest.py` with mock client fixtures.
2. **Red Phase**: Write unit and integration tests verifying tool schemas, Sentinel security boundaries, memory storage, and model routing before implementation.
3. **Green Phase**: Implement the minimum code required to satisfy the assertions.
4. **Refactor Phase**: Optimize, eliminate redundancy, enforce typing, and lint with `ruff`.

---

## 5. Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/requirements.txt` | Modified | Add `pytest`, `pytest-asyncio`, `pytest-mock`, `redis`, `pgvector`, `playwright`. |
| `server/tests/` | **New** | Bootstrap test hierarchy (`conftest.py`, `unit/`, `integration/`). |
| `server/core/gateway.py` | **New** | Command Code Provider API client, Muse Spark 1.3 integration, fallback routing. |
| `server/core/sentinel.py` | **New** | Sentinel gateway enforcing Safe vs. Sensitive tool boundaries with 2PC tokens. |
| `server/memory/` | **New** | 4-layer memory implementations (profile, buffer, pgvector semantic, Redis task). |
| `server/workers/browser/` | **New** | Browser worker interface and client connector. |
| `docker-compose.yml` | **New** | Multi-container setup (`front`, `orchestrator`, `browser`, `db`, `redis`). |
| `front/src/app/api/chat/route.ts` | Modified | Upgrade to agentic streaming, Sentinel confirmation events, and tool rendering. |
| `front/src/components/chat/` | Modified | Add confirmation UI modal/card for sensitive tool authorizations. |
| `server/routers/scrape.py` | Modified | Delegate dynamic scraping to `automisho-browser` with catalog fallback. |

---

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Command Code API downtime or latency spikes** | Medium | High | Automated fallback router configured with DeepSeek V4 Flash and Gemini; circuit breaker opens after 3 consecutive failures. |
| **Sensitive tool accidental execution (AI hallucination)** | Low | Critical | Strict Sentinel enforcement: sensitive tools cannot execute without a cryptographically signed user token from the frontend UI. |
| **Playwright memory leak in browser container** | Medium | Medium | Single-process browser isolation; automated worker container restart policy (`max-requests-per-child`), headless memory limits. |
| **pgvector extension compatibility with Postgres 16** | Low | Medium | Use official `pgvector/pgvector:pg16` Docker image; automated schema migration verifying vector extension on startup. |
| **TDD friction delaying initial bootstrap** | Low | Low | T-0 dedicates bootstrap task solely to testing harness and fixtures to guarantee instant test velocity. |

---

## 7. Rollback Plan

1. **Containers & Infrastructure**: If docker-compose multi-container setup encounters networking or orchestration failures, fallback immediately to standalone local execution mode (`npm run dev` in `front/` and `uvicorn` in `server/` with external managed DB).
2. **Model Gateway**: If Command Code Provider endpoint is unavailable, an environment toggle `MODEL_GATEWAY_PROVIDER=direct` allows falling back to standard direct API keys (Gemini / DeepSeek).
3. **Sentinel Gateway**: Sentinel tool definitions include an immediate emergency bypass `SENTINEL_LOCKDOWN=true` which drops all sensitive tool registrations and operates in read-only informational search mode.
4. **Browser Worker**: If `automisho-browser` fails to respond or crashes, the scraper gracefully falls back to direct `httpx` static parsing and internal `market_catalog.py` cached fixtures.
5. **Git Rollback**: All changes are committed in structured semantic units. A single revert of the merge commit will restore v1 functionality cleanly without database corruption.

---

## 8. Dependencies

- **Command Code Provider API Key**: Required for Muse Spark 1.3 and provider routing (`COMMANDCODE_API_KEY`).
- **Docker & Docker Compose**: Required for multi-container topology (`docker-compose.yml`).
- **PostgreSQL with pgvector**: Supported via Docker or managed provider with `CREATE EXTENSION IF NOT EXISTS vector`.
- **Redis 7+**: Required for async task queues and memory layer 4.

---

## 9. Success Criteria

- [ ] **TDD Baseline Operational**: `pytest server/tests` executes and passes with 0 errors in CI/local environments.
- [ ] **Model Gateway Resilience**: Automatic failover from Muse Spark 1.3 to fallback model on injected 500 error within < 1.5 seconds.
- [ ] **Sentinel Tool Security Guarantee**: 100% of sensitive tool calls (`send_whatsapp`, `send_offer_email`, `reserve_car`) are blocked with HTTP 403 / confirmation request if attempted without user signature token.
- [ ] **Semantic Retrieval Performance**: Car listing vector similarity queries return in < 150ms using pgvector HNSW indexing.
- [ ] **Browser Worker Isolation**: Playwright worker extracts listings from dynamic javascript-heavy sites without memory leakage in orchestrator service.
- [ ] **End-to-End Container Health**: All 5 Docker Compose services start, pass health checks, and communicate over the internal bridge network.
