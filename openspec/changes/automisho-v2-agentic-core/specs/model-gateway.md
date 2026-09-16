# Specification: Model Gateway

**Change ID:** `automisho-v2-agentic-core`  
**Domain:** `model-gateway`  
**Capability:** `model-gateway`  
**Status:** `proposed`  
**Standard:** RFC 2119 / Gherkin BDD  

---

## 1. Purpose

The **Model Gateway** provides a resilient, unified LLM routing and execution layer for the AutoMisho agentic copilot. It abstracts model providers behind an OpenAI-compatible interface, standardizes tool-calling schemas, enforces cost-conscious routing, tracks token economics, and guarantees high availability through jittered retries, automated failover, and circuit breaker mechanics.

---

## 2. Requirements

### REQ-MG-001: Command Code Provider API Endpoint & Authentication
The Model Gateway MUST communicate with the Command Code Provider API at `https://api.commandcode.ai/provider/v1` as its default upstream provider. All outbound requests MUST supply the HTTP header `Authorization: Bearer <COMMANDCODE_API_KEY>` and MUST include `Content-Type: application/json`. If `COMMANDCODE_API_KEY` is missing or empty upon initialization, the gateway MUST raise an explicit configuration error and fail fast.

### REQ-MG-002: OpenAI API Compatibility Contract
The Model Gateway MUST accept and emit payloads conforming strictly to the OpenAI `v1/chat/completions` standard. This includes:
1. Support for `messages` array containing `system`, `user`, `assistant`, and `tool` roles.
2. Support for `tools` definition array using JSON Schema function declarations.
3. Support for `tool_choice` parameter (`auto`, `none`, `required`, or explicit function name).
4. Streaming output formatted as Server-Sent Events (`text/event-stream`) ending with `data: [DONE]`.

### REQ-MG-003: Default Cognitive Model (`meta/muse-spark-1.3`)
The system MUST route all general agentic reasoning, multi-turn car buying consultations, vehicle trade-off evaluations, and complex multi-tool planning requests to `meta/muse-spark-1.3` as the default cognitive model.

### REQ-MG-004: Cost & Intent-Based Dynamic Routing Matrix
The Model Gateway MUST inspect incoming request metadata and route to specialized models according to the following matrix:
1. **Extraction & Fast Intent**: Simple car search query parsing, filter extraction, and conversational intent classification SHOULD be routed to `deepseek/deepseek-v4-flash` to minimize latency and token cost.
2. **Multimodal Vehicle Vision**: Any request containing image payloads (base64 or URL) for vehicle damage inspection, sticker verification, or documentation analysis MUST be routed to `google/gemini-2.5-pro`.
3. **General Agentic Deliberation**: All other requests MUST default to `meta/muse-spark-1.3`.

### REQ-MG-005: Exponential Backoff with Jitter
When an upstream provider returns a transient error (HTTP 408, 429, 502, 503, or 504) or encounters a network socket timeout, the Model Gateway MUST retry the request up to a maximum of 3 times. The wait interval $T$ between attempt $n$ ($n \in \{1, 2, 3\}$) MUST follow full jitter exponential backoff:
$$T = \text{random}(0, \min(T_{\text{max}}, T_{\text{base}} \times 2^{n-1}))$$
where $T_{\text{base}} = 500\,\text{ms}$ and $T_{\text{max}} = 4000\,\text{ms}$. The gateway MUST NOT retry on HTTP 400, 401, or 403 client errors.

### REQ-MG-006: Circuit Breaker & Automatic Failover
The Model Gateway MUST maintain an active Circuit Breaker with three states: `CLOSED`, `OPEN`, and `HALF_OPEN`.
1. **Trip Condition**: If 3 consecutive requests to `meta/muse-spark-1.3` fail with transient errors or if upstream error responses persist for $> 10$ seconds, the circuit breaker MUST transition to `OPEN`.
2. **Failover Execution**: While the circuit is `OPEN`, the gateway MUST divert all non-vision agentic requests to `deepseek/deepseek-v4-flash` without attempting to reach `meta/muse-spark-1.3`.
3. **Cooldown & Probe**: After a cooldown window of $30$ seconds, the circuit breaker MUST transition to `HALF_OPEN` and route exactly one canary request to `meta/muse-spark-1.3`.
4. **Recovery**: If the canary request succeeds, the circuit breaker MUST return to `CLOSED`. If the canary fails, the circuit breaker MUST immediately return to `OPEN` for an additional $60$ seconds.

### REQ-MG-007: Token Usage Tracking and Cost Telemetry
The Model Gateway MUST capture prompt tokens, completion tokens, and total tokens from each completed completion response. It MUST calculate the estimated request cost according to the active rate card. Every response envelope returned to internal callers MUST include a `telemetry` block containing `model`, `prompt_tokens`, `completion_tokens`, `estimated_cost_usd`, and `latency_ms`.

