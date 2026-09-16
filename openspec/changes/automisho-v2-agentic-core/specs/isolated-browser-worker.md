# Specification: Isolated Browser Worker

**Change ID:** `automisho-v2-agentic-core`  
**Domain:** `isolated-browser-worker`  
**Capability:** `isolated-browser-worker`  
**Status:** `proposed`  
**Standard:** RFC 2119 / Gherkin BDD  

---

## 1. Purpose

The **Isolated Browser Worker** encapsulates all headless browser automation, dynamic DOM rendering, and anti-bot mitigation into a dedicated, sandboxed container (`automisho-browser`). By decoupling browser automation from the main FastAPI orchestrator (`automisho-orchestrator`), it prevents memory leaks, eliminates binary dependencies from the core API server, ensures stealth execution on JavaScript-heavy car portals (Wallapop, Coches.net, Milanuncios), and enforces a multi-tier graceful degradation fallback.

---

## 2. Requirements

### REQ-IBW-001: Sandboxed Container Architecture
All headless browser processes (Chromium, Firefox, or WebKit) MUST execute exclusively inside the isolated container service `automisho-browser`. The core orchestrator (`automisho-orchestrator`) MUST NOT launch or host browser instances directly. Communication between the orchestrator and the browser worker MUST occur over the internal Docker network via HTTP REST at `http://automisho-browser:8081`.

### REQ-IBW-002: Worker REST / RPC Interface Contract
The `automisho-browser` service MUST expose the following REST endpoints:
1. `POST /scrape/extract`:
   - **Request Payload**:
     ```json
     {
       "url": "https://www.coches.net/segunda-mano/...",
       "wait_until": "networkidle",
       "timeout_ms": 15000,
       "selectors": {
         "title": "h1.mt-Title",
         "price": ".mt-CardAdPrice",
         "mileage": ".mt-CardAdAttribute"
       },
       "emulate_human": true,
       "capture_screenshot": false
     }
     ```
   - **Response Envelope**:
     ```json
     {
       "status": "success",
       "url": "https://www.coches.net/...",
       "data": {
         "title": "SEAT Leon 1.6 TDI",
         "price": "12.500 €",
         "mileage": "94.000 km"
       },
       "html": "<sanitized html>",
       "execution_time_ms": 2340
     }
     ```
2. `POST /scrape/session`: Creates or updates a browser context with custom cookies, proxy settings, and session storage.
3. `GET /health`: Returns `{ "status": "healthy", "browser": "chromium", "active_pages": 0, "memory_rss_mb": 210 }`.

### REQ-IBW-003: Anti-Bot Stealth & Human Emulation
The browser worker MUST incorporate anti-bot stealth patches (`playwright-stealth` or equivalent evasion scripts):
1. `navigator.webdriver` MUST be overridden to `undefined`.
2. Chrome runtime objects (`window.chrome`) and permissions queries MUST emulate standard desktop browser profiles.
3. User-Agent strings MUST be dynamically selected from a pool of modern desktop Chrome/Edge versions.
4. If `emulate_human: true` is requested, the worker MUST simulate non-linear mouse jitter, natural scrolling increments, and variable delays between page actions ($100\,\text{ms}..450\,\text{ms}$).

### REQ-IBW-004: Strict Timeout & Resource Containment
1. The browser worker MUST enforce an unyielding timeout of $15$ seconds per extraction request. If page navigation or selector evaluation exceeds $15$ seconds, the worker MUST abort the page, clean up context, and return HTTP 504 Gateway Timeout.
2. The browser container MUST enforce a memory ceiling (e.g. 1.5GB RAM via Docker Compose limits).
3. To prevent chromium zombie processes and memory bloat, browser contexts MUST be closed immediately upon task completion, and the worker process MUST recycle worker browser instances after every $100$ completed requests.

### REQ-IBW-005: Multi-Tier Graceful Degradation Hierarchy
The orchestrator MUST implement a 3-tier fallback strategy when extracting car listings:
1. **Tier 1 (Fast Static HTTP)**: The orchestrator first attempts extraction using lightweight `httpx` and `BeautifulSoup4`.
2. **Tier 2 (Isolated Browser Worker)**: If Tier 1 encounters HTTP 403, Cloudflare challenge, or missing client-side rendered DOM, the request MUST be escalated to `automisho-browser`.
3. **Tier 3 (Cached Catalog Fallback)**: If Tier 2 fails or times out, the orchestrator MUST fall back to cached listings from `market_catalog.py`, appending a warning flag `cached_results: true`. The orchestrator MUST NOT crash or return HTTP 500 to the client.

---

## 3. Scenarios

### Scenario: Successful dynamic listing extraction from single-page application (SPA)
- **GIVEN** a vehicle listing on Coches.net whose specs are populated via client-side React hydration
- **WHEN** `automisho-orchestrator` invokes `POST /scrape/extract` with the target URL
- **THEN** `automisho-browser` MUST open a headless Chromium page with stealth evasions
- **AND** the worker MUST wait for network idle or selector resolution
- **AND** the worker MUST extract title, price, mileage, and image URLs
- **AND** the response MUST return HTTP 200 with extracted structured data within 4000ms.

### Scenario: Evasion of anti-bot fingerprint detection
- **GIVEN** a target marketplace protected by basic Cloudflare or Akamai bot management
- **WHEN** the browser worker navigates to the page
- **THEN** the stealth plugin MUST suppress the `navigator.webdriver` flag
- **AND** human emulation MUST generate natural scroll events
- **AND** the challenge page MUST resolve successfully without presenting a Cloudflare CAPTCHA loop.

### Scenario: Hard timeout enforcement on hanging marketplace page
- **GIVEN** a remote car portal whose servers are unresponsive or stalling socket connections
- **WHEN** `automisho-browser` executes `POST /scrape/extract` with `timeout_ms: 15000`
- **AND** 15 seconds elapse without DOM completion
- **THEN** the worker MUST force-terminate the page context
- **AND** the worker MUST return HTTP 504 with error code `BROWSER_TIMEOUT`
- **AND** the orchestrator MUST receive the error without blocking its main thread.

### Scenario: Automated process recycling after 100 requests to prevent leaks
- **GIVEN** the `automisho-browser` service has processed 99 requests
- **WHEN** the 100th request completes successfully
- **THEN** the worker lifecycle manager MUST mark the current browser process for graceful retirement
- **AND** the worker MUST launch a fresh Chromium instance in the background
- **AND** subsequent requests MUST be routed to the new browser instance without dropping connections.

### Scenario: Full graceful degradation from Tier 2 failure to Tier 3 cached catalog
- **GIVEN** the `automisho-browser` service is temporarily unreachable or returning HTTP 500
- **WHEN** the orchestrator attempts to fetch listings for a user query
- **THEN** the orchestrator MUST catch the worker connection failure
- **AND** the orchestrator MUST fallback to Tier 3 cached catalog fixtures in `market_catalog.py`
- **AND** the API response MUST return HTTP 200 with cached listings and metadata flag `is_cached: true`.

### Scenario: Health check endpoint validation
- **GIVEN** the `automisho-browser` container is healthy
- **WHEN** Docker Compose or the orchestrator queries `GET /health`
- **THEN** the response MUST return HTTP 200
- **AND** the JSON payload MUST contain `status: "healthy"` and positive `memory_rss_mb`.
