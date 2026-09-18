"""
Model Gateway service for AutoMisho v2.
Integrates with Command Code Provider API (OpenAI-compatible) and supports
Muse Spark 1.3 as primary reasoning engine, with cost routing and circuit breaker.
"""
import os
import time
import logging
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import httpx

logger = logging.getLogger("automisho.model_gateway")

class ModelTier(str, Enum):
    TIER_1_FAST = "tier_1_fast"
    TIER_2_AGENTIC = "tier_2_agentic"
    TIER_VISION = "tier_vision"

class CircuitBreakerOpenException(Exception):
    """Raised when circuit breaker is open due to repeated upstream failures."""
    pass

class CircuitBreaker:
    def __init__(self, failure_threshold: int = 3, recovery_time: float = 30.0):
        self.failure_threshold = failure_threshold
        self.recovery_time = recovery_time
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN

    def record_success(self):
        self.failure_count = 0
        self.state = "CLOSED"

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.error(f"[CircuitBreaker] Breaker tripped to OPEN after {self.failure_count} failures.")

    def is_open(self) -> bool:
        if self.state == "OPEN":
            if self.last_failure_time and (time.time() - self.last_failure_time) > self.recovery_time:
                self.state = "HALF_OPEN"
                logger.info("[CircuitBreaker] Transitioning to HALF_OPEN to test recovery.")
                return False
            return True
        return False

class AgentResponse(BaseModel):
    content: str
    model_used: str
    tool_calls: Optional[List[Dict[str, Any]]] = None
    usage: Optional[Dict[str, int]] = None

class ModelGateway:
    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        default_model: Optional[str] = None,
    ):
        self.base_url = (base_url or os.getenv("COMMANDCODE_BASE_URL", "https://api.commandcode.ai/provider/v1")).rstrip("/")
        self.api_key = api_key or os.getenv("COMMANDCODE_API_KEY", "")
        self.default_model = default_model or os.getenv(
            "DEFAULT_AGENT_MODEL", "meta/muse-spark-1.3-contributor"
        )
        self.circuit_breaker = CircuitBreaker()

    def resolve_model(self, tier: ModelTier) -> str:
        if tier == ModelTier.TIER_1_FAST:
            return "deepseek/deepseek-v4-flash"
        elif tier == ModelTier.TIER_VISION:
            return os.getenv("VISION_MODEL", "deepseek/deepseek-v4.1-flash")
        return self.default_model

    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        tier: ModelTier = ModelTier.TIER_2_AGENTIC,
        temperature: float = 0.2,
        timeout: float = 30.0
    ) -> AgentResponse:
        if self.circuit_breaker.is_open():
            raise CircuitBreakerOpenException("Command Code Provider API circuit breaker is OPEN.")

        model = self.resolve_model(tier)
        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()

                self.circuit_breaker.record_success()
                choice = data.get("choices", [{}])[0]
                msg = choice.get("message", {})

                return AgentResponse(
                    content=msg.get("content") or "",
                    model_used=model,
                    tool_calls=msg.get("tool_calls"),
                    usage=data.get("usage"),
                )
        except Exception as e:
            self.circuit_breaker.record_failure()
            logger.warning(f"[ModelGateway] Call failed for {model}: {e}")
            raise