### REQ-MG-008: Direct Provider Fallback Override
The gateway MUST support the environment toggle `MODEL_GATEWAY_PROVIDER`. When set to `direct`, the gateway MUST bypass the Command Code Provider API and route directly to native provider SDKs/APIs (e.g. Google Gemini API or DeepSeek direct endpoint) using native credentials.

---

## 3. Scenarios

### Scenario: Successful primary model completion with Muse Spark 1.3
- **GIVEN** the Model Gateway is configured with a valid `COMMANDCODE_API_KEY`
- **AND** the circuit breaker state is `CLOSED`
- **WHEN** the agent submits a user query `"Quiero un Seat León diésel de 2020 por menos de 15000€ en Madrid"`
- **THEN** the gateway MUST dispatch the request to upstream model `meta/muse-spark-1.3`
- **AND** the response MUST return HTTP 200 with an assistant message containing car search tool call recommendations
- **AND** the telemetry metadata MUST record `model: "meta/muse-spark-1.3"` and token counts.

### Scenario: Routing visual inspection request to Gemini 2.5 Pro
- **GIVEN** a user uploads a photo of a vehicle's front bumper with visible scratches
- **AND** the request contains an image block with MIME type `image/jpeg`
- **WHEN** the agent requests damage severity grading
- **THEN** the Model Gateway MUST identify the multimodal payload
- **AND** the gateway MUST route the request to `google/gemini-2.5-pro`
- **AND** the response MUST return structured visual damage analysis without calling non-multimodal models.

### Scenario: Fast intent query classification routed to DeepSeek V4 Flash
- **GIVEN** the orchestrator triggers an internal extraction step to parse search parameters from raw chat text
- **AND** the request metadata specifies `intent_classification: true`
- **WHEN** the gateway evaluates the cost and latency requirements
- **THEN** the gateway MUST route the request to `deepseek/deepseek-v4-flash`
- **AND** the response time SHOULD be under 800ms
- **AND** the estimated cost per token recorded MUST be lower than `meta/muse-spark-1.3`.

### Scenario: Transient upstream 503 error recovered via exponential backoff
- **GIVEN** the upstream Command Code endpoint experiences momentary congestion
- **WHEN** a chat completion request is sent to `meta/muse-spark-1.3`
- **AND** the upstream server responds with HTTP 503 Service Unavailable on attempt 1
- **THEN** the gateway MUST sleep for a jittered interval between 500ms and 1000ms
- **AND** the gateway MUST execute retry attempt 2
- **AND** if attempt 2 responds with HTTP 200, the gateway MUST return the response successfully without tripping the circuit breaker.

### Scenario: Circuit breaker trips after 3 consecutive failures and diverts to DeepSeek
- **GIVEN** the circuit breaker is in `CLOSED` state
- **WHEN** 3 consecutive requests to `meta/muse-spark-1.3` fail due to HTTP 500 Internal Server Errors
- **THEN** the circuit breaker MUST transition to `OPEN`
- **AND** all subsequent requests within the next 30 seconds MUST be routed immediately to `deepseek/deepseek-v4-flash`
- **AND** callers MUST receive valid completion results with `telemetry.fallback_active: true`.

### Scenario: Half-open canary probe restores primary model
- **GIVEN** the circuit breaker is in `OPEN` state and 30 seconds have elapsed
- **WHEN** a new user request arrives
- **THEN** the circuit breaker MUST transition to `HALF_OPEN`
- **AND** the gateway MUST send that single canary request to `meta/muse-spark-1.3`
- **AND** when the canary responds with HTTP 200 within timeout limits, the circuit breaker MUST transition to `CLOSED`
- **AND** full primary traffic routing to `meta/muse-spark-1.3` MUST resume.

### Scenario: Client authentication error fails fast without retrying
- **GIVEN** the gateway sends an invalid API key to the upstream provider
- **WHEN** the upstream responds with HTTP 401 Unauthorized
- **THEN** the gateway MUST NOT retry
- **AND** the gateway MUST immediately raise an upstream authentication exception and return HTTP 502 to the orchestrator caller.

### Scenario: Direct provider fallback mode via environment variable
- **GIVEN** `MODEL_GATEWAY_PROVIDER=direct` is set in the environment
- **AND** `GOOGLE_API_KEY` is present
- **WHEN** a vision inspection request is processed
- **THEN** the gateway MUST bypass `https://api.commandcode.ai/provider/v1`
- **AND** the gateway MUST dispatch directly to the Google GenAI SDK client
- **AND** the completion MUST succeed with provider tag `direct:google`.
