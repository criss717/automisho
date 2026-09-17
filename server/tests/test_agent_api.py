import pytest
import httpx
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_agent_chat_endpoint_structure(monkeypatch):
    # Mock ModelGateway response to avoid real network calls during pytest
    async def mock_chat_completion(*args, **kwargs):
        from services.model_gateway import AgentResponse
        return AgentResponse(
            content="Hola, soy AutoMisho v2 con Muse Spark.",
            model_used="meta/muse-spark-1.3",
            tool_calls=None
        )

    from routers.agent import model_gw
    monkeypatch.setattr(model_gw, "chat_completion", mock_chat_completion)

    res = client.post("/agent/chat", json={
        "messages": [{"role": "user", "content": "Hola"}]
    })

    assert res.status_code == 200
    data = res.json()
    assert "content" in data
    assert data["model_used"] == "meta/muse-spark-1.3"
    assert data["content"] == "Hola, soy AutoMisho v2 con Muse Spark."
