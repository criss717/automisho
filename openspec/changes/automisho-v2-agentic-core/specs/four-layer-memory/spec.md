# Specification: 4-Layer Persistent Memory

**Change ID:** `automisho-v2-agentic-core`  
**Domain:** `four-layer-memory`  
**Capability:** `four-layer-memory`  
**Status:** `proposed`  
**Standard:** RFC 2119 / Gherkin BDD  

---

## 1. Purpose

The **4-Layer Persistent Memory** architecture equips the AutoMisho agent with multi-tiered recall and stateful awareness across sessions, conversations, semantic knowledge, and long-running background tasks. It eliminates stateless interactions, tracks buyer preferences, compacts conversational history without context loss, executes sub-150ms semantic vehicle similarity search using PostgreSQL `pgvector`, and coordinates asynchronous background scraping and watchdog tasks in Redis.

---

## 2. Requirements

### REQ-FLM-001: Layer 1 — User Profile Memory Schema & Evolution
The system MUST persist and manage a structured `UserProfile` entity stored in PostgreSQL.
1. The schema MUST capture:
   - `user_id` (UUID / NextAuth foreign key).
   - `budget_min` and `budget_max` (EUR numeric).
   - `preferred_makes` and `preferred_models` (string arrays).
   - `preferred_body_types` (enum: `SUV`, `COMPACT`, `SEDAN`, `ESTATE`, `COUPE`, `VAN`).
   - `preferred_fuel_types` (enum: `DIESEL`, `GASOLINE`, `HYBRID`, `PLUG_IN_HYBRID`, `ELECTRIC`).
   - `max_km` (integer threshold, default 200,000).
   - `max_age_years` (integer threshold).
   - `preferred_provinces` (string array of Spanish provinces).
   - `environmental_badge_min` (enum: `NONE`, `B`, `C`, `ECO`, `ZERO`).
2. When an authenticated user expresses explicit preferences in chat (e.g., *"No quiero coches con más de 120.000 km"*), Layer 1 MUST automatically extract and upsert these preferences.
3. Layer 1 constraints MUST be injected as high-priority guidance into the agent's system prompt.

### REQ-FLM-002: Layer 2 — Conversational Buffer & Sliding Window Compaction
The system MUST maintain an active conversational buffer for each session:
1. The buffer MUST preserve the last $N=10$ dialogue turns in verbatim fidelity (including user messages, assistant responses, and tool call results).
2. When the conversation history exceeds $10$ turns or $4000$ tokens, the system MUST trigger an asynchronous background compaction routine.
3. The compaction routine MUST extract:
   - Newly discovered user constraints or preferences (propagated to Layer 1).
   - Evaluated vehicles and user sentiment (liked, discarded, requested price drop).
   - Unresolved user goals and follow-up questions.
4. The compacted summary MUST replace the older turns in the session context window, preserving total context within token limits.

### REQ-FLM-003: Layer 3 — Semantic Memory with PostgreSQL `pgvector` & HNSW Indexing
The system MUST maintain a dedicated vector table `semantic_vehicle_memory` in PostgreSQL using the `pgvector` extension:
1. Embeddings MUST use a consistent vector dimension (1536 for OpenAI/CommandCode text-embedding-3 or 768 for compatible open models).
2. The table MUST be indexed using an HNSW index with cosine distance operator `<=>`:
   `CREATE INDEX ON semantic_vehicle_memory USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);`
3. Similarity search queries MUST execute in $< 150\,\text{ms}$ over a dataset of up to 100,000 embedded vehicle listings and model reliability reports.
4. When indexing a vehicle listing, the embedded text payload MUST serialize key vehicle attributes: make, model, trim, year, mileage, engine, transmission, environmental badge, price, equipment highlights, and mechanical inspection notes.
5. The gateway MUST support deduplication queries: listings with cosine similarity $> 0.96$ matching the same make, model, year, and km within $\pm 2000$ km MUST be flagged as duplicate cross-portal posts.

