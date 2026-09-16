from enum import Enum
import time
from typing import Dict, Any, Optional

class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    ACTIVE = "active"
    PAUSED = "paused"
    CANCELLED = "cancelled"

class TaskMemory:
    def __init__(self, task_id: str, criteria: Dict[str, Any]):
        self.task_id = task_id
        self.criteria = criteria
        self.status = TaskStatus.PENDING
        self.created_at = time.time()
        self.last_run_at: Optional[float] = None
        self.total_matches = 0

    def start_run(self):
        self.status = TaskStatus.RUNNING
        self.last_run_at = time.time()

    def complete_run(self, new_matches_count: int = 0):
        self.status = TaskStatus.ACTIVE
        self.total_matches += new_matches_count

    def cancel(self):
        self.status = TaskStatus.CANCELLED
