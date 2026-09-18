import pytest
import httpx
from services.model_gateway import ModelGateway, ModelTier, CircuitBreakerOpenException

@pytest.mark.asyncio
async def test_model_gateway_initialization():
    gw = ModelGateway(base_url="https://api.commandcode.ai/provider/v1", api_key="test_key")
    assert gw.base_url == "https://api.commandcode.ai/provider/v1"
    assert gw.api_key == "test_key"
    assert gw.default_model == "meta/muse-spark-1.3-contributor"

@pytest.mark.asyncio
async def test_model_gateway_completion_success(monkeypatch):
    gw = ModelGateway(base_url="https://api.commandcode.ai/provider/v1", api_key="test_key")

    mock_resp = {
        "id": "cmpl-1",
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "Revisé el SEAT Ibiza y el precio es coherente.",
                    "tool_calls": None
                }
            }
        ],
        "usage": {"prompt_tokens": 100, "completion_tokens": 20}
    }

    async def mock_post(*args, **kwargs):
        req = httpx.Request("POST", "https://api.commandcode.ai/provider/v1/chat/completions")
        return httpx.Response(200, json=mock_resp, request=req)

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    response = await gw.chat_completion(
        messages=[{"role": "user", "content": "Analiza este SEAT Ibiza"}],
        tier=ModelTier.TIER_2_AGENTIC
    )

    assert response.content == "Revisé el SEAT Ibiza y el precio es coherente."
    assert response.model_used == "meta/muse-spark-1.3-contributor"
    assert response.tool_calls is None

@pytest.mark.asyncio
async def test_model_gateway_circuit_breaker(monkeypatch):
    gw = ModelGateway(base_url="https://api.commandcode.ai/provider/v1", api_key="test_key")
    gw.circuit_breaker.failure_threshold = 2

    async def mock_fail(*args, **kwargs):
        raise httpx.ConnectError("Connection failed")

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_fail)

    # First 2 failures
    with pytest.raises(Exception):
        await gw.chat_completion([{"role": "user", "content": "1"}])
    with pytest.raises(Exception):
        await gw.chat_completion([{"role": "user", "content": "2"}])

    # Third attempt should trip circuit breaker
    assert gw.circuit_breaker.is_open() is True
    with pytest.raises(CircuitBreakerOpenException):
        await gw.chat_completion([{"role": "user", "content": "3"}])

@pytest.mark.asyncio
async def test_model_gateway_tier_routing():
    gw = ModelGateway(base_url="https://api.commandcode.ai/provider/v1", api_key="test_key")
    assert gw.resolve_model(ModelTier.TIER_1_FAST) == "deepseek/deepseek-v4-flash"
    assert gw.resolve_model(ModelTier.TIER_2_AGENTIC) == "meta/muse-spark-1.3-contributor"
    assert gw.resolve_model(ModelTier.TIER_VISION) == "deepseek/deepseek-v4.1-flash"
