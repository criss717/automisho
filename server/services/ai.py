"""
AutoMisho AI Service (GOAT-only).

Single provider: Command Code Provider API (OpenAI-compatible).
Legacy OpenCode/Gemini fallbacks were removed.
"""
import os
import logging
import httpx
from typing import Optional

logger = logging.getLogger("automisho.ai")

COMMANDCODE_BASE_URL = os.getenv(
    "COMMANDCODE_BASE_URL", "https://api.commandcode.ai/provider/v1"
)
COMMANDCODE_API_KEY = os.getenv("COMMANDCODE_API_KEY")
COMMANDCODE_MODEL = os.getenv(
    "DEFAULT_AGENT_MODEL",
    os.getenv("COMMANDCODE_MODEL", "meta/muse-spark-1.3-contributor"),
)


async def generate_chat_response(prompt: str, system_prompt: Optional[str] = None) -> str:
    """
    Generates a chat response via the Command Code Provider API (GOAT-only).
    """
    if not COMMANDCODE_API_KEY:
        raise RuntimeError("No AI provider available (COMMANDCODE_API_KEY is not configured)")

    logger.info(f"[ai] Generating content with Command Code model: {COMMANDCODE_MODEL}")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{COMMANDCODE_BASE_URL.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {COMMANDCODE_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": COMMANDCODE_MODEL,
                    "messages": [
                        *([{"role": "system", "content": system_prompt}] if system_prompt else []),
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                choices = data.get("choices", [])
                if choices and "message" in choices[0]:
                    return choices[0]["message"]["content"]
                raise RuntimeError("Command Code provider returned an empty completion")
            logger.warning(f"[ai] Command Code returned HTTP {resp.status_code}: {resp.text}")
            raise RuntimeError(f"Command Code provider failed with HTTP {resp.status_code}")
    except Exception as e:
        logger.error(f"[ai] Command Code provider failed: {e}")
        raise
