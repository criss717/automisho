"""
AutoMisho AI Service with OpenCode Go primary and Google GenAI fallback.
"""
import os
import logging
import httpx
from typing import Optional
from google import genai
from google.genai import types

logger = logging.getLogger("automisho.ai")

OPENCODE_BASE_URL = os.getenv("OPENCODE_BASE_URL", "https://opencode.ai/zen/go/v1")
OPENCODE_API_KEY = os.getenv("OPENCODE_API_KEY")
OPENCODE_MODEL = os.getenv("OPENCODE_MODEL", "qwen3.7-plus")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


def get_genai_client() -> Optional[genai.Client]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    return genai.Client(api_key=api_key)


async def generate_chat_response(prompt: str, system_prompt: Optional[str] = None) -> str:
    """
    Generates chat response:
    1. First tries OpenCode Go.
    2. If OpenCode fails or is unconfigured, falls back to Google GenAI.
    """
    # 1. Try OpenCode Go first
    if OPENCODE_API_KEY:
        try:
            logger.info(f"[ai] Attempting OpenCode Go with model: {OPENCODE_MODEL}")
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{OPENCODE_BASE_URL.rstrip('/')}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENCODE_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": OPENCODE_MODEL,
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
                else:
                    logger.warning(f"[ai] OpenCode Go returned HTTP {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.warning(f"[ai] OpenCode Go failed: {e}. Switching to Google GenAI fallback...")

    # 2. Fallback to Google GenAI
    client = get_genai_client()
    if client:
        try:
            model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
            logger.info(f"[ai] Generating content with Google GenAI ({model_name})")
            config = types.GenerateContentConfig(
                system_instruction=system_prompt if system_prompt else None,
            )
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config,
            )
            if response and response.text:
                return response.text
        except Exception as e:
            logger.error(f"[ai] Google GenAI failed: {e}")
            raise

    raise RuntimeError("No AI provider available (both OpenCode and Google GenAI failed or unconfigured)")
