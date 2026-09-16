import pytest
from services.memory.user_profile import UserProfileMemory
from services.memory.conversation_buffer import ConversationBuffer
from services.memory.task_memory import TaskMemory, TaskStatus

def test_user_profile_memory():
    profile = UserProfileMemory(user_id="usr-123")
    profile.update_preference("max_budget", 3000)
    profile.update_preference("preferred_doors", 3)
    profile.add_excluded_make("Renault")

    data = profile.to_dict()
    assert data["max_budget"] == 3000
    assert data["preferred_doors"] == 3
    assert "Renault" in data["excluded_makes"]

def test_conversation_buffer_sliding_window():
    buf = ConversationBuffer(window_size=3)
    buf.add_message("user", "Hola")
    buf.add_message("assistant", "Hola, en qué te ayudo?")
    buf.add_message("user", "Busco un SEAT Ibiza")
    buf.add_message("assistant", "Aquí tienes 3 opciones")

    # Sliding window should preserve system facts + last 3 turns
    messages = buf.get_context_window()
    assert len(messages) == 3
    assert messages[0]["content"] == "Hola, en qué te ayudo?"
    assert messages[-1]["content"] == "Aquí tienes 3 opciones"

def test_task_memory_state_machine():
    task = TaskMemory(task_id="task-492", criteria={"model": "Ibiza", "max_price": 3000})
    assert task.status == TaskStatus.PENDING

    task.start_run()
    assert task.status == TaskStatus.RUNNING

    task.complete_run(new_matches_count=2)
    assert task.status == TaskStatus.ACTIVE
    assert task.total_matches == 2

    task.cancel()
    assert task.status == TaskStatus.CANCELLED
