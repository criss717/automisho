import pytest
import os
import sys
from unittest.mock import AsyncMock, MagicMock

# Ensure server root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

@pytest.fixture
def mock_commandcode_api():
    """Mock for Command Code Provider API completions."""
    mock = AsyncMock()
    mock.return_value = {
        "id": "chatcmpl-test-123",
        "object": "chat.completion",
        "model": "meta/muse-spark-1.3",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Analizado con Muse Spark 1.3: El vehículo está en buen estado.",
                    "tool_calls": None
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {
            "prompt_tokens": 120,
            "completion_tokens": 45,
            "total_tokens": 165
        }
    }
    return mock
