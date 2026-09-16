# Specification: Strict TDD Test Harness

**Change ID:** `automisho-v2-agentic-core`  
**Domain:** `testing-strict-tdd`  
**Capability:** `server-tdd-harness`  
**Status:** `proposed`  
**Standard:** RFC 2119 / Gherkin BDD  

---

## 1. Purpose

The **Strict TDD Test Harness** defines the testing infrastructure, fixture architecture, external service isolation contracts, and execution discipline for the AutoMisho backend (`server/`). As mandated by `openspec/config.yaml` (`strict_tdd: true`), all agentic orchestrator capabilities MUST follow a strict Red-Green-Refactor development cycle. Non-deterministic AI behaviors, tool invocations, and external scraping operations MUST be bounded by deterministic unit and integration test fixtures.

---

## 2. Requirements

### REQ-TDD-001: Strict Red-Green-Refactor Discipline
Every feature, bugfix, or behavioral modification in `server/` MUST adhere to the following lifecycle:
1. **Red Phase**: Developers/agents MUST write a focused, failing automated test asserting the expected behavior before writing or modifying production code. The test runner MUST verify that the test fails for the expected reason.
2. **Green Phase**: Developers/agents MUST write the minimal production code necessary to pass the failing test.
3. **Refactor Phase**: Developers/agents MUST refactor the implementation for cleanliness, type safety, and architectural standards while ensuring all tests remain passing.

### REQ-TDD-002: Directory Structure & Test Hierarchy
The backend test harness MUST be organized under `server/tests/` with the following explicit structure:
```
server/tests/
├── conftest.py               # Shared global fixtures, mock providers, event loop
├── unit/                     # Fast isolated unit tests (< 50ms per test)
│   ├── test_gateway.py       # Model Gateway & circuit breaker unit tests
│   ├── test_sentinel.py      # Sentinel 2PC token generation & verification
│   ├── test_memory.py        # 4-layer memory unit tests
│   └── test_tools.py         # Tool parameter validation & sanitization
└── integration/              # Component & integration tests using TestClient
    ├── test_chat_agent.py    # Agentic chat flow integration tests
    ├── test_browser_rpc.py   # Browser worker RPC client tests
    └── test_api_routes.py    # FastAPI endpoint integration tests
```

### REQ-TDD-003: Core Fixtures Architecture (`server/tests/conftest.py`)
The root `conftest.py` MUST provide standardized fixtures:
1. `mock_model_gateway`: An async mock mimicking the Command Code Provider API and OpenAI chat completion protocol. It MUST support configurable responses, streaming chunk generation, latency simulation, and error injection (HTTP 429, 500, 503).
2. `mock_sentinel_token`: A fixture generating valid, expired, and tampered HMAC-SHA256 tokens for testing Two-Phase Commit tool execution.
3. `mock_redis`: An async in-memory Redis client (using `fakeredis[aioredis]` or dict-backed async wrapper) supporting hashes, key expiration, and TTL queries.
4. `mock_db_session`: An async SQLAlchemy test session using an isolated SQLite/PostgreSQL test instance or transactional rollback fixture.
5. `mock_browser_worker`: An `httpx.AsyncClient` transport mock intercepting calls to `http://automisho-browser:8081` and returning deterministic HTML/JSON fixtures.

### REQ-TDD-004: External Service Mock Isolation & Zero Network Leakage
Unit and integration test suites MUST NOT make live outbound network requests to external services (Command Code API, Google GenAI, Wallapop, Coches.net, AutoScout24, WhatsApp, or SMTP servers). Any test that initiates an unmocked external network call MUST fail immediately.

### REQ-TDD-005: Asyncio Test Environment & Runner Configuration
1. The test runner MUST be `pytest` configured with `pytest-asyncio`.
2. `server/pytest.ini` or `pyproject.toml` MUST configure:
   ```ini
   [pytest]
   asyncio_mode = auto
   testpaths = tests
   python_files = test_*.py
   filterwarnings = error::RuntimeWarning
   ```
3. Test execution MUST succeed when invoked via `python -m pytest` from the `server/` directory or root workspace.

### REQ-TDD-006: CI/Local Test Execution Quality Gate
1. All tests MUST pass (100% green) before any task or change is marked complete.
2. The entire unit test suite SHOULD execute in $< 5$ seconds locally.
3. Flaky tests (tests that pass or fail non-deterministically) are strictly forbidden; any test relying on real timers MUST use mock clocks or freeze-gun/time-machine utilities.

---

## 3. Scenarios

### Scenario: T-0 Bootstrap test suite executes cleanly with baseline passing tests
- **GIVEN** `pytest`, `pytest-asyncio`, `pytest-mock`, and `httpx` are installed in `server/`
- **AND** `server/tests/conftest.py` and a baseline test file `server/tests/unit/test_baseline.py` exist
- **WHEN** the test runner executes `python -m pytest` in `server/`
- **THEN** pytest MUST discover the test suite
- **AND** all baseline tests MUST pass with return code 0
- **AND** execution time MUST be under 2 seconds.

### Scenario: Strict Red phase verification before Model Gateway implementation
- **GIVEN** a new requirement for circuit breaker failover to `deepseek/deepseek-v4-flash`
- **WHEN** the developer writes `test_circuit_breaker_failover_after_3_failures` in `server/tests/unit/test_gateway.py` before modifying the gateway
- **AND** executes `python -m pytest server/tests/unit/test_gateway.py`
- **THEN** the test MUST fail with `AssertionError` or `AttributeError` indicating missing functionality
- **AND** the failure proves the test is valid and unfulfilled.

### Scenario: Strict Green phase verification upon feature implementation
- **GIVEN** a failing test for Sentinel HMAC token validation
- **WHEN** the developer implements the `SentinelGateway.verify_token` method
- **AND** executes `python -m pytest server/tests/unit/test_sentinel.py`
- **THEN** the test MUST pass with green status
- **AND** no regressions MUST be introduced in existing test cases.

### Scenario: Zero network leakage enforcement
- **GIVEN** a test case testing the scraping router
- **WHEN** the router attempts an HTTP call without using the `mock_browser_worker` fixture
- **THEN** the test environment or mock transport MUST intercept the connection attempt
- **AND** the test MUST raise an explicit unmocked network call exception, failing the test.

### Scenario: Deterministic error simulation using `mock_model_gateway`
- **GIVEN** `mock_model_gateway` configured to simulate HTTP 429 Too Many Requests on the first 2 calls and HTTP 200 on the 3rd call
- **WHEN** the agentic core executes a chat turn
- **THEN** the retry fixture MUST intercept the 429 responses
- **AND** the test MUST assert that exactly 3 calls were made
- **AND** the final return value MUST be the successful completion payload.
