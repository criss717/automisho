"""
Sentinel Tool Gateway for AutoMisho v2.
Enforces authorization boundaries between Safe Tools (autonomous)
and Sensitive Tools (Two-Phase Commit with HMAC-SHA256 signed tokens).
"""
import hmac
import hashlib
import json
import time
import uuid
from enum import Enum
from typing import Dict, Any, Callable, Optional

class ToolClassification(str, Enum):
    SAFE = "safe"
    SENSITIVE = "sensitive"

class SecurityPolicyException(Exception):
    def __init__(self, message: str, staged_action: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.staged_action = staged_action

class TokenExpiredException(Exception):
    pass

class TokenSignatureInvalidException(Exception):
    pass

class SentinelToolGateway:
    DEFAULT_SAFE_TOOLS = {"search_cars", "inspect_listing", "dgt_lookup", "car_vision"}
    DEFAULT_SENSITIVE_TOOLS = {"send_whatsapp", "send_offer_email", "reserve_car"}

    def __init__(self, secret_key: str = "automisho_sentinel_default_secret"):
        self.secret_key = secret_key
        self.tools: Dict[str, Dict[str, Any]] = {}
        self.used_nonces: set = set()

    def classify_tool(self, name: str) -> ToolClassification:
        if name in self.tools:
            return self.tools[name]["classification"]
        if name in self.DEFAULT_SENSITIVE_TOOLS:
            return ToolClassification.SENSITIVE
        return ToolClassification.SAFE

    def register_tool(
        self,
        name: str,
        classification: ToolClassification,
        handler: Callable,
        schema: Optional[Dict[str, Any]] = None
    ):
        self.tools[name] = {
            "classification": classification,
            "handler": handler,
            "schema": schema,
        }

    def create_authorization_token(
        self,
        name: str,
        params: Dict[str, Any],
        expires_in: int = 600
    ) -> str:
        nonce = str(uuid.uuid4())
        exp = int(time.time()) + expires_in
        payload = {
            "name": name,
            "params": params,
            "nonce": nonce,
            "exp": exp,
        }
        encoded_payload = json.dumps(payload, sort_keys=True)
        sig = hmac.new(
            self.secret_key.encode(),
            encoded_payload.encode(),
            hashlib.sha256
        ).hexdigest()

        token_data = {
            "payload": payload,
            "sig": sig,
        }
        return json.dumps(token_data)

    def verify_and_consume_token(self, token: str) -> Dict[str, Any]:
        try:
            token_dict = json.loads(token)
            payload = token_dict["payload"]
            sig = token_dict["sig"]
        except Exception:
            raise TokenSignatureInvalidException("Invalid token format")

        encoded_payload = json.dumps(payload, sort_keys=True)
        expected_sig = hmac.new(
            self.secret_key.encode(),
            encoded_payload.encode(),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(sig, expected_sig):
            raise TokenSignatureInvalidException("HMAC signature verification failed")

        if time.time() > payload["exp"]:
            raise TokenExpiredException("Authorization token has expired")

        nonce = payload["nonce"]
        if nonce in self.used_nonces:
            raise SecurityPolicyException("Token replay detected: nonce already used")

        self.used_nonces.add(nonce)
        return payload

    async def execute_tool(self, name: str, params: Dict[str, Any]) -> Any:
        classification = self.classify_tool(name)

        if classification == ToolClassification.SENSITIVE:
            token = self.create_authorization_token(name, params)
            staged_action = {
                "name": name,
                "params": params,
                "token": token,
                "message": f"Acción sensible '{name}' retenida. Requiere confirmación explícita del usuario.",
            }
            raise SecurityPolicyException(
                f"Tool '{name}' is SENSITIVE and cannot run autonomously.",
                staged_action=staged_action
            )

        if name not in self.tools:
            raise ValueError(f"Tool '{name}' is not registered.")

        handler = self.tools[name]["handler"]
        return await handler(**params)

    async def execute_authorized_token(self, token: str) -> Any:
        payload = self.verify_and_consume_token(token)
        name = payload["name"]
        params = payload["params"]

        if name not in self.tools:
            raise ValueError(f"Tool '{name}' is not registered.")

        handler = self.tools[name]["handler"]
        return await handler(**params)
