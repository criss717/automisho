# Specification: Sentinel Tool Gateway

**Change ID:** `automisho-v2-agentic-core`  
**Domain:** `sentinel-tool-gateway`  
**Capability:** `sentinel-tool-gateway`  
**Status:** `proposed`  
**Standard:** RFC 2119 / Gherkin BDD  

---

## 1. Purpose

The **Sentinel Tool Gateway** acts as the strict security boundary between the autonomous AI agent and external execution side-effects. It classifies tools into **Safe Autonomous** and **Sensitive Authorization-Gated** tiers. Sensitive tools are prohibited from autonomous execution and can only proceed via a cryptographically signed **Two-Phase Commit (2PC)** human-in-the-loop (HITL) protocol, preventing unintended external communications, financial commitments, or irreversible actions.

---

## 2. Requirements

### REQ-STG-001: Strict Binary Tool Classification
The Sentinel Tool Gateway MUST enforce a binary classification for all registered agent tools:
1. **Safe Autonomous Tools**:
   - `search_cars`: Marketplace query and aggregation.
   - `inspect_listing`: Deep inspection of a specific vehicle URL.
   - `dgt_lookup`: DGT report synthesis, environmental badge, and MOT status checks.
   - `car_vision`: Multimodal visual inspection of vehicle photographs.
2. **Sensitive Authorization-Gated Tools**:
   - `send_whatsapp`: Outbound messaging to private sellers or dealerships.
   - `send_offer_email`: Dispatch of formal price offers or counter-proposals.
   - `reserve_car`: Intent creation for vehicle reservation or deposit escrow.

### REQ-STG-002: Autonomous Execution Contract for Safe Tools
Safe tools MUST execute autonomously when called by the Model Gateway without user confirmation, provided all input validation criteria pass:
1. `search_cars`: MUST validate that `max_price >= min_price >= 0`, `max_km >= 0`, and source is in `{"auto", "autoscout24", "cochesnet", "wallapop", "milanuncios"}`. `max_results` MUST be clamped to the range $[1, 12]$.
2. `inspect_listing`: MUST validate that target URL domain belongs to the trusted whitelist (`autoscout24.es`, `coches.net`, `wallapop.com`, `milanuncios.com`). Requests to unlisted domains MUST be rejected.
3. `dgt_lookup`: MUST sanitize license plates to format `^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$` and VINs to `^[A-HJ-NPR-Z0-9]{17}$`.
4. `car_vision`: MUST reject files larger than 10MB or with MIME types other than `image/jpeg`, `image/png`, or `image/webp`.

### REQ-STG-003: Two-Phase Commit (2PC) Protocol for Sensitive Tools
When the Model Gateway produces a tool call for any Sensitive tool, the Sentinel Gateway MUST intercept execution and enforce the following Two-Phase Commit workflow:
1. **Phase 1 (Proposal)**:
   - The Sentinel Gateway MUST NOT execute the tool.
   - The Sentinel Gateway MUST generate a cryptographically signed `confirmation_token` incorporating: `token_id`, `user_id`, `tool_name`, `sha256(canonical_arguments_json)`, `issued_at`, `expires_at`, and a cryptographically secure random 128-bit `salt`.
   - The token MUST be signed using HMAC-SHA256 with a dedicated server secret key (`SENTINEL_SIGNING_SECRET`).
   - The agentic loop MUST return a structured confirmation request event to the frontend containing `token_id`, `confirmation_token`, `tool_name`, `summary_es`, `parameters_preview`, and `expires_at`.
2. **Phase 2 (Commit)**:
   - The user reviews and explicitly authorizes the action in the client UI.
   - The frontend submits `POST /api/agent/confirm` containing `token_id`, `confirmation_token`, and the confirmed parameters.
   - The Sentinel Gateway MUST verify the HMAC signature, verify `expires_at > now()`, and verify that `sha256(canonical_arguments_json)` exactly matches the proposal payload.
   - Only upon 100% verification match SHALL the Sentinel Gateway execute the sensitive tool handler.

### REQ-STG-004: Token Lifetime & Expiration
The `confirmation_token` MUST have a maximum time-to-live (TTL) of 300 seconds (5 minutes). Any confirmation submitted after `expires_at` MUST be rejected with HTTP 410 Gone and reason `TOKEN_EXPIRED`.

### REQ-STG-005: Tamper Resistance & Payload Immutability
If any parameter in the commit phase differs from the parameters signed during the proposal phase, the argument hash verification MUST fail, and the Sentinel Gateway MUST immediately reject the request with HTTP 403 Forbidden and audit log security alert `SENTINEL_PAYLOAD_TAMPERING`.

