from typing import Dict, Any, List

class UserProfileMemory:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.preferences: Dict[str, Any] = {
            "max_budget": None,
            "preferred_doors": None,
            "preferred_colors": [],
            "excluded_makes": [],
            "location": None,
        }

    def update_preference(self, key: str, value: Any):
        self.preferences[key] = value

    def add_excluded_make(self, make: str):
        if make not in self.preferences["excluded_makes"]:
            self.preferences["excluded_makes"].append(make)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            **self.preferences
        }
