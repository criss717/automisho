import pytest
from services.sentinel import (
    SentinelToolGateway,
    ToolClassification,
    SecurityPolicyException,
    TokenExpiredException,
    TokenSignatureInvalidException,
)

def test_tool_classification():
    sentinel = SentinelToolGateway(secret_key="super_secret_test_key")
    assert sentinel.classify_tool("search_cars") == ToolClassification.SAFE
    assert sentinel.classify_tool("inspect_listing") == ToolClassification.SAFE
    assert sentinel.classify_tool("dgt_lookup") == ToolClassification.SAFE
    assert sentinel.classify_tool("car_vision") == ToolClassification.SAFE

    assert sentinel.classify_tool("send_whatsapp") == ToolClassification.SENSITIVE
    assert sentinel.classify_tool("send_offer_email") == ToolClassification.SENSITIVE
    assert sentinel.classify_tool("reserve_car") == ToolClassification.SENSITIVE

@pytest.mark.asyncio
async def test_safe_tool_autonomous_execution():
    sentinel = SentinelToolGateway(secret_key="super_secret_test_key")

    async def sample_search(query: str, max_price: int):
        return [{"make": "SEAT", "model": "Ibiza", "price": 2800}]

    sentinel.register_tool(
        name="search_cars",
        classification=ToolClassification.SAFE,
        handler=sample_search
    )

    result = await sentinel.execute_tool(
        name="search_cars",
        params={"query": "ibiza", "max_price": 3000}
    )
    assert len(result) == 1
    assert result[0]["make"] == "SEAT"

@pytest.mark.asyncio
async def test_sensitive_tool_blocked_without_token():
    sentinel = SentinelToolGateway(secret_key="super_secret_test_key")

    async def sample_offer(car_id: int, amount: float):
        return {"status": "offer_sent", "car_id": car_id, "amount": amount}

    sentinel.register_tool(
        name="send_offer_email",
        classification=ToolClassification.SENSITIVE,
        handler=sample_offer
    )

    # Calling directly without token must raise SecurityPolicyException and return staged action
    with pytest.raises(SecurityPolicyException) as excinfo:
        await sentinel.execute_tool(
            name="send_offer_email",
            params={"car_id": 101, "amount": 2500.0}
        )
    
    staged = excinfo.value.staged_action
    assert staged is not None
    assert staged["name"] == "send_offer_email"
    assert "token" in staged
    assert staged["params"]["amount"] == 2500.0

@pytest.mark.asyncio
async def test_sensitive_tool_execution_with_valid_token():
    sentinel = SentinelToolGateway(secret_key="super_secret_test_key")

    async def sample_offer(car_id: int, amount: float):
        return {"status": "offer_sent", "car_id": car_id, "amount": amount}

    sentinel.register_tool(
        name="send_offer_email",
        classification=ToolClassification.SENSITIVE,
        handler=sample_offer
    )

    token = sentinel.create_authorization_token(
        name="send_offer_email",
        params={"car_id": 101, "amount": 2500.0}
    )

    # Execute with verified token
    result = await sentinel.execute_authorized_token(token)
    assert result["status"] == "offer_sent"
    assert result["car_id"] == 101

    # Replay attack protection: token cannot be reused
    with pytest.raises(SecurityPolicyException):
        await sentinel.execute_authorized_token(token)