### REQ-STG-006: Replay Attack Prevention
Every `confirmation_token` MUST be single-use. The Sentinel Gateway MUST store used `token_id`s in Redis with a TTL of 3600 seconds. If a commit request is received for an already consumed `token_id`, the Sentinel Gateway MUST reject execution with HTTP 409 Conflict and code `TOKEN_ALREADY_CONSUMED`.

### REQ-STG-007: Emergency Lockdown Mode
The Sentinel Gateway MUST support an emergency kill switch controlled by `SENTINEL_LOCKDOWN=true`. When lockdown is active:
1. All sensitive tools MUST be immediately deregistered from the agent schema.
2. Any pending or submitted confirmation request MUST return HTTP 423 Locked with error `SENTINEL_SYSTEM_LOCKED`.
3. Safe autonomous tools SHALL remain operational for read-only vehicle exploration.

---

## 3. Scenarios

### Scenario: Autonomous execution of safe car search tool
- **GIVEN** the agent decides to invoke tool `search_cars` with arguments `{"query": "Golf TDI", "max_price": 12000, "source": "auto"}`
- **WHEN** the tool call reaches the Sentinel Tool Gateway
- **THEN** the Sentinel Gateway MUST identify `search_cars` as a Safe tool
- **AND** the gateway MUST validate parameter boundaries
- **AND** the tool MUST execute autonomously without issuing a confirmation token
- **AND** the search results MUST be returned to the agent within the conversational flow.

### Scenario: Interception of sensitive WhatsApp message tool (Phase 1 Proposal)
- **GIVEN** the agent generates a tool call `send_whatsapp` targeting seller phone `"+34600112233"` with car inquiry message
- **WHEN** the Sentinel Tool Gateway inspects the tool call
- **THEN** the gateway MUST intercept execution and prevent outbound dispatch
- **AND** the gateway MUST compute `confirmation_token` using HMAC-SHA256
- **AND** the agent MUST return an SSE event `type: "tool_confirmation_required"` containing the token and message preview in Spanish
- **AND** no external HTTP request to WhatsApp APIs MUST be made.

### Scenario: Successful authorization and execution of WhatsApp message (Phase 2 Commit)
- **GIVEN** a valid unexpired confirmation token generated for `send_whatsapp`
- **WHEN** the authenticated user clicks "Confirmar y Enviar" in the UI
- **AND** the frontend submits `POST /api/agent/confirm` with the valid `confirmation_token`
- **THEN** the Sentinel Gateway MUST verify the HMAC signature and expiration timestamp
- **AND** the gateway MUST verify the argument hash matches the original payload
- **AND** the gateway MUST record the `token_id` in Redis as consumed
- **AND** the gateway MUST execute `send_whatsapp` and return delivery status to the user.

### Scenario: Rejection of tampered offer email parameters
- **GIVEN** a confirmation token generated for `send_offer_email` with `offered_price: 14000`
- **WHEN** an adversary or compromised client submits `POST /api/agent/confirm` with modified `offered_price: 9000`
- **THEN** the Sentinel Gateway MUST recompute the canonical argument SHA-256 hash
- **AND** the hash MUST NOT match the hash embedded in the signature
- **AND** the Sentinel Gateway MUST reject the request with HTTP 403 Forbidden
- **AND** an audit log entry for `SENTINEL_PAYLOAD_TAMPERING` MUST be emitted.

### Scenario: Rejection of expired confirmation token
- **GIVEN** a confirmation token generated at timestamp $T_0$ with TTL 300 seconds
- **WHEN** the user submits confirmation at $T_0 + 301$ seconds
- **THEN** the Sentinel Gateway MUST detect `now() > expires_at`
- **AND** the gateway MUST return HTTP 410 Gone with `code: "TOKEN_EXPIRED"`
- **AND** the sensitive action MUST NOT be executed.

### Scenario: Replay attack prevention on sensitive car reservation
- **GIVEN** a confirmation token for `reserve_car` has been successfully confirmed and executed
- **WHEN** a second commit request with the same `confirmation_token` is submitted
- **THEN** the Sentinel Gateway MUST lookup `token_id` in Redis
- **AND** the gateway MUST detect that `token_id` has already been marked consumed
- **AND** the gateway MUST reject the second request with HTTP 409 Conflict
- **AND** no duplicate reservation MUST occur.

### Scenario: Emergency lockdown blocks all sensitive operations
- **GIVEN** `SENTINEL_LOCKDOWN=true` is set in the environment
- **WHEN** a user attempts to confirm a pending `send_offer_email` token
- **THEN** the Sentinel Gateway MUST intercept the request
- **AND** the gateway MUST respond with HTTP 423 Locked
- **AND** the email MUST NOT be sent.
