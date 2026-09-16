from typing import List, Dict, Any

class ConversationBuffer:
    def __init__(self, window_size: int = 10):
        self.window_size = window_size
        self.messages: List[Dict[str, str]] = []

    def add_message(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})

    def get_context_window(self) -> List[Dict[str, str]]:
        if len(self.messages) <= self.window_size:
            return list(self.messages)
        return list(self.messages[-self.window_size:])
