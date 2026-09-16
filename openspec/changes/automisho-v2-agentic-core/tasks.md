# Implementation Tasks: AutoMisho v2 Agentic Core

**Change ID:** `automisho-v2-agentic-core`  
**Status:** `planned`  
**Date:** 2026-09-16  
**Depends on:** `design.md`, `specs/*.md`, `proposal.md`  

---

## Review Workload Forecast
- **Estimated Changed Lines:** ~1200 lines (across server/, docker-compose, and client adapter)
- **Chained PRs Recommended:** Yes (stacked-to-main strategy)
- **400-Line Budget Risk:** High
- **Decision needed before apply:** Resolved in Preflight (`auto-chain` + commits directos por batches).

---

## Phase 1: Test Harness Bootstrap & Model Gateway (TDD)
Focus: Install pytest harness in server/, configure Command Code Provider API adapter, Muse Spark 1.3 tiering, fallback circuit breaker.

- [ ] **T-1.0: Bootstrap Server Test Harness (T-0)**
  - Add `pytest`, `pytest-asyncio`, `pytest-mock` to `server/requirements.txt`
  - Create `server/tests/conftest.py` with FastAPI TestClient and mock fixtures
  - Verify `python -m pytest server/tests` runs cleanly
- [ ] **T-1.1: Implement Model Gateway Tests (RED)**
  - Create `server/tests/test_model_gateway.py`
  - Test Command Code Provider API payload formatting (OpenAI-compatible)
  - Test circuit breaker tripping after 3 consecutive failures
  - Test fallback cascading from Muse Spark 1.3 to Gemini
- [ ] **T-1.2: Implement Model Gateway Service (GREEN & REFACTOR)**
  - Create `server/services/model_gateway.py`
  - Support `meta/muse-spark-1.3` as primary agentic engine
  - Implement exponential backoff, retry policy, and circuit breaker
  - Verify all tests in `server/tests/test_model_gateway.py` pass

---

## Phase 2: Sentinel Tool Gateway & 2PC Security Layer (TDD)
Focus: Implement the security boundary separating Safe Autonomous Tools from Sensitive Tools requiring Two-Phase Commit tokens.

- [ ] **T-2.1: Implement Sentinel Gateway Tests (RED)**
  - Create `server/tests/test_sentinel_gateway.py`
  - Test tool classification (safe vs sensitive)
  - Test HMAC-SHA256 token generation, expiration (10 min), and nonce replay protection
  - Test rejection of autonomous execution for sensitive tools (`send_whatsapp`, `send_offer_email`, `reserve_car`)
  - Test token execution flow upon valid user signature
- [ ] **T-2.2: Implement Sentinel Tool Gateway (GREEN & REFACTOR)**
  - Create `server/services/sentinel.py`
  - Implement tool registry schema generator (OpenAI function calling format)
  - Implement 2PC token manager with HMAC signing
  - Register safe tools (`search_cars`, `inspect_listing`, `dgt_lookup`, `car_vision`)
  - Register sensitive tools with staging responses
  - Verify all tests in `server/tests/test_sentinel_gateway.py` pass

---

## Phase 3: 4-Layer Memory System (UserProfile, Buffer, pgvector, Redis)
Focus: Data persistence layer for user preferences, chat sliding window, vector embeddings for car listings, and async background task scheduling.

- [ ] **T-3.1: Implement Memory System Tests (RED)**
  - Create `server/tests/test_memory_system.py`
  - Test UserProfile preference update logic
  - Test conversation sliding window compaction
  - Test Redis task memory state machine (schedule, status, cancel)
- [ ] **T-3.2: Implement 4-Layer Memory Services (GREEN & REFACTOR)**
  - Create `server/services/memory/` module (`user_profile.py`, `conversation_buffer.py`, `semantic_memory.py`, `task_memory.py`)
  - Add pgvector extension migration / setup script for PostgreSQL
  - Implement Redis client for background task state
  - Verify all memory tests pass

---

## Phase 4: Isolated Browser Worker & Multi-Container Topology
Focus: Dedicated Playwright container (`automisho-browser`) and production Docker Compose configuration.

- [ ] **T-4.1: Create Browser Worker Service**
  - Create `server/browser_worker/Dockerfile` and `server/browser_worker/main.py`
  - Configure Playwright with stealth plugin and context recycling (100 runs)
  - Expose `/scrape/search` and `/scrape/inspect` REST endpoints
- [ ] **T-4.2: Integrate Orchestrator with Browser Worker**
  - Update `server/routers/scrape.py` to route heavy requests to `automisho-browser` with static HTTP fallback
  - Add healthcheck and graceful degradation
- [ ] **T-4.3: Configure Root Docker Compose v2 Topology**
  - Create/Update `docker-compose.yml` with:
    - `automisho-front` (Next.js 16)
    - `automisho-orchestrator` (FastAPI + Agent Core)
    - `automisho-browser` (Playwright Worker)
    - `automisho-db` (pgvector:pg16)
    - `automisho-redis` (redis:7-alpine)
  - Provide `.env.example` with Command Code, PostgreSQL, Redis, and Sentinel secrets

---

## Phase 5: Verification & Integration Run
Focus: End-to-end flow validation, test coverage verification, and healthcheck.

- [ ] **T-5.1: Run Full Test Suite in server/ and front/**
  - Run `python -m pytest server/tests`
  - Run `npm test --prefix front`
  - Verify 0 regressions and strict compliance with specifications
