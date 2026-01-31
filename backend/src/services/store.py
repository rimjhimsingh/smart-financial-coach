from dataclasses import dataclass, field
from typing import Dict
import pandas as pd


@dataclass
class InMemoryStore:
    accounts: Dict[str, dict] = field(default_factory=dict)
    transactions: pd.DataFrame = field(default_factory=lambda: pd.DataFrame())


STORE = InMemoryStore()