### REQ-FLM-004: Layer 4 — Redis Task Memory & State Machine
The system MUST persist asynchronous task state in Redis 7 for all long-running agent operations (cross-marketplace scrapers, price drop watchdogs, background DGT checks):
1. Every background task MUST have a unique `task_id` formatted as `task:{domain}:{uuid}`.
2. The task record MUST maintain a strict state machine: `QUEUED` $\to$ `RUNNING` $\to$ `COMPLETED` | `FAILED` | `CANCELLED`.
3. The Redis hash for each task MUST store: `task_id`, `user_id`, `state`, `progress_percent` ($0..100$), `created_at`, `updated_at`, `error_message`, and `result_json`.
4. Completed and Failed task records MUST have a default Time-To-Live (TTL) of 86,400 seconds (24 hours).
5. The system MUST provide an asynchronous cancellation endpoint: setting `state: CANCELLED` MUST signal the running worker to gracefully terminate work at the next checkpoint.

---

## 3. Scenarios

### Scenario: Automatic extraction and persistence of user budget constraint to Layer 1
- **GIVEN** an authenticated user with no prior profile preferences
- **WHEN** the user states in chat: `"Tengo un presupuesto estricto de máximo 18.000€ y solo busco SUV con etiqueta ECO"`
- **THEN** the agentic loop MUST identify profile updates
- **AND** Layer 1 MUST execute an upsert on `user_profiles` setting `budget_max: 18000`, `preferred_body_types: ["SUV"]`, `environmental_badge_min: "ECO"`
- **AND** all subsequent search queries in future sessions MUST automatically apply these constraints by default.

### Scenario: Conversational memory compaction on session turn overflow (Layer 2)
- **GIVEN** an active conversation session reaching turn 11 (exceeding window limit $N=10$)
- **WHEN** the user submits the 11th message
- **THEN** the conversational manager MUST schedule background compaction for turns 1 through 5
- **AND** the compaction job MUST generate a concise factual summary in Spanish
- **AND** the oldest 5 turns MUST be replaced by the structured summary
- **AND** turns 6 through 11 MUST remain in verbatim fidelity.

### Scenario: Fast semantic vector search for comparable vehicles (Layer 3)
- **GIVEN** the `semantic_vehicle_memory` table populated with 50,000 Spanish used car listings
- **AND** an HNSW index configured with `vector_cosine_ops`
- **WHEN** the agent searches for vehicles semantically similar to `"SUV compacto alemán automático diésel fiable para hacer 30.000 km al año"`
- **THEN** the pgvector query MUST execute using cosine distance `<=>`
- **AND** the query execution time MUST be under 150ms
- **AND** the top returned results MUST include models such as BMW X1, Audi Q3, or VW Tiguan matching the criteria.

### Scenario: Semantic deduplication of cross-posted vehicle listing (Layer 3)
- **GIVEN** a listing for a "2019 Seat León FR 2.0 TDI 150CV, 85.000 km, Blanco" scraped from Coches.net
- **WHEN** a new listing with identical specs is scraped from Milanuncios with cosine similarity score $> 0.96$
- **THEN** Layer 3 MUST identify the vehicle as a duplicate cross-post
- **AND** the system MUST merge the listings under a unified vehicle entity showing both source portal links.

### Scenario: Redis task lifecycle for multi-portal car scraping (Layer 4)
- **GIVEN** a user initiates a comprehensive background search across 4 marketplaces
- **WHEN** the orchestrator enqueues the search job
- **THEN** Layer 4 MUST create a Redis record with key `task:search:<uuid>` in state `QUEUED`
- **AND** when the worker picks up the job, the state MUST transition to `RUNNING` with `progress_percent: 25`
- **AND** upon harvesting all sources, the state MUST transition to `COMPLETED` with populated `result_json` and 24-hour TTL.

### Scenario: Graceful cancellation of background task (Layer 4)
- **GIVEN** a task with key `task:watchdog:<uuid>` currently in state `RUNNING`
- **WHEN** the user submits `POST /api/tasks/<uuid>/cancel`
- **THEN** Layer 4 MUST update the Redis state to `CANCELLED`
- **AND** the background worker MUST halt execution during its next loop iteration
- **AND** no further alerts or external requests MUST be dispatched.
